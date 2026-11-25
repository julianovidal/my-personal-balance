"""Training and prediction in app/services/training.py, without a database.

The expected scores were recorded on Python 3.12 with scikit-learn 1.7.1. They
are the baseline for the scikit-learn upgrade
(specs/python-3-14-backend-and-classifier.md): the same model must win, with
macro-F1 within SCORE_TOLERANCE.
"""

from collections import Counter

import pytest

from app.services.training import (
    _candidate_models,
    _score_model,
    _to_labels,
    _to_text,
    predict_with_confidence,
    train_model,
)
from tests.fixtures import GROCERIES, RESTAURANTS, TRANSPORT, training_rows, uneven_training_rows

SCORE_TOLERANCE = 0.02
BASELINE_SCORES = {
    "logistic_regression": 0.6827,
    "complement_nb": 0.7516,
    "calibrated_linear_svc": 0.7183,
}


def _cv_splits(labels: list[int]) -> int:
    return min(5, min(Counter(labels).values()))


@pytest.fixture(scope="module")
def trained():
    result = train_model(training_rows(), user_id=1, account_id=1)
    assert result["trained"], result["reason"]
    return result


@pytest.mark.parametrize("name", list(BASELINE_SCORES))
def test_each_candidate_fits_and_scores_like_the_baseline(name):
    # train_model skips a candidate that raises, so a broken candidate would
    # only show up as a different winner. Fit each one here with no safety net.
    rows = training_rows()
    x, y = _to_text(rows), _to_labels(rows)
    model = dict(_candidate_models())[name]

    score = _score_model(name, model, x, y, cv_splits=_cv_splits(y))

    assert score == pytest.approx(BASELINE_SCORES[name], abs=SCORE_TOLERANCE)


# Recorded with the explicit one-versus-rest wrapper. The previous implicit
# liblinear one-versus-rest scored 0.7162 here: it weighed tags across all
# classes at once, where the wrapper balances each tag against the rest.
UNEVEN_BASELINE_SCORES = {
    "logistic_regression": 0.7481,
    "complement_nb": 0.8130,
    "calibrated_linear_svc": 0.8222,
}


@pytest.mark.parametrize("name", list(UNEVEN_BASELINE_SCORES))
def test_each_candidate_scores_like_the_baseline_on_uneven_tags(name):
    rows = uneven_training_rows()
    x, y = _to_text(rows), _to_labels(rows)
    model = dict(_candidate_models())[name]

    score = _score_model(name, model, x, y, cv_splits=_cv_splits(y))

    assert score == pytest.approx(UNEVEN_BASELINE_SCORES[name], abs=SCORE_TOLERANCE)


def test_train_picks_the_best_candidate_on_uneven_tags():
    result = train_model(uneven_training_rows(), user_id=1, account_id=1)

    assert result["bundle"]["metadata"]["model_name"] == "nearest_neighbour + calibrated_linear_svc"


def test_candidates_are_the_three_documented_models():
    assert [name for name, _ in _candidate_models()] == list(BASELINE_SCORES)


def test_train_picks_the_best_candidate(trained):
    metadata = trained["bundle"]["metadata"]

    assert metadata["model_name"] == "nearest_neighbour + complement_nb"
    assert metadata["score"] == pytest.approx(BASELINE_SCORES["complement_nb"], abs=SCORE_TOLERANCE)
    assert metadata["sample_count"] == 36
    assert metadata["class_count"] == 3
    assert metadata["user_id"] == 1
    assert metadata["account_id"] == 1


def test_predict_returns_one_known_tag_and_confidence_per_description(trained):
    descriptions = ["  Compra MERCADONA 9999  ", "UBER *TRIP ZZZ", "RESTAURANTE LA PLAZA", "XYZ UNKNOWN"]

    tags, confidences = predict_with_confidence(trained["bundle"], descriptions)

    assert len(tags) == len(confidences) == len(descriptions)
    assert set(tags) <= {GROCERIES, TRANSPORT, RESTAURANTS}
    assert all(0.0 <= confidence <= 1.0 for confidence in confidences)


def test_predict_tags_clear_merchants_correctly_and_confidently(trained):
    tags, confidences = predict_with_confidence(
        trained["bundle"], ["COMPRA MERCADONA 9999", "UBER *TRIP ZZZ", "RESTAURANTE LA PLAZA"]
    )

    assert tags == [GROCERIES, TRANSPORT, RESTAURANTS]
    assert all(confidence > 0.8 for confidence in confidences)


def test_predict_is_unsure_about_an_unseen_merchant(trained):
    _, confidences = predict_with_confidence(trained["bundle"], ["XYZ UNKNOWN"])

    assert confidences[0] < 0.5


def test_refuses_fewer_than_20_usable_rows():
    rows = training_rows()[:19] + [{"description": "", "tag_id": GROCERIES}, {"description": "x", "tag_id": None}]

    result = train_model(rows, user_id=1, account_id=1)

    assert result == {
        "trained": False,
        "reason": "Need at least 20 tagged transactions with description to train this account model",
        "bundle": None,
    }


def test_refuses_a_single_tag():
    rows = [{"description": f"MERCADONA {n}", "tag_id": GROCERIES} for n in range(25)]

    result = train_model(rows, user_id=1, account_id=1)

    assert result == {"trained": False, "reason": "Need at least 2 different tags in training data", "bundle": None}
