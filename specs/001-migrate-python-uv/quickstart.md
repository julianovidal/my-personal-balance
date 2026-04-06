# Quickstart: uv Package Management for Python Services

## Prerequisites

- [uv installed locally](https://docs.astral.sh/uv/getting-started/installation/)
- podman and podman-compose installed
- Working clone of this repository

## Install uv (one-time)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or via Homebrew on macOS:

```bash
brew install uv
```

---

## Daily Workflows

### Install dependencies locally (backend)

```bash
cd backend
uv sync
```

### Install dependencies locally (classifier)

```bash
cd classifier
uv sync
```

### Add a new dependency

```bash
# From inside the service directory
uv add fastapi==0.117.0          # pin to exact version (preferred)
uv add "httpx>=0.27"             # or with a range constraint
```

This updates both `pyproject.toml` and `uv.lock`. Commit both files.

### Remove a dependency

```bash
uv remove <package-name>
```

### Update a specific dependency

```bash
uv lock --upgrade-package <package-name>
```

Commit the updated `uv.lock`.

### Run a command in the uv-managed environment

```bash
uv run python -m app.scripts.seed
uv run pytest
uv run alembic upgrade head
```

---

## Container Builds

Build and start the full stack (from project root):

```bash
podman-compose -f podman-compose.yml up --build
```

Build a single service:

```bash
podman-compose build backend
podman-compose build classifier
```

---

## Validate After Changes

After any dependency change:

1. Ensure `uv.lock` is committed alongside `pyproject.toml`
2. Rebuild the affected container: `podman-compose build <service>`
3. Start it: `podman-compose up <service>`
4. Confirm health: `curl http://localhost:8000/health` (backend) or `curl http://localhost:8001/health` (classifier)

---

## File Reference

| File | Purpose |
|---|---|
| `backend/pyproject.toml` | Backend project metadata and dependency declarations |
| `backend/uv.lock` | Backend locked dependency graph (commit this) |
| `classifier/pyproject.toml` | Classifier project metadata and dependency declarations |
| `classifier/uv.lock` | Classifier locked dependency graph (commit this) |
