# My Personal Balance - Classifier

FastAPI and scikit-learn service that trains and serves per-account tag prediction. Read the root [`AGENTS.md`](../AGENTS.md) first: it has the training rules, conventions, and commit rules. Frontend calls are in [`docs/api-map.md`](../docs/api-map.md#classifier--classifierpage-via-classifierapi).

## Commands

Use uv. `pyproject.toml` and `uv.lock` are committed together.

```bash
uv sync                                          # install
uv add <package>==<version>                      # add a dependency (updates both files)
uv run uvicorn app.main:app --reload --port 8001 # run locally
```

There is no test suite and `pytest` is not a dependency yet. Add it to a `dev` group with `uv add --dev pytest` when you write the first test.

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

## Known issues

- `GET /api/classifier/transactions/untagged` returns every untagged non-transfer row, including split parts and split parents. Tagging a split part through `PUT /transactions/:id` keeps it in its split; only its description and tag can change there.
- There is no route to read the current model's metadata. The frontend shows it only after a train or predict call.
