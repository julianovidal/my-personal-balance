from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, case, extract, func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.deps import get_current_user
from app.core.currency import normalize_currency
from app.core.database import get_db
from app.models.account import Account
from app.models.tag import Tag
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    ImportPreviewError,
    ImportPreviewItem,
    ImportPreviewResponse,
    MonthlyAccountSummary,
    MonthlyAnalyticsItem,
    MonthlyAnalyticsResponse,
    TagMonthlyTrendItem,
    TagMonthlyTrendResponse,
    MonthlySummaryCard,
    MonthlySummaryResponse,
    PaginatedTransactionsResponse,
    SplitTransactionRequest,
    SplitTransactionResponse,
    SplitTransactionItem,
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from app.services.import_service import parse_transactions_with_errors

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _validate_scoped_entities(account_id: int, tag_id: int | None, user_id: int, db: Session):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user_id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if tag_id is not None:
        tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id))
        if not tag:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tag for user")
    return account


def _build_transaction_filters(
    current_user: User,
    month: int | None,
    year: int | None,
    date_from: date | None = None,
    date_to: date | None = None,
    account_id: int | None = None,
    tag_id: int | None = None,
    include_transfers: bool = True,
):
    filters = [Account.user_id == current_user.id]
    if account_id:
        filters.append(Transaction.account_id == account_id)
    if tag_id:
        filters.append(Transaction.tag_id == tag_id)
    if not include_transfers:
        filters.append(Transaction.is_transfer.is_(False))
    if date_from:
        filters.append(Transaction.date >= date_from)
    if date_to:
        filters.append(Transaction.date <= date_to)
    if not date_from and not date_to:
        if month:
            filters.append(extract("month", Transaction.date) == month)
        if year:
            filters.append(extract("year", Transaction.date) == year)
    return filters


def _validate_destination_account(destination_account_id: int | None, user_id: int, db: Session) -> Account:
    if destination_account_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Destination account is required for transfers")

    destination = db.scalar(select(Account).where(Account.id == destination_account_id, Account.user_id == user_id))
    if not destination:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination account not found")
    return destination


def _save_transfer_pair(
    source_tx: Transaction,
    destination_tx: Transaction | None,
    *,
    source_account_id: int,
    destination_account_id: int,
    tx_date: date,
    description: str,
    amount: Decimal,
    currency: str,
    group_id: str,
    db: Session,
) -> Transaction:
    amount_abs = abs(amount)

    source_tx.date = tx_date
    source_tx.description = description
    source_tx.account_id = source_account_id
    source_tx.tag_id = None
    source_tx.amount = -amount_abs
    source_tx.currency = currency
    source_tx.is_transfer = True
    source_tx.transfer_group_id = group_id
    source_tx.transfer_direction = "out"
    source_tx.linked_account_id = destination_account_id
    source_tx.parent_transaction_id = None

    if destination_tx is None:
        destination_tx = Transaction()
        db.add(destination_tx)

    destination_tx.date = tx_date
    destination_tx.description = description
    destination_tx.account_id = destination_account_id
    destination_tx.tag_id = None
    destination_tx.amount = amount_abs
    destination_tx.currency = currency
    destination_tx.is_transfer = True
    destination_tx.transfer_group_id = group_id
    destination_tx.transfer_direction = "in"
    destination_tx.linked_account_id = source_account_id
    destination_tx.parent_transaction_id = None

    db.add(source_tx)
    return source_tx


def _clear_transfer_fields(tx: Transaction) -> None:
    tx.is_transfer = False
    tx.transfer_group_id = None
    tx.transfer_direction = None
    tx.linked_account_id = None


def _effective_transaction_condition():
    split_child = aliased(Transaction)
    has_split_children = (
        select(1)
        .select_from(split_child)
        .where(split_child.parent_transaction_id == Transaction.id)
        .exists()
    )
    return or_(Transaction.parent_transaction_id.is_not(None), ~has_split_children)


def _resolve_parent_transaction_id(tx: Transaction) -> int:
    return tx.parent_transaction_id or tx.id


