"""HTTP tests for /api/dashboard/insights and /api/dashboard/balance-history on Postgres."""

from datetime import date
from decimal import Decimal

from app.core.security import create_access_token
from app.models import Account, Tag, Transaction, User


def seed(db):
    user = User(name="Ana", email="ana@example.com", password="x")
    other = User(name="Bob", email="bob@example.com", password="x")
    db.add_all([user, other])
    db.flush()
    checking = Account(name="Checking", currency="EUR", user_id=user.id)
    savings = Account(name="Savings", currency="EUR", user_id=user.id)
    bobs = Account(name="Bob's", currency="EUR", user_id=other.id)
    food = Tag(label="Food", user_id=user.id)
    db.add_all([checking, savings, bobs, food])
    db.flush()

    def tx(day, amount, account=checking, tag=None, **kw):
        t = Transaction(
            date=day, description=kw.pop("description", f"tx {amount}"), account_id=account.id,
            tag_id=tag.id if tag else None, amount=Decimal(amount), currency="EUR", **kw,
        )
        db.add(t)
        return t

    for m in (6, 7, 8, 9):
        tx(date(2026, m, 3), "-60", tag=food)
        tx(date(2026, m, 4), "-40", tag=food)
        tx(date(2026, m, 1), "2000", description="Salary")
    tx(date(2026, 10, 4), "-400", tag=food, description="Feast")
    tx(date(2026, 10, 2), "-30", tag=food)
    # Transfer pair: not spending, shown once in recent.
    tx(date(2026, 10, 5), "-500", is_transfer=True, transfer_direction="out", transfer_group_id="g1", linked_account_id=savings.id)
    tx(date(2026, 10, 5), "500", account=savings, is_transfer=True, transfer_direction="in", transfer_group_id="g1", linked_account_id=checking.id)
    # Another user's data must never leak in.
    tx(date(2026, 11, 15), "-9999", account=bobs)
    db.commit()
    return user


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_insights_anchor_spending_and_signals(client, db):
    user = seed(db)
    res = client.get("/api/dashboard/insights", headers=auth(user))
    assert res.status_code == 200
    body = res.json()
    assert body["anchor_date"] == "2026-10-04"  # transfers do not move the anchor
    assert body["month"] == "2026-10"
    eur = body["currencies"][0]
    assert eur["baseline_months"] == ["2026-09", "2026-08", "2026-07", "2026-06"]
    assert Decimal(eur["spending"]["month_to_date"]) == Decimal("430")
    assert Decimal(eur["spending"]["usual"]) == Decimal("100")
    assert eur["signals"][0]["label"] == "Food"
    assert eur["signals"][0]["kind"] == "spike"
    assert eur["large_expenses"][0]["transaction"]["description"] == "Feast"
    assert len(eur["trend"]) == 12 and eur["trend"][-1]["month"] == "2026-10"
    recent_transfers = [r for r in body["recent"] if r["is_transfer"]]
    assert len(recent_transfers) == 1 and recent_transfers[0]["transfer_direction"] == "out"
    assert all(Decimal(r["amount"]) != Decimal("-9999") for r in body["recent"])


def test_balance_history_per_currency(client, db):
    user = seed(db)
    res = client.get("/api/dashboard/balance-history", headers=auth(user))
    assert res.status_code == 200
    body = res.json()
    assert body["anchor_date"] == "2026-10-04"  # transfers do not move the anchor
    points = body["series"][0]["points"]
    assert points[0] == {"month": "2026-06", "balance": "1900.00"}
    # 4 x (2000 - 100) - 430; the transfer pair cancels out across accounts.
    assert Decimal(points[-1]["balance"]) == Decimal("7170")


def test_insights_require_auth(client, db):
    assert client.get("/api/dashboard/insights").status_code in (401, 403)


def test_empty_user_gets_an_empty_dashboard(client, db):
    user = User(name="New", email="new@example.com", password="x")
    db.add(user)
    db.commit()
    body = client.get("/api/dashboard/insights", headers=auth(user)).json()
    assert body["anchor_date"] is None and body["currencies"] == [] and body["recent"] == []
