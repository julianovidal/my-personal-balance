"""CSV and XLSX parsing in app/services/import_service.py, without a database.

These tests pin the parser's current behavior so the pandas 2 → 3 upgrade can
be checked against it (specs/python-3-14-backend-and-classifier.md). Tests named
`test_current_*` lock in quirks that are known and not yet fixed. Change them
only together with a spec that changes the behavior.
"""

import datetime
import io
from decimal import Decimal

import pytest
from openpyxl import Workbook

from app.services.import_service import parse_transactions_from_upload, parse_transactions_with_errors


def csv(*lines: str) -> bytes:
    return ("\n".join(lines) + "\n").encode()


def xlsx(*rows: list) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_csv_rows_parse_dates_amounts_currency_and_tags():
    rows, errors = parse_transactions_with_errors(
        "bank.csv",
        csv(
            "date,description,amount,currency,tag_id",
            "2025-01-15,Coffee shop,-3.50,EUR,7",
            "2025-02-02,Big purchase,-1234.56,BRL,3",
            "2025-02-03,Salary,2500,,",
        ),
    )

    assert errors == []
    assert rows == [
        {
            "date": datetime.date(2025, 1, 15),
            "description": "Coffee shop",
            "amount": Decimal("-3.50"),
            "currency": "EUR",
            "tag_id": 7,
            "row": 2,
        },
        {
            "date": datetime.date(2025, 2, 2),
            "description": "Big purchase",
            "amount": Decimal("-1234.56"),
            "currency": "BRL",
            "tag_id": 3,
            "row": 3,
        },
        {
            "date": datetime.date(2025, 2, 3),
            "description": "Salary",
            "amount": Decimal("2500"),
            "currency": None,
            "tag_id": None,
            "row": 4,
        },
    ]


def test_amounts_are_exact_decimals():
    rows, _ = parse_transactions_with_errors(
        "bank.csv",
        csv("date,description,amount", "2025-01-01,a,0.10", "2025-01-02,b,-0.07", "2025-01-03,c,19.99"),
    )

    amounts = [row["amount"] for row in rows]
    assert all(isinstance(amount, Decimal) for amount in amounts)
    assert amounts == [Decimal("0.10"), Decimal("-0.07"), Decimal("19.99")]
    assert sum(amounts) == Decimal("20.02")


def test_currency_is_trimmed_and_upper_cased():
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount,currency", "2025-01-01,a,1, usd ")
    )

    assert errors == []
    assert rows[0]["currency"] == "USD"


def test_unknown_currency_is_a_row_error():
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount,currency", "2025-01-01,a,1,GBP")
    )

    assert rows == []
    assert errors == [{"row": 2, "message": "Currency must be one of: USD, EUR, BRL"}]


def test_unparseable_date_is_a_row_error_and_other_rows_still_parse():
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount", "notadate,a,1", "2025-01-02,b,2")
    )

    assert [error["row"] for error in errors] == [2]
    assert [row["description"] for row in rows] == ["b"]


def test_day_first_date_that_cannot_be_month_first():
    rows, _ = parse_transactions_with_errors("bank.csv", csv("date,description,amount", "15/01/2025,a,1"))

    assert rows[0]["date"] == datetime.date(2025, 1, 15)


@pytest.mark.parametrize("value", ["03/04/2025", "03/04/25", "3/4/2025", '" 03/04/2025 "'])
def test_ambiguous_slash_date_is_read_day_first(value):
    rows, errors = parse_transactions_with_errors("bank.csv", csv("date,description,amount", f"{value},a,1"))

    assert errors == []
    assert rows[0]["date"] == datetime.date(2025, 4, 3)


def test_month_first_slash_date_is_a_row_error_and_other_rows_still_parse():
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount", "01/15/2025,a,1", "02/01/2025,b,2")
    )

    assert errors == [{"row": 2, "message": 'Invalid date "01/15/2025": use DD/MM/YYYY'}]
    assert [row["date"] for row in rows] == [datetime.date(2025, 1, 2)]


