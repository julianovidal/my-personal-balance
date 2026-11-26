from collections import Counter
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.multiclass import OneVsRestClassifier
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from app.services.retrieval import build_index, query_index

# A row with no close tagged neighbour still gets the model's tag, but below
# this probability the suggestion is flagged as low confidence so the user
# checks it before applying.
FALLBACK_CONFIDENCE = 0.6


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
                        # liblinear fits one binary model per tag. scikit-learn 1.8
                        # stopped doing that implicitly for multiclass input, so the
                        # one-versus-rest scheme is made explicit.
                        OneVsRestClassifier(
                            LogisticRegression(
                                max_iter=2000,
                                class_weight="balanced",
                                solver="liblinear",
                            )
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
    # Rows arrive oldest first, so ties in similarity go to the newest tag.
    retrieval = build_index([str(row["description"]) for row in filtered_rows], y)

    trained_at = datetime.now(timezone.utc)
    metadata = {
        "user_id": user_id,
        "account_id": account_id,
        "trained_at": trained_at,
        "model_name": f"nearest_neighbour + {best_name}",
        "score": round(best_score, 4),
        "sample_count": len(filtered_rows),
        "class_count": len(labels),
    }

    return {
        "trained": True,
        "reason": None,
        "bundle": {
            "model": best_model,
            "retrieval": retrieval,
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


def suggest_tags(bundle: dict[str, Any], descriptions: list[str]) -> list[tuple[int, float, bool]]:
    """Return ``(tag, confidence, low_confidence)`` per description.

    The closest tagged rows decide first. Rows with no close match get the
    model's tag, flagged as low confidence when the model is below
    ``FALLBACK_CONFIDENCE``. Bundles saved before the nearest-neighbour index
    existed use the model alone, with the same flag.
    """
    if not descriptions:
        return []
    tags, confidences = predict_with_confidence(bundle, descriptions)
    retrieval = bundle.get("retrieval")
    if retrieval is None:
        return [(tag, confidence, confidence < FALLBACK_CONFIDENCE) for tag, confidence in zip(tags, confidences)]

    suggestions: list[tuple[int, float, bool]] = []
    for (near_tag, near_conf, _), tag, confidence in zip(query_index(retrieval, descriptions), tags, confidences):
        if near_tag is not None:
            suggestions.append((near_tag, near_conf, False))
        else:
            suggestions.append((tag, confidence, confidence < FALLBACK_CONFIDENCE))
    return suggestions
