# Spec: Move the backend and classifier to Python 3.14 and refresh dependencies

## Objective

Run `backend/` and `classifier/` on Python 3.14 instead of 3.12, in compose and locally with uv. Move every direct dependency to its latest release at the same time.

What users see must not change: the same API responses, the same import results, and the same login. Classifier training must stay at least as good. The one planned exception is saved classifier models (see [Saved models](#saved-models)).

Python 3.14 is the older of the two versions that still get bugfix releases (3.14 and 3.15). It gets security fixes until about October 2030. `requires-python` becomes `>=3.14`, so 3.14 is the only version that is locked and tested.

## Current state

- Both `Dockerfile`s start `FROM python:3.12-slim`. Both `pyproject.toml` files say `requires-python = ">=3.12"`.
- Neither service has a `.python-version` file, and there is no CI.
- Four of the current pins have no CPython 3.14 wheels: `pandas` 2.3.2, `psycopg2-binary` 2.9.10, `pydantic-core` 2.33.2, and `scikit-learn` 1.7.1. The slim image has no compiler and no `libpq` headers, so they cannot build there.
- No tests cover CSV/XLSX import parsing (`backend/app/services/import_service.py`) or password hashing (`backend/app/core/security.py`). The classifier has no tests at all.

## Target versions

These were resolved on 2026-11-25 with `uv pip compile --only-binary :all: --python-version 3.14`. All of them resolve together, with wheels only, on Linux x86_64 (compose) and macOS arm64 (local). When the lock is written, re-resolve and use the newest versions at that time. A difference from this table is fine as long as it doesn't cross a new major version.

### Backend

| Package | From | To | Risk |
| --- | --- | --- | --- |
| `fastapi` | 0.116.1 | 0.165.0 | **High**: 49 minor releases, and 0.x minors can break things |
| `uvicorn[standard]` | 0.35.0 | 0.54.0 | Low |
| `sqlalchemy` | 2.0.43 | 2.1.9 | Medium: 2.1 removes some 2.0 deprecations |
| `alembic` | 1.16.5 | 1.20.1 | Low |
| `psycopg2-binary` | 2.9.10 | 2.9.13 | Low |
| `pydantic` | 2.11.7 | 2.14.4 | Low to medium |
| `pydantic-settings` | 2.10.1 | 2.16.3 | Low |
| `python-jose[cryptography]` | 3.5.0 | 3.5.0 | none |
| `passlib[bcrypt]` | 1.7.4 | removed | **High**: see [Password hashing](#password-hashing) |
| `bcrypt` | 4.0.1 | 5.0.0 | **High**: see [Password hashing](#password-hashing) |
| `python-multipart` | 0.0.20 | 0.0.34 | Low |
| `pandas` | 2.3.2 | 3.1.1 | **High**: major version, see [Import parsing](#import-parsing) |
| `openpyxl` | 3.1.5 | 3.1.5 | none |
| `email-validator` | 2.2.0 | 2.4.0 | Low |
| `httpx` (dev) | 0.28.1 | 0.28.1 | none |
| `pytest` (dev) | 8.4.2 | 9.2.0 | Low |

### Classifier

| Package | From | To | Risk |
| --- | --- | --- | --- |
| `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg2-binary`, `pydantic`, `pydantic-settings`, `python-jose[cryptography]` | as in the backend | as in the backend | as in the backend |
| `scikit-learn` | 1.7.1 | 1.9.1 | **High**: two minor releases; see [Classifier training](#classifier-training) and [Saved models](#saved-models) |
| `joblib` | 1.5.2 | 1.6.0 | Low |
| `numpy` | 2.3.3 | 2.5.5 | Low |
| `pytest` (new, dev) | — | 9.2.0 | none |

The two services share versions where they share packages.

## High-risk areas

### Import parsing

`import_service.py` reads uploads with `pd.read_csv` and `pd.read_excel`, loops with `iterrows`, and converts each cell with `pd.to_datetime(...).date()`, `str(...)`, `Decimal(str(...))`, and `pd.isna`. pandas 3 makes copy-on-write the only mode and gives text columns a new default string dtype. Neither should change these scalar conversions, but nothing tests them today.

Required:

- Before the upgrade, on 3.12 with pandas 2.3.2, add `backend/tests/test_import_service.py`. It tests the parser on in-memory CSV and XLSX bytes and covers:
  - ISO and day-first dates
  - negative amounts and amounts with two decimals (the `Decimal` value must match exactly)
  - a blank currency cell falling back to `None`
  - a currency cell with a value
  - a `tag_id` column with blanks
  - the empty-description error
  - a header mapping that uses non-default column names
- The same test must pass unchanged on pandas 3.

### Password hashing

`security.py` uses `passlib.CryptContext(schemes=["bcrypt"])`. `bcrypt` 4.0.1 was pinned because passlib 1.7.4 doesn't work with newer bcrypt. The original passlib project last released 1.7.4 in 2020. The 1.9.5 that PyPI now serves under the same name was uploaded on 2026-11-23 by a fork (`notypecheck/passlib`). bcrypt 5 also raises `ValueError` for passwords longer than 72 bytes, where older versions cut them off quietly.

Decision: remove passlib and call `bcrypt` directly.

Required:

- Before the upgrade, add `backend/tests/test_security.py`, which tests the public helpers in `security.py` (not passlib). It covers:
  - hash, then verify, then verify with a wrong password
  - checking a hash made by the current stack. A literal `$2b$` hash string goes in the test, so stored user passwords keep working.
  - a 73-byte password: it hashes, and it verifies against itself and against its first 72 bytes. This is today's truncating behavior.
- Then replace the passlib calls in `security.py` with `bcrypt.hashpw(password, bcrypt.gensalt())` and `bcrypt.checkpw(...)`, and drop `passlib` from `pyproject.toml`. Keep the helper function names and signatures, so callers don't change.
- **Verifying** encodes the password as UTF-8 and cuts it to 72 bytes before calling `checkpw`. This matches how existing hashes were made, so a user with a longer password can still log in. A malformed stored hash returns `False`, never a 500.
- **Hashing** a password longer than 72 bytes is rejected. Register (and any password change) returns a 4xx with a clear message.
- Update the 73-byte test to match: verifying a long password still works, and hashing one is rejected with that 4xx. This is the one place a baseline test's expectation changes on purpose.

### Classifier training

`training.py` uses `LogisticRegression(solver="liblinear")` on multiclass labels, `CalibratedClassifierCV(estimator=LinearSVC(...), cv=3)`, `ComplementNB`, `TfidfVectorizer(analyzer="char_wb")`, and `StratifiedKFold`/`cross_val_score`. Releases 1.8 and 1.9 may deprecate or change some of these parameters.

Required:

- Add the classifier's first tests, as the classifier `AGENTS.md` describes: `uv add --dev pytest` and `classifier/tests/test_training.py`. They cover `train_model` on fixed synthetic rows (at least 20 descriptions, 3 tags, a fixed seed) and `predict_with_confidence` on the trained bundle.
  - Run on 3.12 / scikit-learn 1.7.1 first and record the chosen model name and macro-F1.
  - After the upgrade, assert that the same model is chosen and macro-F1 is within 0.02.
- Run the tests with `-W error::FutureWarning -W error::DeprecationWarning` for `sklearn`. Fix any warning by updating `_candidate_models()`, for example by dropping parameters that are deprecated, so the pipelines stay equivalent. Do not hide warnings with filters.
- Check by hand on real data: before the upgrade, train one real account and note its model and macro-F1. Train it again afterwards and compare.

### Saved models

scikit-learn doesn't guarantee that pickles load across minor versions, so `.joblib` files saved under 1.7.1 may fail to load under 1.9.1. Today `load_model_bundle` calls `joblib.load` directly. A file that fails to unpickle turns `POST /predict` into a 500.

Required:

- `load_model_bundle` treats a file that fails to unpickle as if no model existed. It returns `None` and logs a warning with the user and account IDs. Predict then behaves as it does today for an account with no model, asking the user to train first.
- After deploy, each account is retrained from `/classifier`. The README or classifier `AGENTS.md` says so.
- This is the one behavior change in the spec.

### FastAPI, Starlette, SQLAlchemy 2.1, pydantic 2.14

These are covered by the backend API suite. Any new warnings at import or at startup are recorded and fixed, not silenced. Also check by hand that CORS still works from the frontend origin for both services, and that file uploads (multipart import) still work.

## Changes

| File | Change |
| --- | --- |
| `backend/Dockerfile`, `classifier/Dockerfile` | `FROM python:3.14-slim` |
| `backend/pyproject.toml`, `classifier/pyproject.toml` | `requires-python = ">=3.14"`; all pins as above, kept exact (`==`) |
| `backend/uv.lock`, `classifier/uv.lock` | regenerated |
| `backend/.python-version`, `classifier/.python-version` | new, containing `3.14` |
| `backend/tests/test_import_service.py`, `backend/tests/test_security.py` | new, written before the upgrade |
| `classifier/tests/test_training.py`, `classifier/tests/__init__.py` | new, written before the upgrade |
| `classifier/app/services/model_store.py` | an unloadable model counts as missing |
| `classifier/app/services/training.py` | only if a scikit-learn deprecation requires it |
| `backend/app/core/security.py` | passlib replaced with direct `bcrypt` calls |
| `backend/app/schemas/` (user/auth) or the register handler | reject passwords longer than 72 bytes with a 4xx |
| `AGENTS.md`, `backend/AGENTS.md`, `classifier/AGENTS.md` | Python 3.14; the classifier now has a test suite; retrain after a scikit-learn upgrade |

## Commands

```bash
# baseline, before any version change
cd backend && uv run pytest
cd classifier && uv add --dev pytest==8.4.2 && uv run pytest

# upgrade, per service
cd backend && uv python install 3.14
#   edit pyproject.toml: requires-python and pins
cd backend && uv lock && uv sync
cd classifier && uv lock && uv sync

# verify
cd backend && uv run pytest
cd classifier && uv run pytest -W error::FutureWarning -W error::DeprecationWarning
kiri compose -f compose.yml up --build
kiri exec balance-api python --version
kiri exec balance-classifier python --version
kiri exec balance-api pytest
```

## Commits

1. `[specs] move the backend and classifier to python 3.14 with a dependency refresh` (this file)
2. `[tech] cover import parsing and password hashing with tests`, on 3.12
3. `[tech] add a classifier test suite for training and prediction`, on 3.12
4. `[tech] hash passwords with bcrypt directly instead of passlib`, still on 3.12 with bcrypt 4.0.1
5. `[tech] move the backend to python 3.14 and refresh its dependencies`
6. `[tech] treat unloadable classifier models as untrained`
7. `[tech] move the classifier to python 3.14 and refresh its dependencies`
8. `[docs] note python 3.14, the classifier tests, and retraining after upgrades`

Commits 2 and 3 must pass on the old stack before any version change. That's what makes them a baseline. Commit 4 swaps the hashing library while Python and bcrypt stay at their old versions, so a login failure there can be traced to it alone.

## Boundaries

- **Always:** commit each `pyproject.toml` with its `uv.lock`; keep pins exact; write the tests that lock in current behavior before changing versions; use kiri for containers.
- **Ask first:** keeping bcrypt below 5, changing a test's expected value (other than the 73-byte case above) to make it pass after the upgrade, or a change in `training.py` that changes which models are candidates or their hyperparameters.
- **Never:** silence warnings with filters to get to green, edit an applied Alembic revision, commit `.joblib` models or `.env`, or read `backups/`.

## Success criteria

- [ ] Both containers report `Python 3.14.x`, and `uv sync --frozen` builds nothing from source.
- [ ] Every direct dependency is at its latest release as of the lock date, and the two services share versions where they share packages.
- [ ] The new import, security, and training tests pass on 3.12 before the upgrade and on 3.14 after it, without changes to their expected values.
- [ ] The full backend suite passes on 3.14, on the host and in the container.
- [ ] The classifier suite passes with deprecation and future warnings treated as errors.
- [ ] Existing users can log in with their stored passwords, and `passlib` is no longer a dependency.
- [ ] Registering with a password longer than 72 bytes returns a 4xx, not a 500.
- [ ] A real CSV import and a real XLSX import produce the same rows as before.
- [ ] Classifier training on one real account picks the same model, with macro-F1 within 0.02 of the 3.12 run.
- [ ] Predict on an account whose model was saved under scikit-learn 1.7.1 returns the "train first" response, not a 500.

## Decisions

- `requires-python = ">=3.14"`.
- Broad refresh: every direct dependency moves to its latest release.
- A model file that fails to load counts as untrained, and the user retrains.
- passlib is removed, and passwords are hashed and checked with `bcrypt` directly.
- Import tests build their CSV and XLSX in memory. No sample files are added.
