# Classifier: suggest from the closest tagged rows

## Problem Statement

How might we suggest the right tag from a merchant's first repeat, and suggest fewer wrong tags overall, without making the user tag the same thing over and over?

## Recommended Direction

Nearest-neighbour retrieval over normalized descriptions first, the existing TF-IDF model as the fallback, with its unsure guesses flagged "Low confidence" in the UI. A merchant tagged once matches its next occurrence by construction. Similar wording (different store numbers, references, typos) is handled by character n-grams after normalization. One similarity threshold and one confidence threshold decide which suggestions are flagged.

When neighbours disagree, the majority of the three closest rows wins, with lowered confidence. Among equally similar rows the newest vote, which turned out to matter more than anything else: tagging habits drift over years.

Local embeddings (qwen3-embedding:0.6b) come later, and only if the replay shows the remaining misses are semantic (a new merchant of a known kind). They don't help repeats.

## Key Assumptions to Validate

- [x] The same merchant stays lexically similar after normalization. On account 11, second occurrences went from 69.6% to 81.2% right.
- [x] Recency beats history for frequent merchants. Newest-first ties raised precision on merchants seen 5+ times from 89.1% to 95%+.
- [ ] Thresholds of 0.6/0.6 generalize. They were picked on the same replay they are reported on. Re-run `benchmarks/replay_eval.py` after a few months of new tags.
- [x] Leaving about 20% of rows blank felt worse in manual testing than a flagged guess, so every row now gets one.
- [ ] Account 10's weaker 2–4x bucket (n=29) is noise, not a pattern.

## MVP Scope

In: `app/services/retrieval.py` (normalize, index, vote), `suggest_tags` in `training.py`, training rows ordered by date, the replay harness, and tests.

In, after testing: `low_confidence` on each prediction and a badge on the Classifier page.

Out: schema changes, auto-retrain, embeddings, cross-account memory.

## Not Doing (and Why)

- Auto-retrain on every tag. The user is fine with the retrain button.
- Embeddings or LLM fallback. They add an Ollama runtime dependency for new-merchant gains only. Revisit with replay data.
- Cross-account memory. Accounts are in different banks with different description formats; unmeasured.
- Tuning the three TF-IDF candidates. They are now a fallback; their baseline tests stay as they are.
- Showing a runner-up tag. The user chose majority with lowered confidence.

## Open Questions

- Should training also leave out split parents, like the untagged list does? The replay excluded them; production training still includes them.
- Should `meta.score` report the replay-style precision instead of the model's macro-F1?
