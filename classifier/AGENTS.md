# My Personal Balance - Classifier

FastAPI and scikit-learn service that trains and serves per-account tag prediction. Read the root [`AGENTS.md`](../AGENTS.md) first: it has the training rules, conventions, and commit rules. Frontend calls are in [`docs/api-map.md`](../docs/api-map.md#classifier--classifierpage-via-classifierapi).

## Commands

Use uv. `pyproject.toml` and `uv.lock` are committed together.

```bash
uv sync                                          # install
uv add <package>==<version>                      # add a dependency (updates both files)
uv run uvicorn app.main:app --reload --port 8001 # run locally
uv run pytest -W error::FutureWarning -W error::DeprecationWarning   # tests
```

Python 3.14 (`.python-version`).

## Tests

`tests/` needs no database. `fixtures.py` holds synthetic rows only, never real transactions.

- `test_training.py` fits each candidate in `_candidate_models()` directly and checks its macro-F1 against recorded baselines, on equal-sized and uneven tag fixtures. `train_model` skips a candidate that raises, so a broken candidate would otherwise only show up as a different winner.
- `test_model_store.py` covers saving, loading, and unloadable model files.
- When a scikit-learn upgrade changes a baseline score by more than the tolerance, treat it as a behavior change and ask before updating the number.

## Layout

```text
app/
├── main.py       routes (untagged list, train, predict) and ownership checks
├── core/         config (MODEL_DATA_DIR), read access to the shared database, security
├── schemas/      Pydantic request and response models
└── services/
    ├── training.py     candidate models, cross-validated macro-F1 scoring, predict_with_confidence
    └── model_store.py  joblib save and load per user and account
data/             model files (gitignored, never commit .joblib)
```

## Rules

- This service reads the backend's database and never writes tags. Predictions go back to the frontend, which applies them through the backend.
- `core/security.py` decodes the backend's JWT with the shared `SECRET_KEY` from `backend/.env`. Every route except `/health` needs it. Check account ownership before reading rows or a model.
- Keep training and prediction in `services/training.py` as functions over plain rows, so they can be tested without a database.
- A `.joblib` file that fails to load counts as no model: predict answers "retrain first" and the service logs a warning. scikit-learn does not promise pickles load across versions, so after a scikit-learn upgrade, check that saved models still load and predict. Models from 1.7.1 did on 1.9.1.

## Known issues

- `GET /api/classifier/transactions/untagged` returns every untagged non-transfer row, including split parts and split parents. Tagging a split part through `PUT /transactions/:id` keeps it in its split; only its description and tag can change there.
- There is no route to read the current model's metadata. The frontend shows it only after a train or predict call.
- `calibrated_linear_svc` is skipped on accounts where a tag has fewer than 3 rows in a training fold, because `CalibratedClassifierCV(cv=3)` needs 3 per tag. `train_model` hides the error, so only the other two candidates compete there.
