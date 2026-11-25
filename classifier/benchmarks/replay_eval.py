"""Month-by-month replay of an account's tagged history.

For each month in the evaluation window, everything tagged before that month
is the training data (as if the user retrained on the 1st) and the month's
rows are predicted. This answers the question the shuffled k-fold score in
train_model cannot: given my past, how often is the next suggestion right, and
does a merchant tagged once get the right tag the next time?

Only aggregate numbers are printed. Per-row outputs (ids, tags, scores, no
descriptions) are cached to --cache so thresholds can be swept without
retraining.

    DATABASE_URL=postgresql+psycopg2://balance:balance@localhost:5432/balance \\
      uv run python benchmarks/replay_eval.py --user 1 --account 10 --months 12 --cache /tmp/a10-baseline.json
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text  # noqa: E402

from app.services.retrieval import MATCH_THRESHOLD, NEIGHBOURS, build_index, normalize_description, query_index  # noqa: E402
from app.services.training import FALLBACK_CONFIDENCE, train_model  # noqa: E402

_ROWS = """
    SELECT t.id, t.date, t.description, t.tag_id
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE a.user_id = :user_id AND t.account_id = :account_id
      AND t.tag_id IS NOT NULL AND t.is_transfer = FALSE
      AND t.description IS NOT NULL AND t.description <> ''
      AND NOT EXISTS (SELECT 1 FROM transactions p WHERE p.parent_transaction_id = t.id)
    ORDER BY t.date, t.id
"""


def _month(d: date) -> date:
    return d.replace(day=1)


def load_rows(user_id: int, account_id: int) -> list[dict]:
    engine = create_engine(os.environ["DATABASE_URL"])
    with engine.connect() as conn:
        return [dict(r) for r in conn.execute(text(_ROWS), {"user_id": user_id, "account_id": account_id}).mappings()]


def _windows(rows: list[dict], months: int):
    eval_months = sorted({_month(r["date"]) for r in rows})[-months:]
    for month in eval_months:
        train = [r for r in rows if r["date"] < month]
        test = [r for r in rows if _month(r["date"]) == month]
        if len(train) >= 20 and test:
            yield month, train, test


def baseline(rows: list[dict], user_id: int, account_id: int, months: int) -> dict[str, dict]:
    """The production train_model, retrained at the start of each month. Slow, so cached."""
    out: dict[str, dict] = {}
    for month, train, test in _windows(rows, months):
        started = time.perf_counter()
        result = train_model(train, user_id=user_id, account_id=account_id)
        model = result["bundle"]["model"] if result["trained"] else None
        test_desc = [r["description"].strip().lower() for r in test]
        if model is not None:
            pred = [int(v) for v in model.predict(test_desc)]
            conf = [float(p.max()) for p in model.predict_proba(test_desc)]
        else:
            pred, conf = [None] * len(test), [0.0] * len(test)
        for i, r in enumerate(test):
            out[str(r["id"])] = {"base_pred": pred[i], "base_conf": conf[i]}
        print(f"  {month} train={len(train)} test={len(test)} {time.perf_counter() - started:.1f}s", file=sys.stderr)
    return out


def collect(rows: list[dict], base: dict[str, dict], months: int, neighbours: int) -> list[dict]:
    out: list[dict] = []
    for month, train, test in _windows(rows, months):
        index = build_index([r["description"] for r in train], [int(r["tag_id"]) for r in train])
        knn = query_index(index, [r["description"] for r in test], threshold=0.0, neighbours=neighbours)
        keys = Counter(normalize_description(r["description"]) for r in train)
        exact = Counter(r["description"].strip().lower() for r in train)
        for i, r in enumerate(test):
            out.append(
                {
                    **base[str(r["id"])],
                    "truth": int(r["tag_id"]),
                    "knn_pred": knn[i][0],
                    "knn_conf": knn[i][1],
                    "knn_best": knn[i][2],
                    "prior_key": keys[normalize_description(r["description"])],
                    "prior_exact": exact[r["description"].strip().lower()],
                }
            )
    return out


def _summary(label: str, rows: list[dict], suggest, correct) -> str:
    n = len(rows)
    suggested = [r for r in rows if suggest(r)]
    right = sum(1 for r in suggested if correct(r))
    cov = len(suggested) / n if n else 0.0
    prec = right / len(suggested) if suggested else 0.0
    hit = right / n if n else 0.0
    return f"{label:<34} n={n:>5}  coverage={cov:6.1%}  precision={prec:6.1%}  right/all={hit:6.1%}"


def report(rows: list[dict], knn_threshold: float, fallback_threshold: float) -> None:
    def base_all(r):
        return r["base_pred"] is not None

    def base_right(r):
        return r["base_pred"] == r["truth"]

    def knn_on(r):
        return r["knn_pred"] is not None and r["knn_best"] >= knn_threshold

    def cascade_on(r):
        return knn_on(r) or (r["base_pred"] is not None and r["base_conf"] >= fallback_threshold)

    def cascade_right(r):
        pred = r["knn_pred"] if knn_on(r) else r["base_pred"]
        return pred == r["truth"]

    # Baseline cut to the cascade's coverage, by its own confidence, for a fair precision comparison.
    covered = sum(1 for r in rows if cascade_on(r))
    ranked = sorted(rows, key=lambda r: -r["base_conf"])
    base_top = {id(r) for r in ranked[:covered]}

    subsets = {
        "all rows": rows,
        "second occurrence (key seen 1x)": [r for r in rows if r["prior_key"] == 1],
        "key seen 2-4x": [r for r in rows if 2 <= r["prior_key"] <= 4],
        "key seen 5+x": [r for r in rows if r["prior_key"] >= 5],
        "new merchant (key unseen)": [r for r in rows if r["prior_key"] == 0],
        "exact text seen 1x": [r for r in rows if r["prior_exact"] == 1],
    }
    print(f"\nknn_threshold={knn_threshold} fallback_threshold={fallback_threshold}")
    for name, subset in subsets.items():
        sub_ids = {id(r) for r in subset}
        print(f"-- {name}")
        print(_summary("   current, always suggest", subset, base_all, base_right))
        print(
            _summary(
                "   current, same coverage",
                subset,
                lambda r, s=sub_ids: id(r) in base_top and id(r) in s,
                base_right,
            )
        )
        print(_summary("   nearest neighbour only", subset, knn_on, lambda r: r["knn_pred"] == r["truth"]))
        print(_summary("   nearest neighbour + fallback", subset, cascade_on, cascade_right))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", type=int, required=True)
    parser.add_argument("--account", type=int, required=True)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--knn-threshold", type=float, action="append")
    parser.add_argument("--fallback-threshold", type=float, action="append")
    parser.add_argument("--neighbours", type=int, default=NEIGHBOURS)
    args = parser.parse_args()

    rows = load_rows(args.user, args.account)
    if args.cache.exists():
        base = json.loads(args.cache.read_text())
    else:
        base = baseline(rows, args.user, args.account, args.months)
        args.cache.write_text(json.dumps(base))
    results = collect(rows, base, args.months, args.neighbours)
    for kt in args.knn_threshold or [MATCH_THRESHOLD]:
        for ft in args.fallback_threshold or [FALLBACK_CONFIDENCE]:
            report(results, kt, ft)


if __name__ == "__main__":
    main()
