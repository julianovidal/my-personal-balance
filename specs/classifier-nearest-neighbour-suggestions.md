# Spec: Classifier suggests from the closest tagged rows first

## Problem

A merchant tagged once was often not suggested correctly the next time it appeared, even after a retrain. The model is a TF-IDF classifier over many examples:

- `max_features=5000` keeps the most frequent character n-grams, so a merchant seen once can lose the n-grams that identify it.
- Store numbers, order references and dates stay in the text, so two charges from the same merchant look less alike than they are.
- A tag with one example gets little weight, and its probability is low by design.

Predict also gave every suggestion the same weight, so a guess looked as trustworthy as a match.

## Behavior

`POST /api/classifier/train` keeps its rules (at least 20 tagged descriptions, 2 tags) and still picks the best of the three TF-IDF models by macro-F1. It also indexes every tagged row of the account, oldest first.

`POST /api/classifier/predict` suggests a tag per untagged row in this order:

1. **Closest tagged rows.** Descriptions are normalized: accents and punctuation go, and so does any token with more digits than letters (`1043`, `4x2k9`, `23/11`). The row is compared with every indexed row by cosine similarity of character 3–5-grams. If the closest similarity is at least 0.6, the three closest rows vote, weighted by similarity. Only rows within 0.1 of the closest one count. Among equally similar rows the newest ones vote, so a re-tagged merchant follows its latest tag. The suggestion is the majority tag. Its confidence is the closest similarity times the majority's share of the vote, so disagreement lowers it.
2. **The model.** With no close row, the model's tag is used. When its probability is below 0.6 the prediction has `low_confidence: true`.

Every row in the request gets a prediction. `PredictionItem` gains `low_confidence` (boolean, `false` for a closest-row match and a confident model).

The Classifier page fills the tag picker with every suggestion, low confidence included, and shows a "Low confidence" badge next to the flagged ones. The status line counts them: "Suggested tags for 89 transactions, 30 with low confidence."

Training rows are read in `date, id` order.

`meta.model_name` becomes `nearest_neighbour + <model>`, for example `nearest_neighbour + logistic_regression`. `meta.score` is still the model's cross-validated macro-F1.

A model file saved before this change has no index. Predict then uses the model alone, with the same `low_confidence` rule. Retraining replaces the file.

Unchanged: routes, request shapes, the untagged-row filter, and retraining being manual.

## Evaluation

`classifier/benchmarks/replay_eval.py` replays an account month by month. It trains on everything tagged before the month and predicts that month's rows. Only aggregates are printed. Results on 2026-11-25, user 1:

| Account 11, last 12 months, 1,163 rows | Coverage | Precision |
| --- | --- | --- |
| Current, always suggest | 100% | 78.9% |
| Current, the same share of rows by confidence | 79.0% | 87.5% |
| New, not flagged low confidence | 79.0% | 91.3% |
| New, every row (what predict returns) | 100% | 83.5% |
| Second occurrence (merchant seen once before), current | 100% | 69.6% |
| Second occurrence, new | 100% | 81.2% |

| Account 10, last 36 months with data, 214 rows | Coverage | Precision |
| --- | --- | --- |
| Current, the same share of rows by confidence | 59.3% | 66.1% |
| New, not flagged low confidence | 59.3% | 78.7% |
| Second occurrence, current | 100% | 80.0% |
| Second occurrence, new | 100% | 84.0% |

The thresholds were chosen on these replays. Account 10's window is small, and its merchants seen 2–4 times did worse (19 of 29 right against 23).
