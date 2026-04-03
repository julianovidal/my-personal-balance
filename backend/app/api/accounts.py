from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.currency import normalize_currency
from app.core.database import get_db
from app.core.default_tags import DEFAULT_TAG_LABELS
from app.models.account import Account
from app.models.account_import_mapping import AccountImportMapping
from app.models.tag import Tag
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.account import (
    AccountBalanceItem,
    AccountCreate,
    AccountsBalanceResponse,
    AccountImportMappingResponse,
    AccountImportMappingUpdate,
    AccountResponse,
    AccountUpdate,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountResponse])
def list_accounts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Account).where(Account.user_id == current_user.id).order_by(Account.id.desc())).all()


@router.post("", response_model=AccountResponse)
def create_account(payload: AccountCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        currency = normalize_currency(payload.currency)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    account = Account(name=payload.name, currency=currency, user_id=current_user.id)
    db.add(account)
    db.flush()

    _ensure_default_tags_for_user(current_user.id, db)

    db.commit()
    db.refresh(account)
    return account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, payload: AccountUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    try:
        currency = normalize_currency(payload.currency)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    account.name = payload.name
    account.currency = currency
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(account_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"ok": True}


@router.get("/balances", response_model=AccountsBalanceResponse)
def get_accounts_balances(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Account.id,
            Account.name,
            Account.currency,
            func.coalesce(func.sum(Transaction.amount), 0).label("balance"),
        )
        .select_from(Account)
        .outerjoin(
            Transaction,
            and_(
                Transaction.account_id == Account.id,
                Transaction.parent_transaction_id.is_(None),
            ),
        )
        .where(Account.user_id == current_user.id)
        .group_by(Account.id, Account.name, Account.currency)
        .order_by(Account.name.asc())
    ).all()

    by_account = [
        AccountBalanceItem(
            account_id=account_id,
            account_name=account_name,
            currency=currency,
            balance=float(balance or 0),
        )
        for account_id, account_name, currency, balance in rows
    ]
    overall = sum((Decimal(str(item.balance)) for item in by_account), Decimal("0"))

    return AccountsBalanceResponse(overall_balance=float(overall), by_account=by_account)


@router.get("/{account_id}/import-mapping", response_model=AccountImportMappingResponse)
def get_account_import_mapping(account_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    mapping = db.scalar(select(AccountImportMapping).where(AccountImportMapping.account_id == account_id))
    if not mapping:
        return AccountImportMappingResponse(account_id=account_id)
    return mapping


@router.put("/{account_id}/import-mapping", response_model=AccountImportMappingResponse)
def upsert_account_import_mapping(
    account_id: int,
    payload: AccountImportMappingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.scalar(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    mapping = db.scalar(select(AccountImportMapping).where(AccountImportMapping.account_id == account_id))
    if not mapping:
        mapping = AccountImportMapping(account_id=account_id)
        db.add(mapping)

    mapping.date_column = _normalize_optional(payload.date_column)
    mapping.description_column = _normalize_optional(payload.description_column)
    mapping.amount_column = _normalize_optional(payload.amount_column)
    mapping.currency_column = _normalize_optional(payload.currency_column)
    mapping.tag_id_column = _normalize_optional(payload.tag_id_column)

    db.commit()
    db.refresh(mapping)
    return mapping


def _normalize_optional(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _ensure_default_tags_for_user(user_id: int, db: Session) -> None:
    existing_labels = set(
        db.scalars(select(Tag.label).where(Tag.user_id == user_id)).all()
    )
    missing = [label for label in DEFAULT_TAG_LABELS if label not in existing_labels]
    if not missing:
        return

    db.add_all([Tag(label=label, user_id=user_id) for label in missing])