def _validate_import_rows(
    rows: list[dict],
    parse_errors: list[dict],
    user_id: int,
    account_currency: str,
    default_tag_id: int | None,
    db: Session,
) -> tuple[list[dict], list[dict], list[dict]]:
    valid: list[dict] = []
    preview: list[dict] = []
    errors: list[dict] = list(parse_errors)

    valid_tag_ids = {t.id for t in db.scalars(select(Tag).where(Tag.user_id == user_id)).all()}
    if default_tag_id is not None:
        valid_tag_ids.add(default_tag_id)

    for idx, row in enumerate(rows):
        row_number = int(row.get("row") or (idx + 2))
        effective_tag_id = row.get("tag_id") or default_tag_id
        effective_currency = row.get("currency") or account_currency
        if effective_tag_id is not None and effective_tag_id not in valid_tag_ids:
            message = f"Tag {effective_tag_id} does not belong to this user"
            errors.append({"row": row_number, "message": message})
            preview.append(
                {
                    "row": row_number,
                    "date": row["date"],
                    "description": row["description"],
                    "amount": row["amount"],
                    "currency": effective_currency,
                    "tag_id": effective_tag_id,
                    "status": "error",
                    "message": message,
                }
            )
            continue

        valid.append({**row, "effective_tag_id": effective_tag_id, "effective_currency": effective_currency})
        preview.append(
            {
                "row": row_number,
                "date": row["date"],
                "description": row["description"],
                "amount": row["amount"],
                "currency": effective_currency,
                "tag_id": effective_tag_id,
                "status": "ok",
                "message": None,
            }
        )

    return valid, errors, preview


def _build_column_mapping_for_account(account: Account) -> dict[str, str] | None:
    mapping = account.import_mapping
    if not mapping:
        return None

    return {
        "date": mapping.date_column or "",
        "description": mapping.description_column or "",
        "amount": mapping.amount_column or "",
        "currency": mapping.currency_column or "",
        "tag_id": mapping.tag_id_column or "",
    }


@router.get("", response_model=PaginatedTransactionsResponse)
def list_transactions(
    account_id: int | None = None,
    tag_id: int | None = None,
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=1900, le=3000),
    date_from: date | None = None,
    date_to: date | None = None,
    search_text: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    sort_by: str = Query(default="date"),
    sort_order: str = Query(default="desc"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filters = _build_transaction_filters(current_user, month, year, date_from, date_to, account_id, tag_id)
    query = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(*filters, _effective_transaction_condition())
    )
    if account_id is None:
        query = query.where(
            or_(
                Transaction.is_transfer.is_(False),
                and_(Transaction.is_transfer.is_(True), Transaction.transfer_direction == "out"),
            )
        )

    sort_columns = {
        "date": Transaction.date,
        "amount": Transaction.amount,
        "description": Transaction.description,
        "currency": Transaction.currency,
    }
    selected_sort = sort_columns.get(sort_by, Transaction.date)
    is_asc = sort_order.lower() == "asc"
    all_items: list[Transaction | dict] = list(db.scalars(query).all())

    if tag_id is None:
        split_sums = db.execute(
            select(Transaction.parent_transaction_id, func.coalesce(func.sum(Transaction.amount), 0))
            .join(Account, Transaction.account_id == Account.id)
            .where(*filters, Transaction.parent_transaction_id.is_not(None))
            .group_by(Transaction.parent_transaction_id)
        ).all()
        parent_ids = [int(parent_id) for parent_id, _ in split_sums if parent_id is not None]

        if parent_ids:
            parent_query = (
                select(Transaction)
                .join(Account, Transaction.account_id == Account.id)
                .where(Transaction.id.in_(parent_ids), Account.user_id == current_user.id)
            )
            parents = {item.id: item for item in db.scalars(parent_query).all()}

            for parent_id, child_sum in split_sums:
                if parent_id is None:
                    continue
                parent = parents.get(int(parent_id))
                if not parent:
                    continue
                remainder = parent.amount - (child_sum or 0)
                if abs(remainder) > Decimal("0.0001"):
                    all_items.append(
                        {
                            "id": -parent.id,
                            "date": parent.date,
                            "description": "Missing Spllited Transactions",
                            "account_id": parent.account_id,
                            "tag_id": None,
                            "amount": remainder,
                            "currency": parent.currency,
                            "is_transfer": False,
                            "transfer_group_id": None,
                            "transfer_direction": None,
                            "linked_account_id": None,
                            "parent_transaction_id": parent.id,
                        }
                    )

    def _value(item: Transaction | dict, field: str):
        if isinstance(item, dict):
            return item.get(field)
        return getattr(item, field)

    if search_text and search_text.strip():
        needle = search_text.strip().lower()
        all_items = [
            item
            for item in all_items
            if needle in str(_value(item, "description") or "").lower()
        ]

    all_items.sort(
        key=lambda item: (_value(item, sort_by), _value(item, "id")),
        reverse=not is_asc,
    )

    total = len(all_items)
    offset = (page - 1) * page_size
    paged_items = all_items[offset:offset + page_size]
    total_pages = (total + page_size - 1) // page_size if total else 0

    return PaginatedTransactionsResponse(
        items=[TransactionResponse.model_validate(tx) for tx in paged_items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/summary/monthly", response_model=MonthlySummaryResponse)
def monthly_summary(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=1900, le=3000),
    date_from: date | None = None,
    date_to: date | None = None,
    account_id: int | None = None,
    tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filters = _build_transaction_filters(
        current_user,
        month,
        year,
        date_from,
        date_to,
        account_id,
        tag_id,
        include_transfers=account_id is not None,
    )

    income_expr = func.coalesce(func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)), 0)
    expense_expr = func.coalesce(func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0)), 0)
    net_expr = func.coalesce(func.sum(Transaction.amount), 0)

    overall = db.execute(
        select(income_expr.label("income"), expense_expr.label("expenses"), net_expr.label("net"))
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(*filters, _effective_transaction_condition())
    ).one()

    by_account_rows = db.execute(
        select(
            Account.id,
            Account.name,
            income_expr.label("income"),
            expense_expr.label("expenses"),
            net_expr.label("net"),
        )
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(*filters, _effective_transaction_condition())
        .group_by(Account.id, Account.name)
        .order_by(Account.name.asc())
    ).all()

    return MonthlySummaryResponse(
        overall=MonthlySummaryCard(income=overall.income, expenses=overall.expenses, net=overall.net),
        by_account=[
            MonthlyAccountSummary(
                account_id=account_id,
                account_name=account_name,
                income=income,
                expenses=expenses,
                net=net,
            )
            for account_id, account_name, income, expenses, net in by_account_rows
        ],
    )


