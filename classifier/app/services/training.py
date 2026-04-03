from collections import Counter
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


def _to_text(rows: list[dict[str, Any]]) -> list[str]:
    return [str(row.get("description") or "").strip().lower() for row in rows]


def _to_labels(rows: list[dict[str, Any]]) -> list[int]:
    return [int(row["tag_id"]) for row in rows if row.get("tag_id") is not None]


def _candidate_models() -> list[tuple[str, Pipeline]]:
    return [
        (
            "logistic_regression",
            Pipeline(
                steps=[
                    ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=5000)),
                    (
                        "clf",
                        LogisticRegression(
                            max_iter=2000,
                            class_weight="balanced",
                            solver="liblinear",
                        ),
                    ),
                ]
            ),
        ),
        (
            "complement_nb",
            Pipeline(
                steps=[
                    ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=5000)),
                    ("clf", ComplementNB(alpha=0.3)),
                ]
            ),
        ),
        (
            "calibrated_linear_svc",
            Pipeline(
                steps=[
                    ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=5000)),
                    (
                        "clf",
                        CalibratedClassifierCV(
                            estimator=LinearSVC(class_weight="balanced"),
                            method="sigmoid",
                            cv=3,
                        ),
                    ),
                ]
            ),
        ),
    ]


def _score_model(name: str, model: Pipeline, x: list[str], y: list[int], cv_splits: int) -> float:
    if cv_splits >= 2 and len(x) >= 10:
        cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)
        scores = cross_val_score(model, x, y, scoring="f1_macro", cv=cv, n_jobs=1)
        return float(np.mean(scores))

    model.fit(x, y)
    predictions = model.predict(x)
    return float(f1_score(y, predictions, average="macro"))


def train_model(rows: list[dict[str, Any]], user_id: int, account_id: int) -> dict[str, Any]:
    filtered_rows = [row for row in rows if row.get("description") and row.get("tag_id") is not None]
    if len(filtered_rows) < 20:
        return {
            "trained": False,
            "reason": "Need at least 20 tagged transactions with description to train this account model",
            "bundle": None,
        }

    x = _to_text(filtered_rows)
    y = _to_labels(filtered_rows)
    labels = set(y)

    if len(labels) < 2:
        return {
            "trained": False,
            "reason": "Need at least 2 different tags in training data",
            "bundle": None,
        }

    class_counts = Counter(y)
    min_class_count = min(class_counts.values())
    cv_splits = min(5, min_class_count)

    best_name = ""
    best_model: Pipeline | None = None
    best_score = float("-inf")

    for name, candidate in _candidate_models():
        try:
            score = _score_model(name, candidate, x, y, cv_splits=cv_splits)
        except Exception:
            continue
        if score > best_score:
            best_name = name
            best_model = candidate
            best_score = score

    if best_model is None:
        return {
            "trained": False,
            "reason": "Could not train a model with available data",
            "bundle": None,
        }

    best_model.fit(x, y)

    trained_at = datetime.now(timezone.utc)
    metadata = {
        "user_id": user_id,
        "account_id": account_id,
        "trained_at": trained_at,
        "model_name": best_name,
        "score": round(best_score, 4),
        "sample_count": len(filtered_rows),
        "class_count": len(labels),
    }

    return {
        "trained": True,
        "reason": None,
        "bundle": {
            "model": best_model,
            "metadata": metadata,
        },
    }


def predict_with_confidence(bundle: dict[str, Any], descriptions: list[str]) -> tuple[list[int], list[float]]:
    model = bundle["model"]
    cleaned = [desc.strip().lower() for desc in descriptions]
    predicted = [int(v) for v in model.predict(cleaned)]

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(cleaned)
        confidences = [float(np.max(row)) for row in probs]
    else:
        confidences = [0.0 for _ in predicted]

    return predicted, confidences
