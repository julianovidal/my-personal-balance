from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.schemas.classifier import (
    ModelMetaResponse,
    PredictionItem,
    PredictRequest,
    PredictResponse,
    TrainRequest,
    TrainResponse,
    UntaggedTransaction,
)
from app.services.model_store import load_model_bundle, save_model_bundle
from app.services.training import predict_with_confidence, train_model

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


def _assert_account_ownership(db: Session, user_id: int, account_id: int) -> None:
    owned = db.execute(
        text("SELECT 1 FROM accounts WHERE id = :account_id AND user_id = :user_id"),
        {"account_id": account_id, "user_id": user_id},
    ).scalar()
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")


def _metadata_response(bundle: dict[str, Any]) -> ModelMetaResponse:
    meta = bundle["metadata"]
    return ModelMetaResponse(
        account_id=int(meta["account_id"]),
        user_id=int(meta["user_id"]),
        trained_at=meta["trained_at"],
        model_name=str(meta["model_name"]),
        score=float(meta["score"]),
        sample_count=int(meta["sample_count"]),
        class_count=int(meta["class_count"]),
    )


@app.get("/api/classifier/transactions/untagged", response_model=list[UntaggedTransaction])
def list_untagged_transactions(
    account_id: int = Query(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _assert_account_ownership(db, user_id, account_id)

    rows = db.execute(
        text(
            """
            SELECT t.id, t.date, t.description, t.account_id, t.amount, t.currency
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.user_id = :user_id
              AND t.account_id = :account_id
              AND t.tag_id IS NULL
              AND t.is_transfer = FALSE
            ORDER BY t.date DESC, t.id DESC
            """
        ),
        {"user_id": user_id, "account_id": account_id},
    ).mappings().all()

    return [UntaggedTransaction.model_validate(dict(row)) for row in rows]


@app.post("/api/classifier/train", response_model=TrainResponse)
def train_account_model(
    payload: TrainRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _assert_account_ownership(db, user_id, payload.account_id)

    rows = db.execute(
        text(
            """
            SELECT t.description, t.tag_id
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.user_id = :user_id
              AND t.account_id = :account_id
              AND t.tag_id IS NOT NULL
              AND t.is_transfer = FALSE
            """
        ),
        {"user_id": user_id, "account_id": payload.account_id},
    ).mappings().all()

    result = train_model([dict(row) for row in rows], user_id=user_id, account_id=payload.account_id)
    if not result["trained"]:
        return TrainResponse(trained=False, reason=result["reason"], meta=None)

    bundle = result["bundle"]
    save_model_bundle(user_id=user_id, account_id=payload.account_id, bundle=bundle)
    return TrainResponse(trained=True, meta=_metadata_response(bundle))


@app.post("/api/classifier/predict", response_model=PredictResponse)
def predict_transactions(
    payload: PredictRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    _assert_account_ownership(db, user_id, payload.account_id)

    bundle = load_model_bundle(user_id=user_id, account_id=payload.account_id)
    if bundle is None:
        return PredictResponse(
            model_ready=False,
            reason="Model not found for this account. Please retrain first.",
            meta=None,
            predictions=[],
        )

    base_query = text(
        """
        SELECT t.id, t.description
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.user_id = :user_id
          AND t.account_id = :account_id
          AND t.tag_id IS NULL
          AND t.is_transfer = FALSE
        ORDER BY t.date DESC, t.id DESC
        """
    )
    params: dict[str, Any] = {"user_id": user_id, "account_id": payload.account_id}

    if payload.transaction_ids is not None:
        if len(payload.transaction_ids) == 0:
            return PredictResponse(
                model_ready=True,
                reason=None,
                meta=_metadata_response(bundle),
                predictions=[],
            )

        tx_query = text(
            """
            SELECT t.id, t.description
            FROM transactions t
            JOIN accounts a ON a.id = t.account_id
            WHERE a.user_id = :user_id
              AND t.account_id = :account_id
              AND t.tag_id IS NULL
              AND t.is_transfer = FALSE
              AND t.id IN :tx_ids
            ORDER BY t.date DESC, t.id DESC
            """
        ).bindparams(bindparam("tx_ids", expanding=True))
        base_query = tx_query
        params["tx_ids"] = payload.transaction_ids

    rows = db.execute(base_query, params).mappings().all()
    if len(rows) == 0:
        return PredictResponse(
            model_ready=True,
            reason=None,
            meta=_metadata_response(bundle),
            predictions=[],
        )

    descriptions = [str(row["description"] or "") for row in rows]
    predicted_tags, confidences = predict_with_confidence(bundle, descriptions)

    items = [
        PredictionItem(
            transaction_id=int(row["id"]),
            suggested_tag_id=int(predicted_tags[idx]),
            confidence=round(float(confidences[idx]), 4),
        )
        for idx, row in enumerate(rows)
    ]

    return PredictResponse(
        model_ready=True,
        reason=None,
        meta=_metadata_response(bundle),
        predictions=items,
    )
