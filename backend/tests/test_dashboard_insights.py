"""Rules of app/services/dashboard_insights.py, without a database."""

from datetime import date
from decimal import Decimal
from itertools import count
from types import SimpleNamespace

from app.services.dashboard_insights import (
    Row,
    account_freshness,
    balance_history,
    build_insights,
    effective_rows,
    large_expenses,
    months_with_data,
    recent_rows,
    tag_signals,
)

_ids = count(1)
D = Decimal


def row(day: date, amount: str, *, tag=None, account=1, currency="EUR", parent=None, transfer=None, id=None):
    return Row(
        id=id or next(_ids),
        date=day,
        description=f"tx {amount}",
        account_id=account,
        tag_id=tag,
        amount=D(amount),
        currency=currency,
        is_transfer=transfer is not None,
        transfer_direction=transfer,
        linked_account_id=2 if transfer else None,
        parent_transaction_id=parent,
    )


ACCOUNTS = [SimpleNamespace(id=1, name="Checking", currency="EUR"), SimpleNamespace(id=2, name="Savings", currency="EUR")]


def months(*keys_and_amounts, tag=7, day=10):
    """One expense per month: months(("2026-01", "-100"), ...)."""
    out = []
    for key, amount in keys_and_amounts:
        y, m = map(int, key.split("-"))
        out.append(row(date(y, m, day), amount, tag=tag))
    return out


# ------------------------------------------------------------ effective rows


def test_split_children_replace_parent_and_keep_the_remainder():
    parent = row(date(2026, 3, 5), "-100.00", tag=1, id=500)
    a = row(date(2026, 3, 5), "-60.00", tag=2, parent=500)
    b = row(date(2026, 3, 5), "-30.00", tag=3, parent=500)
    result = effective_rows([parent, a, b])
    amounts = sorted(r.amount for r in result)
    assert amounts == [D("-60.00"), D("-30.00"), D("-10.00")]
    remainder = next(r for r in result if r.is_remainder)
    assert remainder.tag_id is None and remainder.id == 500


def test_fully_split_parent_leaves_no_remainder():
    parent = row(date(2026, 3, 5), "-100.00", id=600)
    child = row(date(2026, 3, 5), "-100.00", parent=600)
    assert effective_rows([parent, child]) == [child]


# -------------------------------------------------------------------- anchor


def test_anchor_is_the_newest_transaction_not_today():
    rows = months(("2026-09", "-10"), ("2026-10", "-10"))
    result = build_insights(rows, ACCOUNTS)
    assert result["anchor_date"] == date(2026, 10, 10)
    assert result["month"] == "2026-10"
    assert result["is_partial_month"] is True


def test_no_data_returns_an_empty_dashboard():
    result = build_insights([], ACCOUNTS)
    assert result["anchor_date"] is None and result["currencies"] == []


def test_freshness_separates_late_imports_from_inactive_accounts():
    anchor = date(2026, 10, 28)
    rows = [row(anchor, "-1", account=1), row(date(2026, 10, 1), "-1", account=2)]
    accounts = ACCOUNTS + [SimpleNamespace(id=3, name="Old", currency="EUR")]
    rows.append(row(date(2025, 1, 1), "-1", account=3))
    by_name = {a["name"]: a for a in account_freshness(accounts, rows, anchor)}
    assert by_name["Checking"]["stale"] is False and by_name["Checking"]["days_behind"] == 0
    assert by_name["Savings"]["stale"] is True and by_name["Savings"]["days_behind"] == 27
    assert by_name["Old"]["inactive"] is True and by_name["Old"]["stale"] is False


# ------------------------------------------------------------------ baseline


def test_baseline_skips_months_without_data_and_keeps_six():
    rows = months(*[(f"2026-{m:02d}", "-10") for m in (1, 2, 4, 5, 6, 7, 8, 9)])
    assert months_with_data(rows, "EUR", "2026-10") == ["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"]


def test_month_to_date_compares_the_same_days_of_earlier_months():
    rows = []
    for m in (6, 7, 8, 9):
        rows.append(row(date(2026, m, 5), "-100", tag=1))
        rows.append(row(date(2026, m, 25), "-900", tag=1))  # after day 10: must not count
    rows.append(row(date(2026, 10, 10), "-120", tag=1))
    eur = build_insights(rows, ACCOUNTS)["currencies"][0]
    assert eur["spending"]["month_to_date"] == D("120")
    assert eur["spending"]["usual"] == D("100.00")
    assert eur["spending"]["difference"] == D("20.00")
    assert eur["spending"]["full_month_usual"] == D("1000.00")


def test_no_comparison_with_fewer_than_three_baseline_months():
    rows = months(("2026-08", "-10"), ("2026-09", "-10"), ("2026-10", "-500"))
    eur = build_insights(rows, ACCOUNTS)["currencies"][0]
    assert eur["spending"]["usual"] is None
    assert eur["signals"] == []


