# My Personal Balance

Self-hosted personal finance app. Track accounts, transactions, transfers, and tags, import bank exports, and classify untagged transactions with a per-account model.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind, shadcn/ui, TanStack Query |
| Backend | FastAPI, SQLAlchemy, Alembic, JWT |
| Classifier | FastAPI, scikit-learn |
| Database | PostgreSQL 16 |
| Runtime | Podman and podman-compose |
| Packages | pnpm (frontend), uv (Python) |

## Run

```bash
podman-compose -f podman-compose.yml up --build
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API docs | http://localhost:8000/docs |
| Classifier health | http://localhost:8001/health |

Migrations run on backend startup. Load demo data with:

```bash
podman exec -it balance-api python -m app.scripts.seed
```

Demo login: `demo@balance.local` / `demo1234`

## Layout

```text
backend/      FastAPI API
classifier/   ML tag prediction
frontend/     React app
specs/        Feature notes
```

Service-specific conventions live in each directory's `AGENTS.md`. Cross-service context for future sessions is in the root `AGENTS.md`.

## Contributing

Commit subjects use one prefix:

```text
[docs|specs|tech] <description>
```

| Prefix | Use for |
| --- | --- |
| `[docs]` | README, `AGENTS.md`, and other documentation |
| `[specs]` | Feature notes under `specs/` |
| `[tech]` | Application code, tests, migrations, and dependencies |

Keep each commit to a single prefix. Write the description in the imperative mood, for example `[tech] add monthly tag trend filter`.

- Use pnpm in `frontend/` and uv in `backend/` and `classifier/`. Commit the lockfile with any dependency change.
- Add a new Alembic revision for schema changes. Do not edit a revision that has already been applied.
- Cover frontend changes that render money or accept user input with a Vitest test.
- Do not commit `.env` files or classifier `.joblib` models.

## License

MIT
