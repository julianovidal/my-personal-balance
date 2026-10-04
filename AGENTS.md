# My Personal Balance

Self-hosted personal finance app: accounts, transactions, transfers, splits, tags, CSV/XLSX import, dashboards, and per-account tag prediction.

Read this file at the start of a new session, then the `AGENTS.md` in the service you are changing.

## Services

| Service | Path | Port | Role |
| --- | --- | --- | --- |
| Frontend | `frontend/` | 5173 | React SPA |
| Backend | `backend/` | 8000 | Auth, accounts, transactions, dashboard |
| Classifier | `classifier/` | 8001 | Train and predict tags |
| Postgres | compose service `db` | 5432 | Shared database `balance` |

Compose file: `podman-compose.yml`. Containers: `balance-web`, `balance-api`, `balance-classifier`, `balance-db`.

The classifier reads the same Postgres database and the same JWT secret as the backend. It does not write tags; the frontend applies predictions through the backend.

## Run

```bash
podman-compose -f podman-compose.yml up --build
podman exec -it balance-api python -m app.scripts.seed
```

Backend startup runs `alembic upgrade head`, then uvicorn with reload. Frontend and classifier source are bind-mounted.

Local commands, without compose:

```bash
cd frontend && pnpm install && pnpm run dev
cd backend && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd classifier && uv sync && uv run uvicorn app.main:app --reload --port 8001
```

Use pnpm in `frontend/` and uv in the Python services. Commit `pnpm-lock.yaml` and both `pyproject.toml` and `uv.lock` together.

## Frontend

Routes in `frontend/src/App.tsx`: `/login`, `/` (dashboard), `/accounts`, `/transactions`, `/classifier`, `/profile`. Everything except login sits behind `ProtectedRoute`.

- `src/api/client.ts` talks to `VITE_API_URL` (`http://localhost:8000/api`). The JWT is stored in `localStorage` under `token`.
- `src/api/classifierClient.ts` talks to `VITE_CLASSIFIER_API_URL` (`http://localhost:8001`) and attaches the same token.
- Server state uses TanStack Query. Shared types live in `src/types/index.ts`.
- UI primitives are shadcn/ui under `src/components/ui/`. Prefer those over one-off controls.
- Theme is light/dark via `src/lib/theme.ts`.

Tests: `pnpm test` (Vitest). Existing coverage is `LoginPage`, `AccountsPage`, and `ProfilePage`. Pages that render money or take user input need a test.

## Backend