def test_transfers_are_not_spending_and_currencies_stay_apart():
    rows = months(("2026-07", "-10"), ("2026-08", "-10"), ("2026-09", "-10"), ("2026-10", "-10"))
    rows.append(row(date(2026, 10, 9), "-1000", transfer="out"))
    rows.append(row(date(2026, 10, 9), "-300", currency="BRL"))
    result = build_insights(rows, ACCOUNTS)
    by_currency = {c["currency"]: c for c in result["currencies"]}
    assert by_currency["EUR"]["spending"]["month_to_date"] == D("10")
    assert by_currency["BRL"]["spending"]["month_to_date"] == D("300")
    # Sorted by how much was spent this month.
    assert [c["currency"] for c in result["currencies"]] == ["BRL", "EUR"]


# ------------------------------------------------------------------- signals


def test_spike_needs_the_ratio_and_the_floor():
    baseline = [{7: D("100")}, {7: D("100")}, {7: D("100")}]
    assert tag_signals({7: D("140")}, baseline, "EUR") == []  # below 1.5x
    assert tag_signals({7: D("110")}, [{7: D("70")}] * 3, "EUR") == []  # 1.57x but only 40 over a 50 floor
    spike = tag_signals({7: D("160")}, baseline, "EUR")
    assert spike[0]["kind"] == "spike" and spike[0]["difference"] == D("60")


def test_small_tags_do_not_spike_below_the_floor():
    assert tag_signals({7: D("12")}, [{7: D("2")}] * 3, "EUR") == []


def test_new_spending_on_a_tag_with_no_usual_spending():
    baseline = [{}, {}, {}]
    assert tag_signals({7: D("90")}, baseline, "EUR") == []
    new = tag_signals({7: D("120")}, baseline, "EUR")
    assert new[0]["kind"] == "new"


def test_floor_is_per_currency():
    baseline = [{7: D("100")}] * 3
    assert tag_signals({7: D("200")}, baseline, "EUR")  # +100 over a 50 floor
    assert tag_signals({7: D("200")}, baseline, "BRL") == []  # +100 under a 250 floor


def test_untagged_spending_is_never_a_tag_spike():
    assert tag_signals({None: D("5000")}, [{None: D("1")}] * 3, "EUR") == []


def test_large_expense_against_its_tag_history():
    history = [row(date(2026, 9, d), "-20", tag=3) for d in range(1, 7)]
    current = [row(date(2026, 10, 2), "-25", tag=3), row(date(2026, 10, 3), "-90", tag=3)]
    found = large_expenses(current, history, "EUR")
    assert [f["row"].amount for f in found] == [D("-90")]
    assert found[0]["typical"] == D("20.00") and found[0]["ratio"] == D("4.5")


def test_large_expense_needs_enough_history_and_the_floor():
    few = [row(date(2026, 9, d), "-5", tag=3) for d in range(1, 4)]
    assert large_expenses([row(date(2026, 10, 2), "-500", tag=3)], few, "EUR") == []
    cheap = [row(date(2026, 9, d), "-2", tag=3) for d in range(1, 7)]
    assert large_expenses([row(date(2026, 10, 2), "-20", tag=3)], cheap, "EUR") == []  # 10x but under 50


def test_large_untagged_expense_is_flagged():
    history = [row(date(2026, 9, d), "-15") for d in range(1, 8)]
    found = large_expenses([row(date(2026, 10, 2), "-400")], history, "EUR")
    assert found[0]["reason"] == "untagged"


# ------------------------------------------------------------ balance/recent


def test_balance_history_is_cumulative_and_fills_empty_months():
    rows = [row(date(2026, 1, 5), "100"), row(date(2026, 3, 5), "-30")]
    series = balance_history(rows, ACCOUNTS, date(2026, 4, 1))
    assert series == [
        {
            "currency": "EUR",
            "points": [
                {"month": "2026-01", "balance": D("100")},
                {"month": "2026-02", "balance": D("100")},
                {"month": "2026-03", "balance": D("70")},
                {"month": "2026-04", "balance": D("70")},
            ],
        }
    ]


def test_balance_history_counts_split_parents_once():
    parent = row(date(2026, 1, 5), "-100", id=900)
    child = row(date(2026, 1, 5), "-100", parent=900)
    assert balance_history([parent, child], ACCOUNTS, date(2026, 1, 5))[0]["points"][-1]["balance"] == D("-100")


def test_recent_shows_a_transfer_pair_once():
    out = row(date(2026, 1, 5), "-50", transfer="out")
    incoming = row(date(2026, 1, 5), "50", transfer="in", account=2)
    assert recent_rows([out, incoming]) == [out]