@router.get("/analytics/monthly", response_model=MonthlyAnalyticsResponse)
def monthly_analytics(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=1900, le=3000),
    date_from: date | None = None,
    date_to: date | None = None,
    account_id: int | None = None,
    tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_filters = _build_transaction_filters(
        current_user,
        month,
        year,
        date_from,
        date_to,
        account_id,
        tag_id,
        include_transfers=False,
    )

    # Expenses are negative amounts; convert to positive magnitude for chart readability.
    expense_expr = func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0))

    by_tag_rows = db.execute(
        select(func.coalesce(Tag.label, "Uncategorized"), expense_expr)
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .outerjoin(Tag, Transaction.tag_id == Tag.id)
        .where(*base_filters, _effective_transaction_condition())
        .group_by(func.coalesce(Tag.label, "Uncategorized"))
        .order_by(expense_expr.desc())
    ).all()

    by_account_rows = db.execute(
        select(Account.name, expense_expr)
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(*base_filters, _effective_transaction_condition())
        .group_by(Account.name)
        .order_by(expense_expr.desc())
    ).all()

    return MonthlyAnalyticsResponse(
        by_tag=[
            MonthlyAnalyticsItem(label=str(label), total_expense=total_expense or 0)
            for label, total_expense in by_tag_rows
            if (total_expense or 0) > 0
        ],
        by_account=[
            MonthlyAnalyticsItem(label=str(label), total_expense=total_expense or 0)
            for label, total_expense in by_account_rows
            if (total_expense or 0) > 0
        ],
    )


