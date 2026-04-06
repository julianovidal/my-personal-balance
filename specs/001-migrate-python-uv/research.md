# Research: Migrate Python Services to uv Package Manager

## uv in Docker Containers

**Decision**: Use the official uv binary copy pattern — `COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv` — rather than installing uv via pip or a shell script.

**Rationale**: Copying the static binary from the official uv image is the lightest-weight, most reproducible approach. It adds no pip overhead, requires no internet call at build time beyond the layer pull, and is the approach recommended by Astral (uv's authors) in their official Docker documentation.

**Alternatives considered**:
- `pip install uv` — adds an extra pip invocation, slightly heavier, mixing two package management tools
- `curl | sh` installer — not reproducible, depends on external script availability
- Using `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` as the base image — viable but ties the base image choice to uv's release cadence; copying the binary into the existing `python:3.12-slim` base is more flexible

---

## Project Declaration Format

**Decision**: Use `pyproject.toml` with a `[project]` section listing all production dependencies. No `[tool.uv]` workspace or package extras are needed since both services are single-service applications, not distributable libraries.

**Rationale**: `pyproject.toml` is the modern Python standard (PEP 517/518/621) and is natively understood by uv. It serves as both the project descriptor and the dependency manifest, replacing `requirements.txt` entirely. uv will generate a `uv.lock` file alongside it.

**Alternatives considered**:
- Keeping `requirements.txt` and using `uv pip install -r requirements.txt` — works but loses the lock file and uv's full dependency resolution benefits; inconsistent with the uv-native workflow
- Using `uv export --format requirements-txt` to generate a pip-compatible file — adds indirection and defeats the purpose of adopting uv

---

## Docker Installation Command

**Decision**: Use `uv sync --frozen --no-cache` to install dependencies in the container.

**Rationale**:
- `--frozen` ensures the lock file is used exactly as committed — no resolution at build time, fully reproducible
- `--no-cache` avoids uv's local cache inside the container layer, keeping image size minimal
- `uv sync` installs all non-dev dependencies defined in `pyproject.toml` and pinned in `uv.lock`

**Environment variables to set in Dockerfile**:
- `UV_COMPILE_BYTECODE=1` — pre-compiles `.pyc` files during install, reducing cold-start time at container startup
- `UV_LINK_MODE=copy` — required in container environments where hardlinks across filesystems are not supported (the default `hardlink` mode fails in many container runtimes)

**Alternatives considered**:
- `uv pip install --system` — skips the lock file, not reproducible
- `uv pip sync requirements.txt` — requires generating requirements.txt from lock, extra step

---

## Lock File Strategy

**Decision**: The `uv.lock` file MUST be generated locally by engineers and committed to version control. Container builds MUST use `--frozen` and never re-resolve.

**Rationale**: Committing the lock file guarantees that every environment — local, CI, container — installs identical package versions. Re-resolving inside a Docker build introduces non-determinism and can silently change behavior when upstream packages are updated.

**How to generate/update**:
- Initial generation: `uv lock` inside the service directory
- Adding a dependency: `uv add <package>==<version>` (updates both `pyproject.toml` and `uv.lock`)
- Updating a dependency: `uv lock --upgrade-package <package>`

---

## Python Version

**Decision**: Both services target **Python 3.12**, consistent with their current `python:3.12-slim` Docker base images. `pyproject.toml` will declare `requires-python = ">=3.12"`.

**Rationale**: No Python version change is needed or desired; the migration is purely a package management tooling change.

---

## Legacy File Removal

**Decision**: `requirements.txt` MUST be deleted from both `backend/` and `classifier/` as the final step of each service migration, after the container build and health check have been validated.

**Rationale**: Retaining `requirements.txt` alongside `pyproject.toml` creates confusion about which file is authoritative. Any automation or agent that discovers `requirements.txt` may use pip instead of uv, silently bypassing the lock file.

**Order of operations**: Validate → then delete. Never delete before validating the new setup works.
