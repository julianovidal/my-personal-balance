from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import and_, case, extract, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.dashboard import BalanceHistory, DashboardInsights
from app.services import dashboard_insights as insights_service
from app.schemas.transaction import (
    DashboardCharts,
    DashboardIncomeExpensePoint,
    DashboardPatrimonyPoint,
    DashboardSummary,
    TransactionResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    split_child = aliased(Transaction)
    has_split_children = (
        select(1)
        .select_from(split_child)
        .where(split_child.parent_transaction_id == Transaction.id)
        .exists()
    )
    effective_condition = or_(Transaction.parent_transaction_id.is_not(None), ~has_split_children)

    income_expr = func.coalesce(func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)), 0)
    expense_expr = func.coalesce(func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0)), 0)
    net_expr = func.coalesce(func.sum(Transaction.amount), 0)

    current_month_row = db.execute(
        select(
            income_expr.label("income"),
            expense_expr.label("expenses"),
            net_expr.label("net"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Account.user_id == current_user.id,
            Transaction.is_transfer.is_(False),
            extract("month", Transaction.date) == today.month,
            extract("year", Transaction.date) == today.year,
            effective_condition,
        )
    ).one()

    latest = db.scalars(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Account.user_id == current_user.id,
            effective_condition,
            or_(
                Transaction.is_transfer.is_(False),
                and_(Transaction.is_transfer.is_(True), Transaction.transfer_direction == "out"),
            ),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(10)
    ).all()

    return DashboardSummary(
        current_month_income=current_month_row.income,
        current_month_expenses=current_month_row.expenses,
        current_month_net=current_month_row.net,
        latest_transactions=[TransactionResponse.model_validate(t) for t in latest],
    )


@router.get("/charts", response_model=DashboardCharts)
def charts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    split_child = aliased(Transaction)
    has_split_children = (
        select(1)
        .select_from(split_child)
        .where(split_child.parent_transaction_id == Transaction.id)
        .exists()
    )
    effective_condition = or_(Transaction.parent_transaction_id.is_not(None), ~has_split_children)

    yearly_rows = db.execute(
        select(
            extract("year", Transaction.date).label("year"),
            func.coalesce(func.sum(Transaction.amount), 0).label("net"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Account.user_id == current_user.id,
            Transaction.is_transfer.is_(False),
            effective_condition,
        )
        .group_by(extract("year", Transaction.date))
        .order_by(extract("year", Transaction.date))
    ).all()

    patrimony_by_year: list[DashboardPatrimonyPoint] = []
    cumulative = Decimal("0")
    if yearly_rows:
        first_year = int(yearly_rows[0].year)
        net_by_year = {int(row.year): Decimal(row.net or 0) for row in yearly_rows}
        for year in range(first_year, today.year + 1):
            cumulative += net_by_year.get(year, Decimal("0"))
            patrimony_by_year.append(DashboardPatrimonyPoint(year=year, patrimony=cumulative))

    start_month = date(today.year, today.month, 1)
    month_keys: list[tuple[int, int]] = []
    for index in range(11, -1, -1):
        year = start_month.year
        month = start_month.month - index
        while month <= 0:
            year -= 1
            month += 12
        month_keys.append((year, month))

    start_year, start_month_num = month_keys[0]
    monthly_rows = db.execute(
        select(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            func.coalesce(func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)), 0).label("income"),
            func.coalesce(func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0)), 0).label("expenses"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Account.user_id == current_user.id,
            Transaction.is_transfer.is_(False),
            effective_condition,
            or_(
                extract("year", Transaction.date) > start_year,
                and_(
                    extract("year", Transaction.date) == start_year,
                    extract("month", Transaction.date) >= start_month_num,
                ),
            ),
        )
        .group_by(extract("year", Transaction.date), extract("month", Transaction.date))
    ).all()

    monthly_map: dict[tuple[int, int], tuple[Decimal, Decimal]] = {}
    for row in monthly_rows:
        key = (int(row.year), int(row.month))
        monthly_map[key] = (Decimal(row.income or 0), Decimal(row.expenses or 0))

    net_values: list[Decimal] = []
    monthly_points: list[DashboardIncomeExpensePoint] = []
    for year, month in month_keys:
        income, expenses = monthly_map.get((year, month), (Decimal("0"), Decimal("0")))
        net = income - expenses
        net_values.append(net)
        monthly_points.append(
            DashboardIncomeExpensePoint(
                month=f"{year}-{month:02d}",
                income=income,
                expenses=expenses,
                net=net,
                net_trend=Decimal("0"),
            )
        )

    if net_values:
        count = len(net_values)
        x_sum = sum(range(count))
        y_sum = sum(net_values, Decimal("0"))
        xx_sum = sum((x * x for x in range(count)))
        xy_sum = sum((Decimal(index) * value for index, value in enumerate(net_values)), Decimal("0"))
        denominator = Decimal(count * xx_sum - x_sum * x_sum)
        slope = Decimal("0") if denominator == 0 else (Decimal(count) * xy_sum - Decimal(x_sum) * y_sum) / denominator
        intercept = (y_sum - slope * Decimal(x_sum)) / Decimal(count)

        for index, point in enumerate(monthly_points):
            point.net_trend = slope * Decimal(index) + intercept

    return DashboardCharts(
        patrimony_by_year=patrimony_by_year,
        income_vs_expenses_last_12_months=monthly_points,
    )


UNTAGGED = "Untagged"


def _tx(row: insights_service.Row) -> dict:
    return {
        "id": row.id,
        "date": row.date,
        "description": row.description,
        "account_id": row.account_id,
        "tag_id": row.tag_id,
        "amount": row.amount,
        "currency": row.currency,
        "is_transfer": row.is_transfer,
        "transfer_direction": row.transfer_direction,
        "linked_account_id": row.linked_account_id,
        "parent_transaction_id": row.parent_transaction_id,
        "is_remainder": row.is_remainder,
    }


@router.get("/insights", response_model=DashboardInsights)
def insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows, accounts = insights_service.load_rows(db, current_user.id)
    labels = insights_service.tag_labels(db, current_user.id)
    data = insights_service.build_insights(rows, accounts)

    def label(tag_id: int | None) -> str:
        return UNTAGGED if tag_id is None else labels.get(tag_id, UNTAGGED)

    for c in data["currencies"]:
        c["tags"] = [{**t, "label": label(t["tag_id"])} for t in c["tags"]]
        c["signals"] = [{**s, "label": label(s["tag_id"])} for s in c["signals"]]
        c["large_expenses"] = [{**{k: v for k, v in e.items() if k != "row"}, "transaction": _tx(e["row"])} for e in c["large_expenses"]]
        c["top_expenses"] = [_tx(r) for r in c["top_expenses"]]

    data["recent"] = [_tx(r) for r in insights_service.recent_rows(rows)]
    return data


@router.get("/balance-history", response_model=BalanceHistory)
def balance_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows, accounts = insights_service.load_rows(db, current_user.id)
    anchor = insights_service.anchor_date(insights_service.effective_rows(rows))
    return {"anchor_date": anchor, "series": insights_service.balance_history(rows, accounts, anchor)}