@router.get("/analytics/tag-trend", response_model=TagMonthlyTrendResponse)
def tag_trend_last_12_months(
    tag_id: int,
    account_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.user_id == current_user.id))
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    today = date.today()
    month_start = date(today.year, today.month, 1)
    start_year = month_start.year
    start_month = month_start.month - 11
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    range_start = date(start_year, start_month, 1)

    filters = [
        Account.user_id == current_user.id,
        Transaction.tag_id == tag_id,
        Transaction.date >= range_start,
        Transaction.is_transfer.is_(False),
    ]
    if account_id:
        filters.append(Transaction.account_id == account_id)

    expense_expr = func.sum(case((Transaction.amount < 0, -Transaction.amount), else_=0))
    rows = db.execute(
        select(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            expense_expr.label("total"),
        )
        .select_from(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(*filters, _effective_transaction_condition())
        .group_by(extract("year", Transaction.date), extract("month", Transaction.date))
        .order_by(extract("year", Transaction.date), extract("month", Transaction.date))
    ).all()

    row_map: dict[tuple[int, int], Decimal] = {
        (int(year), int(month)): total or Decimal("0")
        for year, month, total in rows
    }

    points: list[TagMonthlyTrendItem] = []
    for offset in range(12):
        y = start_year + ((start_month - 1 + offset) // 12)
        m = ((start_month - 1 + offset) % 12) + 1
        points.append(
            TagMonthlyTrendItem(
                month=f"{y}-{m:02d}",
                total_expense=row_map.get((y, m), Decimal("0")),
            )
        )

    return TagMonthlyTrendResponse(tag_id=tag_id, points=points)


@router.post("", response_model=TransactionResponse)
def create_transaction(payload: TransactionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = _validate_scoped_entities(payload.account_id, payload.tag_id, current_user.id, db)
    try:
        currency = normalize_currency(payload.currency) if payload.currency else account.currency
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    tx = Transaction()
    if payload.is_transfer:
        destination = _validate_destination_account(payload.destination_account_id, current_user.id, db)
        if destination.id == payload.account_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer accounts must be different")

        tx = _save_transfer_pair(
            tx,
            None,
            source_account_id=payload.account_id,
            destination_account_id=destination.id,
            tx_date=payload.date,
            description=payload.description,
            amount=payload.amount,
            currency=currency,
            group_id=str(uuid4()),
            db=db,
        )
    else:
        tx.date = payload.date
        tx.description = payload.description
        tx.account_id = payload.account_id
        tx.tag_id = payload.tag_id
        tx.amount = payload.amount
        tx.currency = currency
        tx.parent_transaction_id = None
        _clear_transfer_fields(tx)
        db.add(tx)

    db.commit()
    db.refresh(tx)
    return tx


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == transaction_id, Account.user_id == current_user.id)
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    account = _validate_scoped_entities(payload.account_id, payload.tag_id, current_user.id, db)
    try:
        currency = normalize_currency(payload.currency) if payload.currency else account.currency
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if payload.is_transfer:
        destination = _validate_destination_account(payload.destination_account_id, current_user.id, db)
        if destination.id == payload.account_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer accounts must be different")

        existing_pair = None
        if tx.transfer_group_id:
            existing_pair = db.scalar(
                select(Transaction)
                .join(Account, Transaction.account_id == Account.id)
                .where(
                    Transaction.transfer_group_id == tx.transfer_group_id,
                    Transaction.id != tx.id,
                    Account.user_id == current_user.id,
                )
            )

        group_id = tx.transfer_group_id or str(uuid4())
        tx = _save_transfer_pair(
            tx,
            existing_pair,
            source_account_id=payload.account_id,
            destination_account_id=destination.id,
            tx_date=payload.date,
            description=payload.description,
            amount=payload.amount,
            currency=currency,
            group_id=group_id,
            db=db,
        )
    else:
        if tx.is_transfer and tx.transfer_group_id:
            pair_rows = db.scalars(
                select(Transaction)
                .join(Account, Transaction.account_id == Account.id)
                .where(
                    Transaction.transfer_group_id == tx.transfer_group_id,
                    Transaction.id != tx.id,
                    Account.user_id == current_user.id,
                )
            ).all()
            for item in pair_rows:
                db.delete(item)

        tx.date = payload.date
        tx.description = payload.description
        tx.account_id = payload.account_id
        tx.tag_id = payload.tag_id
        tx.amount = payload.amount
        tx.currency = currency
        tx.parent_transaction_id = None
        _clear_transfer_fields(tx)

    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == transaction_id, Account.user_id == current_user.id)
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if tx.is_transfer and tx.transfer_group_id:
        pair_rows = db.scalars(
            select(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Transaction.transfer_group_id == tx.transfer_group_id,
                Account.user_id == current_user.id,
            )
        ).all()
        for item in pair_rows:
            db.delete(item)
    else:
        db.delete(tx)
    db.commit()
    return {"ok": True}


@router.get("/{transaction_id}/splits", response_model=SplitTransactionResponse)
def get_transaction_splits(transaction_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tx = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == transaction_id, Account.user_id == current_user.id)
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    parent_id = _resolve_parent_transaction_id(tx)
    parent = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == parent_id, Account.user_id == current_user.id)
    )
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent transaction not found")
    if parent.is_transfer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfers cannot be split")

    rows = db.scalars(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.parent_transaction_id == parent.id, Account.user_id == current_user.id)
        .order_by(Transaction.id.asc())
    ).all()

    remaining = parent.amount - sum((row.amount for row in rows), Decimal("0"))
    return SplitTransactionResponse(
        parent=TransactionResponse.model_validate(parent),
        rows=[TransactionResponse.model_validate(row) for row in rows],
        remaining_amount=remaining,
    )


