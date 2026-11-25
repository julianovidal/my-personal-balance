"""Untagged rows the classifier lists and predicts for.

A row qualifies when it has no tag, is not a transfer, and is not a split
parent. Once a transaction has split parts, the parts replace it everywhere
money is counted, so its own tag is never used.
"""

from collections.abc import Sequence
from typing import Any

from sqlalchemy import RowMapping, bindparam, text
from sqlalchemy.orm import Session

_SELECT = """
    SELECT t.id, t.date, t.description, t.account_id, t.amount, t.currency
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = :user_id
      AND t.account_id = :account_id
      AND t.tag_id IS NULL
      AND t.is_transfer = FALSE
      AND NOT EXISTS (SELECT 1 FROM transactions part WHERE part.parent_transaction_id = t.id)
"""
_ORDER = " ORDER BY t.date DESC, t.id DESC"


def untagged_transactions(
    db: Session,
    user_id: int,
    account_id: int,
    transaction_ids: Sequence[int] | None = None,
) -> Sequence[RowMapping]:
    params: dict[str, Any] = {"user_id": user_id, "account_id": account_id}
    if transaction_ids is None:
        query = text(_SELECT + _ORDER)
    else:
        query = text(_SELECT + " AND t.id IN :tx_ids" + _ORDER).bindparams(bindparam("tx_ids", expanding=True))
        params["tx_ids"] = list(transaction_ids)
    return db.execute(query, params).mappings().all()
