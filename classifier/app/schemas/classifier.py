from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class UntaggedTransaction(BaseModel):
    id: int
    date: date
    description: str
    account_id: int
    amount: Decimal
    currency: str


class ModelMetaResponse(BaseModel):
    account_id: int
    user_id: int
    trained_at: datetime
    model_name: str
    score: float
    sample_count: int
    class_count: int


class TrainRequest(BaseModel):
    account_id: int


class TrainResponse(BaseModel):
    trained: bool
    reason: str | None = None
    meta: ModelMetaResponse | None = None


class PredictRequest(BaseModel):
    account_id: int
    transaction_ids: list[int] | None = None


class PredictionItem(BaseModel):
    transaction_id: int
    suggested_tag_id: int
    confidence: float


class PredictResponse(BaseModel):
    model_ready: bool
    reason: str | None = None
    meta: ModelMetaResponse | None = None
    predictions: list[PredictionItem]
