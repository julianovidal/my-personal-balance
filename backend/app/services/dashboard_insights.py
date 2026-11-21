"""Dashboard insights: "am I spending more than usual?" and "is anything unusual?".

Everything is anchored on the newest non-transfer transaction date ("data
through"), not on today, because imports arrive weeks late. Transfers are
entered by hand, so they do not say how far an import got. Rules are pure functions over plain
rows so they can be tested without a database; `load_rows` is the only part
that touches SQL.

Definitions used throughout:

* Effective rows: split children replace their parent. When the children add
  up to less than the parent, the difference is kept as an untagged
  "remainder" row so no money disappears.
* Spending: expenses (negative amounts) that are not transfers, before
  refunds, grouped by the transaction's own currency. Currencies are never
  added together.
* Month-to-date: day 1 up to the anchor's day of month. Earlier months are cut
  at the same day, so a partly imported month is compared like for like.
* Baseline: up to 6 earlier months that have data in that currency. Months
  with no data are skipped, not counted as zero.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.tag import Tag
from app.models.transaction import Transaction

BASELINE_MONTHS = 6
MIN_BASELINE_MONTHS = 3
SPIKE_RATIO = Decimal("1.5")
NEW_SPEND_FLOOR_FACTOR = Decimal("2")
LARGE_EXPENSE_RATIO = Decimal("3")
MIN_HISTORY_EXPENSES = 5
STALE_AFTER_DAYS = 7
# Accounts this far behind are treated as closed or unused, not as a late import.
INACTIVE_AFTER_DAYS = 90
MAX_SIGNALS = 5
TOP_EXPENSES = 5
TREND_MONTHS = 12

# Smallest difference worth flagging, per currency (roughly equal value).
NOISE_FLOOR = {"EUR": Decimal("50"), "USD": Decimal("50"), "BRL": Decimal("250")}
DEFAULT_FLOOR = Decimal("50")


@dataclass(frozen=True)
class Row:
    id: int
    date: date
    description: str
    account_id: int
    tag_id: int | None
    amount: Decimal
    currency: str
    is_transfer: bool
    transfer_direction: str | None
    linked_account_id: int | None
    parent_transaction_id: int | None
    is_remainder: bool = False


# ---------------------------------------------------------------- helpers


def month_key(value: date) -> str:
    return f"{value.year}-{value.month:02d}"


def month_start(key: str) -> date:
    year, month = key.split("-")
    return date(int(year), int(month), 1)


def shift_month(key: str, months: int) -> str:
    start = month_start(key)
    index = start.year * 12 + (start.month - 1) + months
    return f"{index // 12}-{index % 12 + 1:02d}"


def cutoff_day(key: str, day: int) -> int:
    start = month_start(key)
    return min(day, calendar.monthrange(start.year, start.month)[1])


def floor_for(currency: str) -> Decimal:
    return NOISE_FLOOR.get(currency, DEFAULT_FLOOR)


def decimal_median(values: list[Decimal]) -> Decimal | None:
    if not values:
        return None
    return Decimal(median(values)).quantize(Decimal("0.01"))


# ---------------------------------------------------------- effective rows


def effective_rows(rows: list[Row]) -> list[Row]:
    """Split children replace their parent; a partly split parent leaves a remainder row."""
    child_sums: dict[int, Decimal] = defaultdict(Decimal)
    for row in rows:
        if row.parent_transaction_id is not None:
            child_sums[row.parent_transaction_id] += row.amount

    result: list[Row] = []
    for row in rows:
        if row.parent_transaction_id is None and row.id in child_sums:
            remainder = row.amount - child_sums[row.id]
            if remainder != 0:
                result.append(replace(row, amount=remainder, tag_id=None, is_remainder=True))
            continue
        result.append(row)
    return result


def spending_rows(rows: list[Row]) -> list[Row]:
    return [r for r in rows if not r.is_transfer and r.amount < 0]


# ------------------------------------------------------------------ anchor


def anchor_date(rows: list[Row]) -> date | None:
    dated = [r.date for r in rows if not r.is_transfer]
    return max(dated) if dated else None


def account_freshness(accounts: list[Account], rows: list[Row], anchor: date | None) -> list[dict]:
    last_by_account: dict[int, date] = {}
    for row in rows:
        if row.date > last_by_account.get(row.account_id, date.min):
            last_by_account[row.account_id] = row.date
    result = []
    for account in accounts:
        last = last_by_account.get(account.id)
        days_behind = (anchor - last).days if (anchor and last) else None
        result.append(
            {
                "account_id": account.id,
                "name": account.name,
                "currency": account.currency,
                "last_date": last,
                "days_behind": days_behind,
                "stale": days_behind is not None and STALE_AFTER_DAYS < days_behind <= INACTIVE_AFTER_DAYS,
                "inactive": days_behind is not None and days_behind > INACTIVE_AFTER_DAYS,
            }
        )
    result.sort(key=lambda a: (a["last_date"] is None, -(a["days_behind"] or 0), a["name"]))
    return result


# ---------------------------------------------------------------- baseline


def months_with_data(rows: list[Row], currency: str, before: str) -> list[str]:
    """Most recent first, up to BASELINE_MONTHS, strictly before `before`."""
    months = sorted(
        {month_key(r.date) for r in rows if r.currency == currency and not r.is_transfer and month_key(r.date) < before},
        reverse=True,
    )
    return months[:BASELINE_MONTHS]


def month_to_date(rows: list[Row], key: str, day: int) -> list[Row]:
    start = month_start(key)
    end = start.replace(day=cutoff_day(key, day))
    return [r for r in rows if start <= r.date <= end]


def in_month(rows: list[Row], key: str) -> list[Row]:
    return [r for r in rows if month_key(r.date) == key]


def total_spent(rows: list[Row]) -> Decimal:
    return sum((-r.amount for r in spending_rows(rows)), Decimal("0"))


def spent_by_tag(rows: list[Row]) -> dict[int | None, Decimal]:
    totals: dict[int | None, Decimal] = defaultdict(Decimal)
    for r in spending_rows(rows):
        totals[r.tag_id] += -r.amount
    return totals


# ----------------------------------------------------------------- signals


def tag_signals(
    current: dict[int | None, Decimal],
    baseline: list[dict[int | None, Decimal]],
    currency: str,
) -> list[dict]:
    """Tags well above their usual month-to-date spending. Untagged spending is not a tag."""
    if len(baseline) < MIN_BASELINE_MONTHS:
        return []
    floor = floor_for(currency)
    signals = []
    for tag_id, now in current.items():
        if tag_id is None:
            continue
        usual = decimal_median([month.get(tag_id, Decimal("0")) for month in baseline]) or Decimal("0")
        difference = now - usual
        if usual == 0:
            if now >= floor * NEW_SPEND_FLOOR_FACTOR:
                signals.append({"tag_id": tag_id, "kind": "new", "month_to_date": now, "usual": usual, "difference": difference})
        elif now >= usual * SPIKE_RATIO and difference >= floor:
            signals.append({"tag_id": tag_id, "kind": "spike", "month_to_date": now, "usual": usual, "difference": difference})
    signals.sort(key=lambda s: s["difference"], reverse=True)
    return signals[:MAX_SIGNALS]


def large_expenses(current: list[Row], history: list[Row], currency: str) -> list[dict]:
    """Single expenses far above what is typical for their tag (or for untagged spending)."""
    floor = floor_for(currency)
    by_tag: dict[int | None, list[Decimal]] = defaultdict(list)
    for r in spending_rows(history):
        by_tag[r.tag_id].append(-r.amount)

    found = []
    for r in spending_rows(current):
        amount = -r.amount
        past = by_tag.get(r.tag_id, [])
        if len(past) < MIN_HISTORY_EXPENSES:
            continue
        typical = decimal_median(past) or Decimal("0")
        if typical > 0 and amount >= typical * LARGE_EXPENSE_RATIO and amount >= floor:
            found.append(
                {
                    "row": r,
                    "typical": typical,
                    "ratio": (amount / typical).quantize(Decimal("0.1")),
                    "reason": "untagged" if r.tag_id is None else "tag",
                }
            )
    found.sort(key=lambda f: f["row"].amount)  # most negative (largest expense) first
    return found[:MAX_SIGNALS]


# ---------------------------------------------------------------- assembly


def currency_insights(rows: list[Row], currency: str, anchor: date) -> dict:
    own = [r for r in rows if r.currency == currency]
    key = month_key(anchor)
    day = anchor.day
    baseline_keys = months_with_data(own, currency, key)

    current_rows = month_to_date(own, key, day)
    baseline_mtd = [month_to_date(own, k, day) for k in baseline_keys]
    baseline_totals = [total_spent(m) for m in baseline_mtd]
    enough = len(baseline_keys) >= MIN_BASELINE_MONTHS

    spent = total_spent(current_rows)
    usual = decimal_median(baseline_totals) if enough else None
    full_month_usual = decimal_median([total_spent(in_month(own, k)) for k in baseline_keys]) if enough else None

    current_by_tag = spent_by_tag(current_rows)
    baseline_by_tag = [spent_by_tag(m) for m in baseline_mtd]
    history = [r for k in baseline_keys for r in in_month(own, k)]

    tags = []
    for tag_id, now in sorted(current_by_tag.items(), key=lambda kv: kv[1], reverse=True):
        tag_usual = decimal_median([m.get(tag_id, Decimal("0")) for m in baseline_by_tag]) if enough else None
        tags.append({"tag_id": tag_id, "month_to_date": now, "usual": tag_usual})

    trend = []
    for offset in range(TREND_MONTHS - 1, -1, -1):
        k = shift_month(key, -offset)
        month_rows = [r for r in in_month(own, k) if not r.is_transfer]
        income = sum((r.amount for r in month_rows if r.amount > 0), Decimal("0"))
        expenses = sum((-r.amount for r in month_rows if r.amount < 0), Decimal("0"))
        trend.append({"month": k, "income": income, "expenses": expenses, "net": income - expenses, "has_data": bool(month_rows)})

    top = sorted(spending_rows(current_rows), key=lambda r: r.amount)[:TOP_EXPENSES]

    return {
        "currency": currency,
        "baseline_months": baseline_keys,
        "spending": {
            "month_to_date": spent,
            "usual": usual,
            "difference": (spent - usual) if usual is not None else None,
            "full_month_usual": full_month_usual,
        },
        "income_to_date": sum((r.amount for r in current_rows if not r.is_transfer and r.amount > 0), Decimal("0")),
        "tags": tags,
        "signals": tag_signals(current_by_tag, baseline_by_tag, currency) if enough else [],
        "large_expenses": large_expenses(current_rows, history, currency),
        "top_expenses": top,
        "trend": trend,
    }


def build_insights(rows: list[Row], accounts: list[Account]) -> dict:
    effective = effective_rows(rows)
    anchor = anchor_date(effective)
    freshness = account_freshness(accounts, rows, anchor)
    if anchor is None:
        return {"anchor_date": None, "month": None, "is_partial_month": False, "accounts": freshness, "currencies": []}

    key = month_key(anchor)
    in_anchor_month = [r for r in month_to_date(effective, key, anchor.day) if not r.is_transfer]
    currencies = sorted({r.currency for r in in_anchor_month}, key=lambda c: -total_spent([r for r in in_anchor_month if r.currency == c]))
    last_day = calendar.monthrange(anchor.year, anchor.month)[1]
    return {
        "anchor_date": anchor,
        "month": key,
        "is_partial_month": anchor.day < last_day,
        "accounts": freshness,
        "currencies": [currency_insights(effective, c, anchor) for c in currencies],
    }


def balance_history(rows: list[Row], accounts: list[Account], anchor: date | None) -> list[dict]:
    """Month-end balance per account currency: the sum of top-level rows, like /accounts/balances."""
    currency_by_account = {a.id: a.currency for a in accounts}
    monthly: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for r in rows:
        if r.parent_transaction_id is not None or r.account_id not in currency_by_account:
            continue
        monthly[currency_by_account[r.account_id]][month_key(r.date)] += r.amount

    end = month_key(anchor) if anchor else None
    result = []
    for currency, by_month in sorted(monthly.items()):
        first = min(by_month)
        last = max(end or first, max(by_month))
        points, running, k = [], Decimal("0"), first
        while k <= last:
            running += by_month.get(k, Decimal("0"))
            points.append({"month": k, "balance": running})
            k = shift_month(k, 1)
        result.append({"currency": currency, "points": points})
    return result


# --------------------------------------------------------------------- SQL


def load_rows(db: Session, user_id: int) -> tuple[list[Row], list[Account]]:
    accounts = list(db.scalars(select(Account).where(Account.user_id == user_id).order_by(Account.name)).all())
    records = db.execute(
        select(
            Transaction.id,
            Transaction.date,
            Transaction.description,
            Transaction.account_id,
            Transaction.tag_id,
            Transaction.amount,
            Transaction.currency,
            Transaction.is_transfer,
            Transaction.transfer_direction,
            Transaction.linked_account_id,
            Transaction.parent_transaction_id,
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(Account.user_id == user_id)
    ).all()
    rows = [
        Row(
            id=r.id,
            date=r.date,
            description=r.description,
            account_id=r.account_id,
            tag_id=r.tag_id,
            amount=Decimal(r.amount),
            currency=r.currency,
            is_transfer=bool(r.is_transfer),
            transfer_direction=r.transfer_direction,
            linked_account_id=r.linked_account_id,
            parent_transaction_id=r.parent_transaction_id,
        )
        for r in records
    ]
    return rows, accounts


def tag_labels(db: Session, user_id: int) -> dict[int, str]:
    return {t.id: t.label for t in db.scalars(select(Tag).where(Tag.user_id == user_id)).all()}


def recent_rows(rows: list[Row], limit: int = 10) -> list[Row]:
    """Latest effective rows; a transfer pair shows once, from its outgoing side."""
    visible = [r for r in effective_rows(rows) if not r.is_transfer or r.transfer_direction == "out"]
    return sorted(visible, key=lambda r: (r.date, r.id), reverse=True)[:limit]

