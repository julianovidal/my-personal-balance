# Balance 3

Local expense manager scaffold:
- Backend: FastAPI + SQLAlchemy + JWT auth
- Classifier: FastAPI + scikit-learn (per-account transaction tag prediction)
- Frontend: React + TypeScript + Tailwind + shadcn-style components
- Database: Postgres
- Runtime: Podman compose

## Features in this baseline
- Login and register
- Profile page
- Accounts CRUD
- Tags CRUD (create/list/update/delete API + UI)
- Transactions CRUD (create/list/update/delete API + UI)
- CSV/XLSX import for transactions
- Single-tag classification per transaction
- Dedicated classifier service to train/predict tags from description (scoped by user/account)
- Dashboard with current month balance and latest transactions
- Transactions explorer with filters by month/year/tag, server-side pagination, and sorting
- Monthly expense charts by tag and account
- Monthly summary cards (income, expenses, net) plus per-account monthly breakdown
- CSV template download and import preview/validation before insert
- Account-level import column mapping in Profile > Account settings
- Account transfer transactions (paired in source/destination accounts, deduped in all-accounts views)
- Alembic migrations
- Seed script with demo data

## Domain model
- users (`id`, `name`, `email`, `password`)
- accounts (`id`, `name`, `currency`, `user_id`)
- tags (`id`, `label`, `user_id`)
- transactions (`id`, `date`, `description`, `account_id`, `tag_id`, `amount`, `currency`)

## Run locally with Podman

Prerequisites:
- podman
- podman-compose

From project root:

```bash
podman-compose -f podman-compose.yml up --build
```

Apps:
- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- Classifier health: http://localhost:8001/health
- Health: http://localhost:8000/health

## Database migrations

The backend container runs migrations at startup via:
- `alembic upgrade head`

To run manually:

```bash
cd backend
alembic upgrade head
```

## Seed demo data

Run seed in the backend container:

```bash
podman exec -it balance-api python -m app.scripts.seed
```

Demo login:
- Email: `demo@balance.local`
- Password: `demo1234`

## CSV/XLSX import format
Required columns:
- `date`
- `description`
- `amount`

Optional:
- `currency` (defaults to selected account currency if missing/blank)
- `tag_id`

## Suggested next steps
- Add pagination and server-side sorting
- Add monthly charts and category breakdown
- Add automated tests
