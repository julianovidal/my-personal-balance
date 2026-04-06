FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Set uv environment for container use.
# UV_PROJECT_ENVIRONMENT places the venv at /venv (outside /app) so it survives
# the dev compose volume mount (./classifier:/app) without being hidden.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/venv

WORKDIR /app

# Install dependencies via uv (layer-cached before copying app code)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Add venv to PATH so uvicorn etc. are available system-wide
ENV PATH="/venv/bin:$PATH"

COPY app ./app
COPY data ./data

EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
