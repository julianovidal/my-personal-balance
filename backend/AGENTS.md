# My Personal Balance - Backend

FastAPI, SQLAlchemy 2, Postgres, JWT auth. Read the root [`AGENTS.md`](../AGENTS.md) first: it has the domain tables, conventions, and commit rules. Route-to-page mapping is in [`docs/api-map.md`](../docs/api-map.md).

## Commands

Use uv. `pyproject.toml` and `uv.lock` are committed together.

```bash
uv sync                                  # install
uv add <package>==<version>              # add a dependency (updates both files)
uv run alembic upgrade head              # migrate (the container also does this at startup)
uv run pytest                            # tests
podman exec -it balance-api python -m app.scripts.seed   # demo data in compose
```

## Layout

```text
app/
├── main.py       app, CORS, routers under /api
├── api/          HTTP handlers, one router per resource; deps.py has get_current_user
├── core/         config, database session, security (JWT, bcrypt), currency, default_tags
├── models/       SQLAlchemy tables (column definitions live here)
├── schemas/      Pydantic request and response models
├── services/     dashboard_insights.py (dashboard rules), import_service.py (CSV/XLSX parsing)
└── scripts/      seed.py
alembic/versions/ migrations (add a new revision, never edit an applied one)
tests/            pytest suite, fixtures in conftest.py
```

New logic goes in `app/services/` as plain functions that take a `Session` or data and can be tested without HTTP. The `_helpers` in `api/transactions.py` are legacy (see the root thin-handlers rule).

## Rules

- Every query filters by the caller's `user_id`. Look up owned rows and return 404 when missing, not 403.
- Money is `Decimal` end to end. Never cast to `float` in new code.
- Totals must not mix currencies. Group by currency.
- Queries over all accounts must skip one side of each transfer pair, and must count either the split parent or its parts, never both.

## Import

`services/import_service.py` reads CSV or XLSX. The column names come from the account's `account_import_mappings` row. The fallback names are `date`, `description`, `amount`, and optional `currency` and `tag_id`. A blank currency falls back to the account currency.

## Tests

Pure function tests need no database. API tests use a real Postgres database, `balance_test`, on the compose `db` service (`localhost:5432`). It is created on first run and kept separate from `balance`. Set `TEST_DATABASE_URL` to use another one. Do not switch to SQLite: the queries rely on Postgres behavior.

## Known issues

Not fixed yet. Do not "fix" them as a side effect of other work; each needs its own spec.

- `GET /accounts/balances` returns `balance` and `overall_balance` as floats, not decimal strings, and `overall_balance` adds accounts of different currencies together. The frontend shows per-currency totals instead.
- `GET /transactions/summary/monthly` and `/transactions/analytics/*` add amounts across currencies.
- `GET /transactions` adds a remainder row for partly split transactions with a negative `id` and the description `Missing Spllited Transactions` (typo). The frontend relabels it.
