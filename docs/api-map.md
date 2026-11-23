# API map

Which page calls which route, with its TanStack Query key and what each write invalidates. Read this when a change touches frontend data flow or crosses services. Project rules are in the root [`AGENTS.md`](../AGENTS.md).

`api` (`frontend/src/api/client.ts`) already includes the `/api` prefix. `classifierApi` does not, so classifier paths below include `/api`. Every route except `POST /auth/register`, `POST /auth/login`, and the two `/health` checks requires the bearer token.

Paths the UI never calls: `GET /health`, `GET /health` on the classifier, `GET /dashboard/summary`, `GET /dashboard/charts`, and the optional `month`, `year`, `sort_by`, and `sort_order` query params on transaction list, summary, and analytics.

## Auth and profile

| Method | Path | Caller | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `AuthContext.register` | Body `{ name, email, password }`, then logs in |
| `POST` | `/auth/login` | `AuthContext.login` | Body `{ email, password }`, stores `access_token` |
| `GET` | `/profile` | `AuthContext` on load and after login | Current user. No profile update route |

## Accounts — `AccountsPage`, also read by Transactions and Classifier

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/accounts` | `["accounts"]` | Also on Transactions and Classifier |
| `POST` | `/accounts` | `save` | Body `{ name, currency }` |
| `PUT` | `/accounts/:id` | `save` | Same body when editing |
| `DELETE` | `/accounts/:id` | `remove` | |
| `GET` | `/accounts/balances` | `["accounts-balances"]` | Accounts page only. `totals` and `by_account`, per account currency |
| `GET` | `/accounts/:id/import-mapping` | `["account-import-mapping", selectedAccountId]` | Enabled once an account is selected |
| `PUT` | `/accounts/:id/import-mapping` | `MappingForm` save | Column names: date, description, amount, currency, tag id |

Account create, update, and delete invalidate `["accounts"]` and `["accounts-balances"]`. Saving a mapping invalidates that account's mapping key only.

## Tags — `ProfilePage`, also read by Transactions and Classifier

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/tags` | `["tags"]` | Profile, Transactions, Classifier |
| `POST` | `/tags` | `create` | Body `{ label }` |
| `PUT` | `/tags/:id` | `update` | Same body when editing |
| `DELETE` | `/tags/:id` | `remove` | |

Tag writes invalidate `["tags"]` and `["transactions"]`.

## Dashboard — `DashboardPage`

Anchored on the newest non-transfer transaction ("data through"), not on today. Rules are in `backend/app/services/dashboard_insights.py` and `specs/dashboard-insights-latest-data-month.md`.

| Method | Path | Query key | Notes |
| --- | --- | --- | --- |
| `GET` | `/dashboard/insights` | `["dashboard", "insights"]` | Spending vs usual (same days, median of up to 6 months with data), tag spikes, large expenses, top expenses, 12-month trend, account freshness, 10 recent rows. Per currency |
| `GET` | `/dashboard/balance-history` | `["dashboard", "balance-history"]` | Month-end balance per account currency |
| `GET` | `/dashboard/summary` | — | Not called by the UI. Anchors on today |
| `GET` | `/dashboard/charts` | — | Not called by the UI. Anchors on today |

Both dashboard keys start with `"dashboard"`, so `invalidateTransactionQueries` refreshes them.

`TransactionsPage` reads `from`, `to`, `tag_id`, and `account_id` from the URL as its starting filters; the dashboard links use them.

## Transactions — `TransactionsPage`

List and charts all send `date_from` and `date_to`. Account and tag filters are added only when set.

| Method | Path | Query key or mutation | Params or body |
| --- | --- | --- | --- |
| `GET` | `/transactions` | `["transactions", dateFrom, dateTo, accountFilter, tagFilter, textFilter, page, pageSize]` | `page`, `page_size`, optional `account_id`, `tag_id`, `search_text` |
| `GET` | `/transactions/summary/monthly` | `["transactions-summary", dateFrom, dateTo, accountFilter, tagFilter]` | Optional `account_id`, `tag_id`. `totals` per transaction currency |
| `GET` | `/transactions/analytics/monthly` | `["transactions-analytics", dateFrom, dateTo, accountFilter, tagFilter]` | Optional `account_id`, `tag_id`. Expense totals by tag and by account, per transaction currency |
| `GET` | `/transactions/analytics/tag-trend` | `["transactions-tag-trend", trendTagId, accountFilter]` | Enabled when a trend tag is selected. Required `tag_id`, optional `account_id`. Server always uses the last 12 months. One `series` per currency |
| `POST` | `/transactions` | `save` in `TransactionFormDialog` | `{ date, description, account_id, tag_id, is_transfer, destination_account_id, amount, currency }` |
| `PUT` | `/transactions/:id` | `save` in `TransactionFormDialog`, and Classifier `apply` | Same body. Classifier sends `is_transfer: false` and the chosen `tag_id` |
| `DELETE` | `/transactions/:id` | `remove` | |
| `GET` | `/transactions/:id/splits` | `["transaction-splits", parentId]` | Loaded when the split dialog opens |
| `PUT` | `/transactions/:id/splits` | `save` in `SplitDialog` | `{ rows: [{ id, description, amount, tag_id }] }` |
| `POST` | `/transactions/import/preview/:accountId` | `previewUpload` | Multipart `file`, optional `default_tag_id` |
| `POST` | `/transactions/import/:accountId` | `upload` | Same upload. Response `{ imported, skipped }` |

`invalidateTransactionQueries` clears `["transactions"]`, `["transactions-analytics"]`, `["transactions-summary"]`, `["dashboard"]` (and so both dashboard keys), `["accounts-balances"]`, and `["transactions-tag-trend"]`.

## Classifier — `ClassifierPage` via `classifierApi`

| Method | Path | Query key or mutation | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/classifier/transactions/untagged` | `["classifier-untagged-transactions", accountId]` | Enabled when an account is selected. Query `account_id` |
| `POST` | `/api/classifier/train` | `retrain` | `{ account_id }`. Does not write tags |
| `POST` | `/api/classifier/predict` | `predict` | `{ account_id, transaction_ids }` for the loaded untagged rows |

Applying a suggestion is `PUT /transactions/:id` on the backend client. That invalidates the untagged list and `["transactions"]`.

