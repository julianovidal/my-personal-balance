# Implementation Plan: Migrate Python Services to uv Package Manager

**Branch**: `001-migrate-python-uv` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-migrate-python-uv/spec.md`

## Summary

Migrate the `backend` and `classifier` Python services from `pip` + `requirements.txt`
to `uv` + `pyproject.toml` + `uv.lock`. Update both Dockerfiles to install dependencies
via uv's binary copy pattern with `--frozen` to guarantee reproducible container builds.
Remove all `requirements.txt` files once each service is validated. Update AGENTS.md
files to document the new uv-based workflow for engineers and AI agents.

## Technical Context

**Language/Version**: Python 3.12 (both backend and classifier)
**Primary Dependencies**:

- Backend: FastAPI, SQLAlchemy, Alembic, psycopg2-binary, pydantic, python-jose, passlib, pandas, openpyxl
- Classifier: FastAPI, SQLAlchemy, psycopg2-binary, pydantic, scikit-learn, numpy, joblib

**Storage**: PostgreSQL 16 (unchanged)
**Testing**: Manual smoke test via `/health` endpoints and full-stack `podman-compose up`
**Target Platform**: Linux container (python:3.12-slim base image), Podman runtime
**Project Type**: Two web services (backend API + classifier API), containerized
**Performance Goals**: Container build time for the dependency installation step MUST be
faster than the current `pip install -r requirements.txt` baseline
**Constraints**: Zero application regressions; lock file MUST be committed; legacy
`requirements.txt` files MUST be removed after validation
**Scale/Scope**: Two services, ~14 backend deps + ~10 classifier deps

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
| --- | --- | --- |
| I. Code Quality | No dead code; `requirements.txt` removed (not left alongside `pyproject.toml`); each Dockerfile has a single responsibility | ✅ Pass — FR-009 mandates removal; plan enforces validate-then-delete order |
| II. Testing Standards | Health check validation required before closing; smoke test of all endpoints | ✅ Pass — SC-001, SC-002, SC-005 define explicit validation gates |
| III. UX Consistency | Not applicable — no frontend or user-facing changes | ✅ N/A |
| IV. Performance Requirements | Build time for dep installation MUST improve; `uv sync --frozen` is measurably faster than `pip install` | ✅ Pass — SC-004 requires measurement; uv is documented to be 10–100× faster than pip |

**Post-design re-check**: No API contracts change. No data model change. No behavior
change. All four principle gates remain passing after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/001-migrate-python-uv/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created here)
```

### Source Code Changes

```text
backend/
├── pyproject.toml        ← NEW: replaces requirements.txt
├── uv.lock               ← NEW: generated and committed
├── Dockerfile            ← MODIFIED: use uv binary + uv sync --frozen
└── requirements.txt      ← DELETED: after validation

classifier/
├── pyproject.toml        ← NEW: replaces requirements.txt
├── uv.lock               ← NEW: generated and committed
├── Dockerfile            ← MODIFIED: use uv binary + uv sync --frozen
└── requirements.txt      ← DELETED: after validation

backend/AGENTS.md         ← MODIFIED: document uv workflow
classifier/AGENTS.md      ← MODIFIED: document uv workflow
```

**Structure Decision**: Multi-service web app (Option 2 variant). Only `backend/` and
`classifier/` are in scope. `frontend/` is explicitly out of scope.

## Phase 0: Research

**Status**: Complete — see [research.md](research.md)

Key decisions resolved:

| Question | Decision |
| --- | --- |
| How to get uv into the container? | Copy static binary from `ghcr.io/astral-sh/uv:latest` |
| What install command in Docker? | `uv sync --frozen --no-cache` |
| Project declaration format? | `pyproject.toml` with `[project]` section; `uv.lock` committed |
| When to delete `requirements.txt`? | After service health check passes — validate then delete |
| Python version? | Python 3.12 (unchanged) |

## Phase 1: Design

### pyproject.toml — Backend

```toml
[project]
name = "backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.116.1",
    "uvicorn[standard]==0.35.0",
    "sqlalchemy==2.0.43",
    "alembic==1.16.5",
    "psycopg2-binary==2.9.10",
    "pydantic==2.11.7",
    "pydantic-settings==2.10.1",
    "python-jose[cryptography]==3.5.0",
    "passlib[bcrypt]==1.7.4",
    "bcrypt==4.0.1",
    "python-multipart==0.0.20",
    "pandas==2.3.2",
    "openpyxl==3.1.5",
    "email-validator==2.2.0",
]
```

### pyproject.toml — Classifier

```toml
[project]
name = "classifier"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.116.1",
    "uvicorn[standard]==0.35.0",
    "sqlalchemy==2.0.43",
    "psycopg2-binary==2.9.10",
    "pydantic==2.11.7",
    "pydantic-settings==2.10.1",
    "python-jose[cryptography]==3.5.0",
    "scikit-learn==1.7.1",
    "joblib==1.5.2",
    "numpy==2.3.3",
]
```

### Dockerfile Pattern (both services)

```dockerfile
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Set uv environment for container use
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /app

# Install dependencies first (layer caching)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Copy application code
COPY ... ./          # (service-specific files follow)
```

Note: The CMD line for each service remains unchanged — only the dependency
installation mechanism changes.

### Contracts

No API contracts change. This migration does not alter any endpoint signatures,
request/response schemas, or service interfaces. No contracts/ directory is needed.

### Data Model

No data model changes. All database entities, migrations, and schema remain identical.
No data-model.md is produced for this feature.

## Complexity Tracking

No constitution violations. No complexity justification required.
