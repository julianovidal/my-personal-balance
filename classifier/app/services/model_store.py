from pathlib import Path
from typing import Any

import joblib

from app.core.config import settings


def _model_path(user_id: int, account_id: int) -> Path:
    model_dir = Path(settings.model_data_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir / f"model_user_{user_id}_account_{account_id}.joblib"


def save_model_bundle(*, user_id: int, account_id: int, bundle: dict[str, Any]) -> None:
    path = _model_path(user_id, account_id)
    joblib.dump(bundle, path)


def load_model_bundle(*, user_id: int, account_id: int) -> dict[str, Any] | None:
    path = _model_path(user_id, account_id)
    if not path.exists():
        return None
    return joblib.load(path)