Routers are mounted under `/api` in `backend/app/main.py`. The route-to-page map is in [API map](#api-map).

Auth is JWT (`python-jose`), password hashing is bcrypt. `get_current_user` scopes every query to the caller. Allowed currencies are `USD`, `EUR`, and `BRL` (`app/core/currency.py`).

Domain tables:

- `users` — name, email, password hash
- `accounts` — name, currency, user
- `tags` — label, user
- `account_import_mappings` — per-account CSV/XLSX column names
- `transactions` — date, description, amount, currency, optional tag
  - transfers: `is_transfer`, `transfer_group_id`, `transfer_direction` (`in`/`out`), `linked_account_id`
  - splits: `parent_transaction_id`

Import accepts CSV or XLSX. Required fields are date, description, and amount. Currency falls back to the account currency. Mapping is configured per account.

Migrations are in `backend/alembic/versions/`. Add a new revision for schema changes; do not edit applied revisions.

`uv run pytest` is the intended test command. There is no Python test suite in the repo yet.

## Classifier

Training uses tagged, non-transfer transactions for one account. It needs at least 20 descriptions and 2 distinct tags. It fits TF-IDF character n-grams with logistic regression, complement naive Bayes, and a calibrated linear SVM, then keeps the best macro-F1 model. The frontend calls are in [API map](#api-map).

Models are joblib files at `{MODEL_DATA_DIR}/model_user_{user_id}_account_{account_id}.joblib`. That directory is gitignored.

## API map

`api` (`frontend/src/api/client.ts`) already includes the `/api` prefix. `classifierApi` does not, so classifier paths below include `/api`. Every route except `POST /auth/register`, `POST /auth/login`, and the two `/health` checks requires the bearer token.

Paths the UI never calls: `GET /health`, `GET /health` on the classifier, and the optional `month`, `year`, `sort_by`, and `sort_order` query params on transaction list, summary, and analytics.

### Auth and profile

| Method | Path | Caller | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `AuthContext.register` | Body `{ name, email, password }`, then logs in |
| `POST` | `/auth/login` | `AuthContext.login` | Body `{ email, password }`, stores `access_token` |
| `GET` | `/profile` | `AuthContext` on load and after login | Current user. No profile update route |

### Accounts — `AccountsPage`, also read by Transactions and Classifier

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/accounts` | `["accounts"]` | Also on Transactions and Classifier |
| `POST` | `/accounts` | `save` | Body `{ name, currency }` |
| `PUT` | `/accounts/:id` | `save` | Same body when editing |
| `DELETE` | `/accounts/:id` | `remove` | |
| `GET` | `/accounts/balances` | `["accounts-balances"]` | Accounts page only |
| `GET` | `/accounts/:id/import-mapping` | `["account-import-mapping", selectedAccountId]` | Enabled once an account is selected |
| `PUT` | `/accounts/:id/import-mapping` | `saveMapping` | Column names: date, description, amount, currency, tag id |

Account create, update, and delete invalidate `["accounts"]` and `["accounts-balances"]`. Saving a mapping invalidates that account's mapping key only.

### Tags — `ProfilePage`, also read by Transactions and Classifier

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/tags` | `["tags"]` | Profile, Transactions, Classifier |
| `POST` | `/tags` | `createTag` | Body `{ label }` |
| `PUT` | `/tags/:id` | `createTag` | Same body when editing |
| `DELETE` | `/tags/:id` | `removeTag` | |

Tag writes invalidate `["tags"]` and `["transactions"]`.

### Dashboard — `DashboardPage`

| Method | Path | Query key | Notes |
| --- | --- | --- | --- |
| `GET` | `/dashboard/summary` | `["dashboard"]` | Current-month income, expenses, net, and 10 latest transactions |
| `GET` | `/dashboard/charts` | `["dashboard-charts"]` | Yearly patrimony and last 12 months of income vs expenses |

Transaction saves invalidate `["dashboard"]` only. `["dashboard-charts"]` is left stale until a refetch.

### Transactions — `TransactionsPage`

List and charts all send `date_from` and `date_to`. Account and tag filters are added only when set.

| Method | Path | Query key or mutation | Params or body |
| --- | --- | --- | --- |
| `GET` | `/transactions` | `["transactions", dateFrom, dateTo, accountFilter, tagFilter, textFilter, page, pageSize]` | `page`, `page_size`, optional `account_id`, `tag_id`, `search_text` |
| `GET` | `/transactions/summary/monthly` | `["transactions-summary", dateFrom, dateTo, accountFilter, tagFilter]` | Optional `account_id`, `tag_id` |
| `GET` | `/transactions/analytics/monthly` | `["transactions-analytics", dateFrom, dateTo, accountFilter, tagFilter]` | Optional `account_id`, `tag_id`. Expense totals by tag and by account |
| `GET` | `/transactions/analytics/tag-trend` | `["transactions-tag-trend", trendTagId, accountFilter]` | Enabled when a trend tag is selected. Required `tag_id`, optional `account_id`. Server always uses the last 12 months |
| `POST` | `/transactions` | `saveTx` | `{ date, description, account_id, tag_id, is_transfer, destination_account_id, amount, currency }` |
| `PUT` | `/transactions/:id` | `saveTx`, and Classifier `applyTagMutation` | Same body. Classifier sends `is_transfer: false` and the chosen `tag_id` |
| `DELETE` | `/transactions/:id` | `deleteTx` | |
| `GET` | `/transactions/:id/splits` | `openSplitModal` | Imperative call, not a query |
| `PUT` | `/transactions/:id/splits` | `saveSplits` | `{ rows: [{ id, description, amount, tag_id }] }` |
| `POST` | `/transactions/import/preview/:accountId` | `previewUpload` | Multipart `file`, optional `default_tag_id` |
| `POST` | `/transactions/import/:accountId` | `upload` | Same upload. Response `{ imported, skipped }` |

`invalidateTransactionQueries` clears `["transactions"]`, `["transactions-analytics"]`, `["transactions-summary"]`, and `["dashboard"]`. It does not clear the tag trend, charts, or account balances.

### Classifier — `ClassifierPage` via `classifierApi`

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/classifier/transactions/untagged` | `["classifier-untagged-transactions", accountId]` | Enabled when an account is selected. Query `account_id` |
| `POST` | `/api/classifier/train` | `retrainMutation` | `{ account_id }`. Does not write tags |
| `POST` | `/api/classifier/predict` | `predictMutation` | `{ account_id, transaction_ids }` for the loaded untagged rows |

Applying a suggestion is `PUT /transactions/:id` on the backend client. That invalidates the untagged list and `["transactions"]`.

## Conventions

- Keep HTTP handlers thin. Put parsing, import, and training logic in service modules.
- Scope data by `user_id`. A missing owned row is a 404.
- Amounts are `Numeric(12, 2)` in the API as strings on the frontend. Do not do money math with binary floats.
- Transfers are paired rows sharing `transfer_group_id`. All-accounts views must not double-count a pair.
- Splits are child rows pointing at `parent_transaction_id`.
- Behavior changes get a note under `specs/` in a `[specs]` commit. Older notes in that folder are background for the current code.

## Contributing

Every commit subject follows this pattern:

```text
[docs|specs|tech] <description>
```

| Prefix | Use for |
| --- | --- |
| `[docs]` | README, `AGENTS.md`, and other documentation |
| `[specs]` | Files under `specs/` |
| `[tech]` | Application code, tests, migrations, and dependency updates |

Rules:

- One prefix per commit. A spec and the code that implements it are separate commits.
- Description is imperative and specific: `[tech] dedupe transfer pairs on the dashboard`.
- No conventional-commit types such as `feat` or `fix`. The prefix above replaces them.
- Commit `pnpm-lock.yaml` with frontend dependency changes, and both `pyproject.toml` and `uv.lock` with Python dependency changes.
- Schema changes are a new file in `backend/alembic/versions/`. Do not edit an applied revision.
- Frontend changes that render financial data or handle user input need a Vitest test. Run `pnpm test` before a `[tech]` frontend commit.
- Do not commit `.env` files, secrets, or `classifier` `.joblib` models.

## Environment

Copy examples before a local run:

- `backend/.env.example` — `SECRET_KEY`, token lifetime, `DATABASE_URL`, `CORS_ORIGINS`
- `frontend/.env.example` — `VITE_API_URL`

Compose injects database URLs and the classifier CORS origin. The classifier reuses `backend/.env` for `SECRET_KEY`.
