"""Per-currency grouping for balances and transaction totals.

Amounts in different currencies are never added together. Every function here
takes already-loaded rows and returns lists sorted by currency.
"""

from collections import defaultdict
from collections.abc import Iterable
from datetime import date
from decimal import Decimal

CENTS = Decimal("0.01")


def money(value: Decimal | int | None) -> Decimal:
    """Normalize a SQL sum (which may be None or a bare 0) to two decimal places."""
    return Decimal(value or 0).quantize(CENTS)


def balance_totals(balances: Iterable[tuple[str, Decimal]]) -> list[dict]:
    """Sum `(currency, balance)` pairs per currency."""
    totals: dict[str, Decimal] = defaultdict(Decimal)
    for currency, balance in balances:
        totals[currency] += money(balance)
    return [{"currency": c, "balance": money(totals[c])} for c in sorted(totals)]


def last_12_months(today: date) -> list[tuple[int, int]]:
    """The 12 calendar months ending with today's month, oldest first, as (year, month)."""
    months = []
    year, month = today.year, today.month
    for _ in range(12):
        months.append((year, month))
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return list(reversed(months))


def trend_series(rows: Iterable[tuple[str, int, int, Decimal]], months: list[tuple[int, int]]) -> list[dict]:
    """Build one 12-point series per currency from `(currency, year, month, total)` rows.

    Currencies whose totals are all zero are left out. Missing months are zero.
    """
    by_currency: dict[str, dict[tuple[int, int], Decimal]] = defaultdict(dict)
    for currency, year, month, total in rows:
        by_currency[currency][(int(year), int(month))] = money(total)

    series = []
    for currency in sorted(by_currency):
        totals = by_currency[currency]
        if not any(totals.values()):
            continue
        series.append(
            {
                "currency": currency,
                "points": [
                    {"month": f"{y}-{m:02d}", "total_expense": totals.get((y, m), money(0))}
                    for y, m in months
                ],
            }
        )
    return series
