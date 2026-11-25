"""Nearest-neighbour suggestions in app/services/retrieval.py and suggest_tags."""

import pytest

from app.services.retrieval import build_index, normalize_description, query_index
from app.services.training import FALLBACK_CONFIDENCE, suggest_tags, train_model
from tests.fixtures import GROCERIES, RESTAURANTS, TRANSPORT, training_rows

GYM = 99


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("COMPRA MERCADONA 1043 MADRID", "compra mercadona madrid"),
        ("UBER *TRIP 4X2K9", "uber trip"),
        ("Café São João 23/11", "cafe sao joao"),
        ("O2 FIBRA", "o2 fibra"),
        ("12345", "12345"),
        ("", ""),
    ],
)
def test_normalize_drops_references_accents_and_punctuation(raw, expected):
    assert normalize_description(raw) == expected


def test_a_merchant_tagged_once_is_suggested_on_its_next_occurrence():
    rows = training_rows() + [{"description": "BASIC FIT 0042 CHAMARTIN", "tag_id": GYM}]

    result = train_model(rows, user_id=1, account_id=1)
    [(tag, confidence)] = suggest_tags(result["bundle"], ["BASIC FIT 0107 CHAMARTIN"])

    assert tag == GYM
    assert confidence > 0.6


def test_nothing_is_suggested_when_no_tagged_row_is_close_and_the_model_is_unsure():
    result = train_model(training_rows(), user_id=1, account_id=1)

    [(tag, confidence)] = suggest_tags(result["bundle"], ["XYZ UNKNOWN"])

    assert tag is None
    assert confidence < FALLBACK_CONFIDENCE


def test_clear_merchants_still_get_their_tags():
    result = train_model(training_rows(), user_id=1, account_id=1)

    suggestions = suggest_tags(
        result["bundle"], ["COMPRA MERCADONA 9999", "UBER *TRIP ZZZ", "RESTAURANTE LA PLAZA"]
    )

    assert [tag for tag, _ in suggestions] == [GROCERIES, TRANSPORT, RESTAURANTS]


def test_the_newest_tag_wins_among_identical_rows():
    # Rows are indexed oldest first; the merchant was re-tagged later.
    descriptions = ["NETFLIX.COM"] * 4 + ["NETFLIX.COM"] * 3
    labels = [RESTAURANTS] * 4 + [GROCERIES] * 3

    [(tag, _, best)] = query_index(build_index(descriptions, labels), ["NETFLIX.COM"])

    assert tag == GROCERIES
    assert best == pytest.approx(1.0)


def test_disagreeing_neighbours_give_the_majority_with_lower_confidence():
    descriptions = ["AMAZON MKTPLACE", "AMAZON MKTPLACE", "AMAZON MKTPLACE"]
    index_agree = build_index(descriptions, [GROCERIES, GROCERIES, GROCERIES])
    index_split = build_index(descriptions, [RESTAURANTS, GROCERIES, GROCERIES])

    [(tag_agree, conf_agree, _)] = query_index(index_agree, ["AMAZON MKTPLACE"])
    [(tag_split, conf_split, _)] = query_index(index_split, ["AMAZON MKTPLACE"])

    assert tag_agree == tag_split == GROCERIES
    assert conf_split < conf_agree


def test_leave_one_out_ignores_the_row_itself():
    index = build_index(["SPOTIFY P1234", "LIDL 0451"], [RESTAURANTS, GROCERIES])

    results = query_index(index, ["SPOTIFY P1234", "LIDL 0451"], exclude_self=True)

    assert [tag for tag, _, _ in results] == [None, None]


def test_a_bundle_saved_before_retrieval_keeps_always_suggesting():
    bundle = dict(train_model(training_rows(), user_id=1, account_id=1)["bundle"])
    del bundle["retrieval"]

    [(tag, _)] = suggest_tags(bundle, ["XYZ UNKNOWN"])

    assert tag in {GROCERIES, TRANSPORT, RESTAURANTS}


def test_no_descriptions_give_no_suggestions():
    bundle = train_model(training_rows(), user_id=1, account_id=1)["bundle"]

    assert suggest_tags(bundle, []) == []
