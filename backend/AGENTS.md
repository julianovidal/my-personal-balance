# My Personal Balance - Backend

This project is the backend for My Personal Balance.

## Project Specification

- FastAPI
- SQLAlchemy
- JWT auth
- Database: Postgres
- Package manager: uv

## Database Domain model

The domain tables are listed under [Backend in the root `AGENTS.md`](../AGENTS.md#backend). Column definitions are in `app/models/`.

## Database migrations

The backend container runs migrations at startup via:

- `alembic upgrade head`

To run manually:

```bash
cd backend
uv run alembic upgrade head
```

## Seed demo data

Run seed in the backend container:

```bash
podman exec -it balance-api python -m app.scripts.seed
```

## CSV/XLSX import format

Required columns:

- `date`
- `description`
- `amount`

Optional:

- `currency` (defaults to selected account currency if missing/blank)
- `tag_id`

## Dependency Management

Dependencies are managed with [uv](https://docs.astral.sh/uv/).
The `pyproject.toml` is the source of truth; `uv.lock` pins exact versions.
**Always commit both files together.**

### Install dependencies locally

```bash
cd backend
uv sync
```

### Add a new dependency

```bash
cd backend
uv add <package>==<version>
```

This updates both `pyproject.toml` and `uv.lock`. Commit both.

### Remove a dependency

```bash
cd backend
uv remove <package>
```

### Update a dependency

```bash
cd backend
uv lock --upgrade-package <package>
```

### Run commands in the uv environment

```bash
cd backend
uv run python -m app.scripts.seed
uv run alembic upgrade head
```

### Tests

```bash
cd backend
uv run pytest
```

`pytest` and `httpx` are in the `dev` dependency group. Tests in `tests/` that exercise pure functions need no database. API tests use a real Postgres database, `balance_test`, on the compose `db` service (`localhost:5432`), created on first run and kept separate from `balance`. Set `TEST_DATABASE_URL` to use another one. Do not switch to SQLite: the queries rely on Postgres behavior.

## Known issues

Found while rebuilding the frontend. Not fixed yet.

- `GET /accounts/balances` returns `balance` and `overall_balance` as floats, not decimal strings, and `overall_balance` adds accounts of different currencies together. The frontend shows per-currency totals instead.
- `GET /transactions/summary/monthly` and `/transactions/analytics/*` add amounts across currencies.
- `GET /transactions` adds a remainder row for partly split transactions with a negative `id` and the description `Missing Spllited Transactions` (typo). The frontend relabels it.

## Development Guidelines

### Code Standards

- Follow PEP 8 and FastAPI conventions
- Separate business logic from HTTP handlers and DB queries
- All functions must have a single, clearly defined responsibility

### File Organization

- `app/` — application source
  - `app/services/dashboard_insights.py` — dashboard rules (anchor, baseline, signals, balance history)
- `tests/` — pytest suite
- `alembic/` — database migrations
- `pyproject.toml` — project metadata and dependencies
- `uv.lock` — locked dependency graph (commit this)
