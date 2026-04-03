from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TransactionCreate(BaseModel):
    date: date
    description: str
    account_id: int
    tag_id: int | None = None
    is_transfer: bool = False
    destination_account_id: int | None = None
    amount: Decimal
    currency: str | None = None


class TransactionUpdate(BaseModel):
    date: date
    description: str
    account_id: int
    tag_id: int | None = None
    is_transfer: bool = False
    destination_account_id: int | None = None
    amount: Decimal
    currency: str | None = None


class TransactionResponse(BaseModel):
    id: int
    date: date
    description: str
    account_id: int
    tag_id: int | None
    amount: Decimal
    currency: str
    is_transfer: bool
    transfer_group_id: str | None
    transfer_direction: str | None
    linked_account_id: int | None
    parent_transaction_id: int | None

    class Config:
        from_attributes = True


class DashboardSummary(BaseModel):
    current_month_income: Decimal
    current_month_expenses: Decimal
    current_month_net: Decimal
    latest_transactions: list[TransactionResponse]


class DashboardPatrimonyPoint(BaseModel):
    year: int
    patrimony: Decimal


class DashboardIncomeExpensePoint(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal
    net_trend: Decimal


class DashboardCharts(BaseModel):
    patrimony_by_year: list[DashboardPatrimonyPoint]
    income_vs_expenses_last_12_months: list[DashboardIncomeExpensePoint]


class PaginatedTransactionsResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class MonthlyAnalyticsItem(BaseModel):
    label: str
    total_expense: Decimal


class MonthlyAnalyticsResponse(BaseModel):
    by_tag: list[MonthlyAnalyticsItem]
    by_account: list[MonthlyAnalyticsItem]


class TagMonthlyTrendItem(BaseModel):
    month: str
    total_expense: Decimal


class TagMonthlyTrendResponse(BaseModel):
    tag_id: int
    points: list[TagMonthlyTrendItem]


class MonthlySummaryCard(BaseModel):
    income: Decimal
    expenses: Decimal
    net: Decimal


class MonthlyAccountSummary(BaseModel):
    account_id: int
    account_name: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class MonthlySummaryResponse(BaseModel):
    overall: MonthlySummaryCard
    by_account: list[MonthlyAccountSummary]


class ImportPreviewItem(BaseModel):
    row: int
    date: date
    description: str
    amount: Decimal
    currency: str | None
    tag_id: int | None
    status: str
    message: str | None = None


class ImportPreviewError(BaseModel):
    row: int
    message: str


class ImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    preview: list[ImportPreviewItem]
    errors: list[ImportPreviewError]


class SplitTransactionItem(BaseModel):
    id: int | None = None
    description: str
    amount: Decimal
    tag_id: int | None = None


class SplitTransactionRequest(BaseModel):
    rows: list[SplitTransactionItem]


class SplitTransactionResponse(BaseModel):
    parent: TransactionResponse
    rows: list[TransactionResponse]
    remaining_amount: Decimal