@router.put("/{transaction_id}/splits", response_model=SplitTransactionResponse)
def save_transaction_splits(
    transaction_id: int,
    payload: SplitTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == transaction_id, Account.user_id == current_user.id)
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    parent_id = _resolve_parent_transaction_id(tx)
    parent = db.scalar(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.id == parent_id, Account.user_id == current_user.id)
    )
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent transaction not found")
    if parent.is_transfer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfers cannot be split")

    existing_rows = db.scalars(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.parent_transaction_id == parent.id, Account.user_id == current_user.id)
    ).all()
    existing_by_id = {row.id: row for row in existing_rows}

    valid_tag_ids = set(db.scalars(select(Tag.id).where(Tag.user_id == current_user.id)).all())
    sign = Decimal("-1") if parent.amount < 0 else Decimal("1")
    total_abs = Decimal("0")
    seen_ids: set[int] = set()
    keep_ids: set[int] = set()
    prepared: list[Transaction] = []

    for row in payload.rows:
        if row.id is not None and row.id in seen_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate split row id")
        if row.id is not None:
            seen_ids.add(row.id)
        if row.amount <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Split amount must be greater than zero")
        if not row.description.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Split description cannot be empty")
        if row.tag_id is not None and row.tag_id not in valid_tag_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tag for split row")

        total_abs += abs(row.amount)
        tx_row = existing_by_id.get(row.id) if row.id is not None else None
        if row.id is not None:
            keep_ids.add(row.id)
        if tx_row is None:
            tx_row = Transaction()
            db.add(tx_row)

        tx_row.date = parent.date
        tx_row.account_id = parent.account_id
        tx_row.currency = parent.currency
        tx_row.description = row.description.strip()
        tx_row.amount = sign * abs(row.amount)
        tx_row.tag_id = row.tag_id
        tx_row.parent_transaction_id = parent.id
        _clear_transfer_fields(tx_row)
        prepared.append(tx_row)

    if total_abs > abs(parent.amount):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Split total cannot exceed original transaction amount")

    for existing in existing_rows:
        if existing.id not in keep_ids:
            db.delete(existing)

    db.commit()

    saved_rows = db.scalars(
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .where(Transaction.parent_transaction_id == parent.id, Account.user_id == current_user.id)
        .order_by(Transaction.id.asc())
    ).all()
    remaining = parent.amount - sum((row.amount for row in saved_rows), Decimal("0"))

    return SplitTransactionResponse(
        parent=TransactionResponse.model_validate(parent),
        rows=[TransactionResponse.model_validate(row) for row in saved_rows],
        remaining_amount=remaining,
    )


@router.post("/import/preview/{account_id}", response_model=ImportPreviewResponse)
async def preview_import_transactions(
    account_id: int,
    file: UploadFile = File(...),
    default_tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if default_tag_id:
        tag = db.scalar(select(Tag).where(Tag.id == default_tag_id, Tag.user_id == current_user.id))
        if not tag:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid default tag")

    content = await file.read()
    try:
        parsed_rows, parse_errors = parse_transactions_with_errors(
            file.filename or "",
            content,
            _build_column_mapping_for_account(account),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    valid_rows, errors, preview = _validate_import_rows(
        parsed_rows,
        parse_errors,
        current_user.id,
        account.currency,
        default_tag_id,
        db,
    )

    return ImportPreviewResponse(
        total_rows=len(parsed_rows) + len(parse_errors),
        valid_rows=len(valid_rows),
        invalid_rows=len(errors),
        preview=[ImportPreviewItem.model_validate(item) for item in preview[:50]],
        errors=[ImportPreviewError.model_validate(err) for err in errors[:100]],
    )


@router.post("/import/{account_id}")
async def import_transactions(
    account_id: int,
    file: UploadFile = File(...),
    default_tag_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    if default_tag_id:
        tag = db.scalar(select(Tag).where(Tag.id == default_tag_id, Tag.user_id == current_user.id))
        if not tag:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid default tag")

    content = await file.read()
    try:
        parsed_rows, parse_errors = parse_transactions_with_errors(
            file.filename or "",
            content,
            _build_column_mapping_for_account(account),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    rows, errors, _ = _validate_import_rows(
        parsed_rows,
        parse_errors,
        current_user.id,
        account.currency,
        default_tag_id,
        db,
    )
    created = 0
    for row in rows:
        tx = Transaction(
            date=row["date"],
            description=row["description"],
            account_id=account_id,
            tag_id=row["effective_tag_id"],
            amount=row["amount"],
            currency=row["effective_currency"],
        )
        db.add(tx)
        created += 1

    db.commit()
    return {"imported": created, "skipped": len(errors)}
