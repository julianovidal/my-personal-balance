import logging
from pathlib import Path
from typing import Any

import joblib

from app.core.config import settings

logger = logging.getLogger(__name__)


def _model_path(user_id: int, account_id: int) -> Path:
    model_dir = Path(settings.model_data_dir)
    model_dir.mkdir(parents=True, exist_ok=True)
    return model_dir / f"model_user_{user_id}_account_{account_id}.joblib"


def save_model_bundle(*, user_id: int, account_id: int, bundle: dict[str, Any]) -> None:
    path = _model_path(user_id, account_id)
    joblib.dump(bundle, path)


def load_model_bundle(*, user_id: int, account_id: int) -> dict[str, Any] | None:
    """Return the saved bundle, or None when the account has no usable model.

    A file that cannot be loaded counts as no model, so predict asks the user
    to retrain instead of failing with a 500. scikit-learn does not promise that
    models pickled by one version load in another, so this is expected after a
    scikit-learn upgrade. Unpickling can fail in many ways (UnpicklingError,
    EOFError, AttributeError or ModuleNotFoundError for moved classes, ...), so
    any exception counts.
    """
    path = _model_path(user_id, account_id)
    if not path.exists():
        return None
    try:
        return joblib.load(path)
    except Exception:
        logger.warning(
            "Ignoring unloadable model for user %s account %s at %s; retrain to replace it",
            user_id,
            account_id,
            path,
            exc_info=True,
        )
        return None
