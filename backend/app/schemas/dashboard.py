from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class InsightTransaction(BaseModel):
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
    # True for the unsplit part of a partly split transaction.
    is_remainder: bool = False


class AccountFreshness(BaseModel):
    account_id: int
    name: str
    currency: str
    last_date: date | None
    days_behind: int | None
    # 8 to 90 days behind the newest data: probably a late import.
    stale: bool
    # More than 90 days behind: treated as closed or unused.
    inactive: bool


class SpendingComparison(BaseModel):
    month_to_date: Decimal
    usual: Decimal | None
    difference: Decimal | None
    full_month_usual: Decimal | None


class TagSpending(BaseModel):
    tag_id: int | None
    label: str
    month_to_date: Decimal
    usual: Decimal | None


class TagSignal(BaseModel):
    tag_id: int
    label: str
    kind: Literal["spike", "new"]
    month_to_date: Decimal
    usual: Decimal
    difference: Decimal


class LargeExpense(BaseModel):
    transaction: InsightTransaction
    typical: Decimal
    ratio: Decimal
    reason: Literal["tag", "untagged"]


class TrendPoint(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    has_data: bool


class CurrencyInsights(BaseModel):
    currency: str
    baseline_months: list[str]
    spending: SpendingComparison
    income_to_date: Decimal
    tags: list[TagSpending]
    signals: list[TagSignal]
    large_expenses: list[LargeExpense]
    top_expenses: list[InsightTransaction]
    trend: list[TrendPoint]


class DashboardInsights(BaseModel):
    anchor_date: date | None
    month: str | None
    is_partial_month: bool
    accounts: list[AccountFreshness]
    currencies: list[CurrencyInsights]
    recent: list[InsightTransaction]


class BalancePoint(BaseModel):
    month: str
    balance: Decimal


class CurrencyBalanceHistory(BaseModel):
    currency: str
    points: list[BalancePoint]


class BalanceHistory(BaseModel):
    anchor_date: date | None
    series: list[CurrencyBalanceHistory]
