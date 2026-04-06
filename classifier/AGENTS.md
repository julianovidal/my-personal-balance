# My Personal Balance - Classifier

This project is a transaction classifier for My Personal Balance.

## Project Specification

- FastAPI
- scikit-learn (per-account transaction tag prediction)
- Package manager: uv

## Dependency Management

Dependencies are managed with [uv](https://docs.astral.sh/uv/).
The `pyproject.toml` is the source of truth; `uv.lock` pins exact versions.
**Always commit both files together.**

### Install dependencies locally

```bash
cd classifier
uv sync
```

### Add a new dependency

```bash
cd classifier
uv add <package>==<version>
```

This updates both `pyproject.toml` and `uv.lock`. Commit both.

### Remove a dependency

```bash
cd classifier
uv remove <package>
```

### Update a dependency

```bash
cd classifier
uv lock --upgrade-package <package>
```

### Run commands in the uv environment

```bash
cd classifier
uv run uvicorn app.main:app --reload
uv run pytest
```

## Development Guidelines

### Code Standards

- Follow PEP 8 and FastAPI conventions
- Separate business logic from HTTP handlers and DB queries
- ML model training and prediction logic must be independently testable

### File Organization

- `app/` — application source
- `data/` — model data directory (`.joblib` files, excluded from git)
- `pyproject.toml` — project metadata and dependencies
- `uv.lock` — locked dependency graph (commit this)
