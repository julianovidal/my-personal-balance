"""Balances and transaction totals are grouped by currency, never added across currencies.

Spec: specs/per-currency-balances-and-transaction-totals.md
"""

from datetime import date
from decimal import Decimal

from app.core.security import create_access_token
from app.models import Account, Tag, Transaction, User
from app.services.currency_totals import balance_totals, last_12_months, money, trend_series

D = Decimal
PERIOD = {"date_from": "2026-01-01", "date_to": "2026-01-31"}


# --- pure functions ---------------------------------------------------------


def test_money_normalizes_sql_sums():
    assert str(money(None)) == "0.00"
    assert str(money(0)) == "0.00"
    assert str(money(D("12.5"))) == "12.50"


def test_balance_totals_keeps_currencies_apart():
    totals = balance_totals([("EUR", D("10.00")), ("BRL", D("5.00")), ("EUR", D("2.50"))])
    assert totals == [{"currency": "BRL", "balance": D("5.00")}, {"currency": "EUR", "balance": D("12.50")}]


def test_last_12_months_crosses_the_year():
    months = last_12_months(date(2026, 3, 15))
    assert len(months) == 12
    assert months[0] == (2025, 4)
    assert months[-1] == (2026, 3)


def test_trend_series_fills_months_and_drops_zero_currencies():
    months = last_12_months(date(2026, 3, 1))
    series = trend_series([("EUR", 2026, 3, D("4")), ("BRL", 2026, 1, D("0"))], months)
    assert [s["currency"] for s in series] == ["EUR"]
    points = series[0]["points"]
    assert len(points) == 12
    assert points[-1] == {"month": "2026-03", "total_expense": D("4.00")}
    assert points[0]["total_expense"] == D("0.00")


# --- API --------------------------------------------------------------------


def tx(account, amount, when=date(2026, 1, 10), currency=None, tag=None, **extra):
    return Transaction(
        date=when,
        description="row",
        account_id=account.id,
        amount=D(amount),
        currency=currency or account.currency,
        tag_id=tag.id if tag else None,
        **extra,
    )


def seed(db):
    user = User(name="Ana", email="ana@example.com", password="x")
    other = User(name="Bo", email="bo@example.com", password="x")
    db.add_all([user, other])
    db.flush()
    eur = Account(name="Main", currency="EUR", user_id=user.id)
    eur_twin = Account(name="Main", currency="EUR", user_id=user.id)
    brl = Account(name="Brasil", currency="BRL", user_id=user.id)
    empty = Account(name="Empty", currency="USD", user_id=user.id)
    foreign = Account(name="Theirs", currency="EUR", user_id=other.id)
    db.add_all([eur, eur_twin, brl, empty, foreign])
    db.flush()
    food = Tag(label="Food", user_id=user.id)
    db.add(food)
    db.flush()
    db.add_all(
        [
            tx(eur, "1000.00"),
            tx(eur, "-40.00", tag=food),
            # An imported BRL row on the EUR account: counted as BRL in totals.
            tx(eur, "-15.00", currency="BRL", tag=food),
            tx(eur_twin, "-10.00"),
            tx(brl, "500.00"),
            tx(brl, "-100.00", tag=food),
            tx(foreign, "-999.00"),
        ]
    )
    db.commit()
    return user, {"eur": eur, "eur_twin": eur_twin, "brl": brl, "empty": empty}, food


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_balances_are_strings_grouped_by_account_currency(client, db):
    user, accounts, _ = seed(db)
    body = client.get("/api/accounts/balances", headers=auth(user)).json()

    assert "overall_balance" not in body
    # Account balances use the account's currency, so the BRL row on the EUR account stays in EUR.
    assert body["totals"] == [
        {"currency": "BRL", "balance": "400.00"},
        {"currency": "EUR", "balance": "935.00"},
        {"currency": "USD", "balance": "0.00"},
    ]
    by_id = {row["account_id"]: row for row in body["by_account"]}
    assert by_id[accounts["eur"].id]["balance"] == "945.00"
    assert by_id[accounts["empty"].id]["balance"] == "0.00"
    assert len(by_id) == 4


def test_summary_totals_per_transaction_currency(client, db):
    user, accounts, _ = seed(db)
    body = client.get("/api/transactions/summary/monthly", params=PERIOD, headers=auth(user)).json()

    assert "overall" not in body
    assert body["totals"] == [
        {"currency": "BRL", "income": "500.00", "expenses": "115.00", "net": "385.00"},
        {"currency": "EUR", "income": "1000.00", "expenses": "50.00", "net": "950.00"},
    ]
    eur_rows = [r for r in body["by_account"] if r["account_id"] == accounts["eur"].id]
    assert sorted(r["currency"] for r in eur_rows) == ["BRL", "EUR"]


def test_summary_with_no_rows_has_no_totals(client, db):
    user, _, _ = seed(db)
    params = {"date_from": "2020-01-01", "date_to": "2020-01-31"}
    body = client.get("/api/transactions/summary/monthly", params=params, headers=auth(user)).json()
    assert body == {"totals": [], "by_account": []}


def test_analytics_groups_by_currency_and_account_id(client, db):
    user, accounts, _ = seed(db)
    body = client.get("/api/transactions/analytics/monthly", params=PERIOD, headers=auth(user)).json()

    food = [(r["currency"], r["total_expense"]) for r in body["by_tag"] if r["label"] == "Food"]
    assert food == [("BRL", "115.00"), ("EUR", "40.00")]

    eur_accounts = [r for r in body["by_account"] if r["currency"] == "EUR"]
    assert {r["account_id"] for r in eur_accounts} == {accounts["eur"].id, accounts["eur_twin"].id}
    assert all(r["label"] == "Main" for r in eur_accounts)
    assert [r["currency"] for r in body["by_account"]] == sorted(r["currency"] for r in body["by_account"])


def test_tag_trend_has_one_series_per_currency(client, db):
    user, _, food = seed(db)
    # Move the rows into the trend window, which ends with today's month.
    this_month = date.today().replace(day=1)
    db.query(Transaction).update({Transaction.date: this_month})
    db.commit()

    body = client.get("/api/transactions/analytics/tag-trend", params={"tag_id": food.id}, headers=auth(user)).json()

    assert "points" not in body
    assert [s["currency"] for s in body["series"]] == ["BRL", "EUR"]
    for series in body["series"]:
        assert len(series["points"]) == 12
    assert body["series"][0]["points"][-1]["total_expense"] == "115.00"
    assert body["series"][1]["points"][-1]["total_expense"] == "40.00"


def test_no_other_users_data(client, db):
    user, _, _ = seed(db)
    balances = client.get("/api/accounts/balances", headers=auth(user)).json()
    summary = client.get("/api/transactions/summary/monthly", params=PERIOD, headers=auth(user)).json()
    analytics = client.get("/api/transactions/analytics/monthly", params=PERIOD, headers=auth(user)).json()

    assert "Theirs" not in {r["account_name"] for r in balances["by_account"]}
    assert "Theirs" not in {r["account_name"] for r in summary["by_account"]}
    assert all(r["total_expense"] != "999.00" for r in analytics["by_account"])