def test_blank_description_is_a_row_error():
    rows, errors = parse_transactions_with_errors("bank.csv", csv("date,description,amount", "2025-01-01,,1"))

    assert rows == []
    assert errors == [{"row": 2, "message": "Description cannot be empty"}]


def test_whitespace_description_is_a_row_error():
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount", '2025-01-01,"   ",1')
    )

    assert rows == []
    assert errors == [{"row": 2, "message": "Description cannot be empty"}]


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("", "Amount cannot be empty"),
        ("abc", 'Invalid amount "abc"'),
        ("inf", 'Invalid amount "inf"'),
    ],
)
def test_bad_amount_is_a_row_error_and_other_rows_still_parse(value, message):
    rows, errors = parse_transactions_with_errors(
        "bank.csv", csv("date,description,amount", f"2025-01-01,a,{value}", "2025-01-02,b,2")
    )

    assert errors == [{"row": 2, "message": message}]
    assert [row["description"] for row in rows] == ["b"]


def test_column_mapping_selects_custom_headers_case_insensitively():
    rows, errors = parse_transactions_with_errors(
        "bank.csv",
        csv("Fecha,Concepto,Importe,Divisa", "2025-03-01,Bar,-12.30,EUR"),
        {"date": "fecha", "description": "CONCEPTO", "amount": "Importe", "currency": "divisa"},
    )

    assert errors == []
    assert rows == [
        {
            "date": datetime.date(2025, 3, 1),
            "description": "Bar",
            "amount": Decimal("-12.30"),
            "currency": "EUR",
            "tag_id": None,
            "row": 2,
        }
    ]


def test_headers_are_matched_case_insensitively_without_a_mapping():
    rows, errors = parse_transactions_with_errors("bank.csv", csv("Date,DESCRIPTION,Amount", "2025-01-01,a,1"))

    assert errors == []
    assert rows[0]["description"] == "a"


def test_missing_required_column_raises():
    with pytest.raises(ValueError, match="Missing required columns: amount"):
        parse_transactions_with_errors("bank.csv", csv("date,description", "2025-01-01,a"))


def test_mapping_to_an_absent_column_counts_as_missing():
    with pytest.raises(ValueError, match="Missing required columns: amount"):
        parse_transactions_with_errors(
            "bank.csv",
            csv("date,description,amount", "2025-01-01,a,1"),
            {"date": "date", "description": "description", "amount": "importe"},
        )


def test_unsupported_extension_raises():
    with pytest.raises(ValueError, match="Unsupported file format"):
        parse_transactions_with_errors("bank.txt", b"")


def test_xlsx_rows_parse_date_cells_text_dates_and_blank_currency():
    rows, errors = parse_transactions_with_errors(
        "bank.xlsx",
        xlsx(
            ["Date", "Description", "Amount", "Currency", "Tag_ID"],
            [datetime.date(2025, 5, 6), "Market", -45.2, "EUR", 4],
            ["2025-05-07", "Gift", 100, None, None],
        ),
    )

    assert errors == []
    assert rows == [
        {
            "date": datetime.date(2025, 5, 6),
            "description": "Market",
            "amount": Decimal("-45.2"),
            "currency": "EUR",
            "tag_id": 4,
            "row": 2,
        },
        {
            "date": datetime.date(2025, 5, 7),
            "description": "Gift",
            "amount": Decimal("100"),
            "currency": None,
            "tag_id": None,
            "row": 3,
        },
    ]


def test_upload_parser_returns_rows_without_row_numbers():
    rows = parse_transactions_from_upload("bank.csv", csv("date,description,amount", "2025-01-01,a,1.25"))

    assert rows == [
        {
            "date": datetime.date(2025, 1, 1),
            "description": "a",
            "amount": Decimal("1.25"),
            "currency": None,
            "tag_id": None,
        }
    ]
