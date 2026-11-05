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

`pytest` is not a dependency yet and there is no test suite. Once it is added, run tests with `uv run pytest`.

## Development Guidelines

### Code Standards

- Follow PEP 8 and FastAPI conventions
- Separate business logic from HTTP handlers and DB queries
- All functions must have a single, clearly defined responsibility

### File Organization

- `app/` — application source
- `alembic/` — database migrations
- `pyproject.toml` — project metadata and dependencies
- `uv.lock` — locked dependency graph (commit this)
