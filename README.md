# My Personal Balance

A self-hosted personal finance manager. Track bank accounts, categorise transactions, import bank exports, and visualise your financial health — all running locally on your own machine.

## Features

- **Multi-account management** — create accounts in different currencies (EUR, USD, BRL) and track balances independently
- **Transaction tracking** — full CRUD with date, description, amount, currency, and tag
- **Account transfers** — paired transfer transactions between accounts, deduplicated in all-accounts views
- **CSV / XLSX import** — import bank exports with configurable column mapping per account; preview before committing
- **Tag-based classification** — assign tags to transactions manually or use the ML classifier to predict tags from transaction descriptions
- **ML classifier service** — per-account scikit-learn model; retrain on demand, bulk-predict untagged transactions
- **Dashboard** — current-month income / expenses / net, patrimony evolution chart (yearly), income vs. expenses chart (last 12 months), and latest transactions
- **Transactions explorer** — filter by date range, account, tag, and free text; server-side pagination; monthly summary cards and per-tag breakdown
- **Dark / light mode**

## Stack

| Layer | Technology |
| --- | --- |
| Backend API | Python 3.12 · FastAPI · SQLAlchemy · Alembic · JWT auth |
| Classifier | Python 3.12 · FastAPI · scikit-learn |
| Frontend | Node.js 22 · TypeScript 5.9 · React 19 · Vite 8 · Tailwind CSS 3 · shadcn/ui · TanStack Query 5 |
| Database | PostgreSQL 16 |
| Runtime | Podman · podman-compose |
| Package managers | uv (Python) · pnpm (Node) |
| Testing | pytest (backend) · Vitest + Testing Library (frontend) |

## Getting started

### Prerequisites

- [Podman](https://podman.io) and [podman-compose](https://github.com/containers/podman-compose)

### Run

```bash
podman-compose -f podman-compose.yml up --build
```

| Service | URL |
| --- | --- |
| Frontend | <http://localhost:5173> |
| Backend API docs | <http://localhost:8000/docs> |
| Classifier health | <http://localhost:8001/health> |

### Demo data

Load a seed dataset with sample accounts, tags, and transactions:

```bash
podman exec -it balance-api python -m app.scripts.seed
```

Demo credentials: `demo@balance.local` / `demo1234`

## Database migrations

Migrations run automatically at backend container startup via `alembic upgrade head`.

To run manually:

```bash
cd backend
alembic upgrade head
```

## CSV / XLSX import

The importer accepts any CSV or XLSX file. Column names are configurable per account under **Accounts > Account import settings**.

Default expected column names:

| Field | Default column | Required |
| --- | --- | --- |
| Date | `date` | Yes |
| Description | `description` | Yes |
| Amount | `amount` | Yes |
| Currency | `currency` | No (falls back to account currency) |
| Tag ID | `tag_id` | No |

Download a pre-formatted CSV template from the import dialog.

## Project structure

```text
my-personal-balance/
├── backend/          # FastAPI API service
├── classifier/       # FastAPI ML classifier service
├── frontend/         # React SPA
├── specs/            # Feature specifications and implementation plans
└── podman-compose.yml
```

Each service has its own `AGENTS.md` with service-specific development guidelines.

## Contributing

This project follows a spec-first development workflow:

1. Write a feature specification in `specs/` before any implementation
2. Produce an implementation plan that passes the [project constitution](.specify/memory/constitution.md) checks
3. Implement following the task breakdown, with tests written before merge
4. All tests must pass on `main` at all times

See [AGENTS.md](AGENTS.md) for branch naming conventions and per-service guidelines.

## License

MIT
