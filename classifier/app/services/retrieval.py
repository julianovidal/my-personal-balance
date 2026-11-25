"""Nearest-neighbour tag suggestions over normalized descriptions.

A merchant tagged once should be suggested on its next occurrence. A model that
generalizes over many examples does that poorly: a tag with one example gets
little weight, and rare n-grams can be dropped. Here every tagged row is kept
as is, and an untagged row borrows the tag of the most similar tagged rows.

When no tagged row is similar enough the index abstains, so the caller can try
another model or leave the row without a suggestion.
"""

import re
import unicodedata
from collections import defaultdict
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

# Cosine similarity of the closest tagged row needed to suggest its tag.
# Picked on a month-by-month replay of real accounts (benchmarks/replay_eval.py).
MATCH_THRESHOLD = 0.6
# Neighbours that vote, weighted by similarity. Three scored best on the
# replay; one or fifteen were within half a point.
NEIGHBOURS = 3
# Neighbours whose similarity is this far below the closest one do not vote.
VOTE_MARGIN = 0.1

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_description(description: str) -> str:
    """Lowercase, strip accents and punctuation, and drop reference-like tokens.

    Store numbers, order references and dates (``1043``, ``4x2k9``, ``23/11``)
    change between charges from the same merchant. A token with more digits
    than letters is treated as one of those and dropped.
    """
    text = unicodedata.normalize("NFKD", description or "").encode("ascii", "ignore").decode("ascii").lower()
    tokens = []
    for token in _NON_ALNUM.sub(" ", text).split():
        digits = sum(ch.isdigit() for ch in token)
        if digits > len(token) - digits:
            continue
        tokens.append(token)
    normalized = " ".join(tokens)
    return normalized or text.strip()


def _vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)


def build_index(descriptions: list[str], labels: list[int]) -> dict[str, Any]:
    """Index tagged rows. Pass them oldest first: ties go to the newest row."""
    vectorizer = _vectorizer()
    matrix = vectorizer.fit_transform([normalize_description(d) for d in descriptions])
    return {
        "vectorizer": vectorizer,
        "matrix": matrix.tocsr(),
        "labels": np.asarray(labels, dtype=np.int64),
        "threshold": MATCH_THRESHOLD,
    }


def _vote(
    sims: np.ndarray, labels: np.ndarray, threshold: float, neighbours: int
) -> tuple[int | None, float, float]:
    """Return ``(tag or None, confidence, closest similarity)``.

    Indexed rows are in date order. Among equally similar rows the newest ones
    vote, so a merchant whose tag was changed follows the latest tagging.
    """
    if sims.size == 0:
        return None, 0.0, 0.0
    order = np.lexsort((-np.arange(sims.size), -sims))
    top = order[:neighbours]
    best = float(sims[top[0]])
    if best <= 0.0 or best < threshold:
        return None, 0.0, max(best, 0.0)
    weights: dict[int, float] = defaultdict(float)
    for idx in top:
        sim = float(sims[idx])
        if sim >= best - VOTE_MARGIN:
            weights[int(labels[idx])] += sim
    total = sum(weights.values())
    tag = max(weights, key=lambda key: weights[key])
    # The closest similarity, lowered when the voting neighbours disagree.
    return tag, best * (weights[tag] / total), best


def query_index(
    index: dict[str, Any],
    descriptions: list[str],
    *,
    threshold: float | None = None,
    neighbours: int = NEIGHBOURS,
    exclude_self: bool = False,
    batch_size: int = 512,
) -> list[tuple[int | None, float, float]]:
    """Return ``(tag or None, confidence, closest similarity)`` per description.

    ``exclude_self`` is for leave-one-out scoring on the indexed rows: row i of
    ``descriptions`` must then be indexed row i.
    """
    limit = index["threshold"] if threshold is None else threshold
    vectors = index["vectorizer"].transform([normalize_description(d) for d in descriptions])
    matrix = index["matrix"]
    labels = index["labels"]
    results: list[tuple[int | None, float, float]] = []
    for start in range(0, vectors.shape[0], batch_size):
        sims = (vectors[start : start + batch_size] @ matrix.T).toarray()
        if exclude_self:
            rows = np.arange(sims.shape[0])
            sims[rows, rows + start] = -1.0
        for row in sims:
            results.append(_vote(row, labels, limit, neighbours))
    return results
