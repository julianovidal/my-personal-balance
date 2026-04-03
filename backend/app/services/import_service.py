from datetime import date
from decimal import Decimal
import io

import pandas as pd

from app.core.currency import normalize_currency


REQUIRED_COLUMNS = {"date", "description", "amount"}
OPTIONAL_COLUMNS = {"currency", "tag_id"}


def parse_transactions_from_upload(filename: str, content: bytes, column_mapping: dict[str, str] | None = None) -> list[dict]:
    df, normalized = _read_upload_dataframe(filename, content, column_mapping)
    return _parse_rows(df, normalized)


def parse_transactions_with_errors(
    filename: str,
    content: bytes,
    column_mapping: dict[str, str] | None = None,
) -> tuple[list[dict], list[dict]]:
    df, normalized = _read_upload_dataframe(filename, content, column_mapping)
    parsed_rows: list[dict] = []
    errors: list[dict] = []

    for index, row in df.iterrows():
        row_number = int(index) + 2
        try:
            parsed = _parse_single_row(row, normalized)
            parsed["row"] = row_number
            parsed_rows.append(parsed)
        except (ValueError, TypeError) as exc:
            errors.append({"row": row_number, "message": str(exc)})

    return parsed_rows, errors


def _read_upload_dataframe(
    filename: str,
    content: bytes,
    column_mapping: dict[str, str] | None = None,
) -> tuple[pd.DataFrame, dict[str, str]]:
    lowered = filename.lower()
    if lowered.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif lowered.endswith(".xlsx") or lowered.endswith(".xls"):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise ValueError("Unsupported file format. Use CSV or XLSX.")

    normalized = {str(c).strip().lower(): c for c in df.columns}
    selected_columns = _resolve_selected_columns(normalized, column_mapping)
    missing = REQUIRED_COLUMNS - set(selected_columns.keys())
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    return df, selected_columns


def _resolve_selected_columns(normalized: dict[str, str], column_mapping: dict[str, str] | None) -> dict[str, str]:
    if not column_mapping:
        return normalized

    resolved: dict[str, str] = {}
    for expected in REQUIRED_COLUMNS | OPTIONAL_COLUMNS:
        source_column = column_mapping.get(expected)
        if not source_column:
            continue
        key = source_column.strip().lower()
        if key in normalized:
            resolved[expected] = normalized[key]
    return resolved


def _parse_rows(df: pd.DataFrame, normalized: dict[str, str]) -> list[dict]:
    result = []
    for _, row in df.iterrows():
        result.append(_parse_single_row(row, normalized))
    return result


def _parse_single_row(row: pd.Series, normalized: dict[str, str]) -> dict:
    parsed_date = pd.to_datetime(row[normalized["date"]]).date()
    description = str(row[normalized["description"]]).strip()
    amount_value = Decimal(str(row[normalized["amount"]]))
    currency: str | None = None
    if "currency" in normalized:
        currency_value = row[normalized["currency"]]
        raw_currency = "" if pd.isna(currency_value) else str(currency_value).strip()
        if raw_currency:
            currency = normalize_currency(raw_currency)

    if not description:
        raise ValueError("Description cannot be empty")
    item = {
        "date": _ensure_date(parsed_date),
        "description": description,
        "amount": amount_value,
        "currency": currency,
        "tag_id": None,
    }
    if "tag_id" in normalized and pd.notna(row[normalized["tag_id"]]):
        item["tag_id"] = int(row[normalized["tag_id"]])
    return item


def _ensure_date(value: object) -> date:
    if isinstance(value, date):
        return value
    raise ValueError("Invalid date format")
