# Spec: Dashboard insights for the latest month with data

## Objective

The dashboard answers two questions: "am I spending more than usual?" and "is anything unusual?".

Transactions arrive through CSV/XLSX imports once or twice a month, sometimes two months apart. The calendar month is usually empty, so the dashboard anchors on the newest non-transfer transaction ("data through") and looks at that month, from day 1 to the anchor day.

Background: `concepts_brief.md` (brainstorm and review findings) at the repo root.

## Backend

New service `backend/app/services/dashboard_insights.py`. Rules are pure functions over loaded rows; `load_rows` is the only SQL.

New routes in `backend/app/api/dashboard.py`. The existing `/dashboard/summary` and `/dashboard/charts` are unchanged.

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/dashboard/insights` | Anchor date, account freshness, per-currency comparison, signals, top expenses, 12-month trend, 10 recent rows |
| `GET` | `/api/dashboard/balance-history` | Month-end balance per account currency, from the first month with data to the anchor month |

### Definitions

- **Effective rows:** split children replace their parent. A parent whose children add up to less than its amount keeps the difference as an untagged remainder row (`is_remainder: true`).
- **Spending:** non-transfer expenses (negative amounts), before refunds, grouped by the transaction's currency. Currencies are never added together.
- **Anchor:** newest non-transfer transaction date. Transfers are entered by hand and do not show how far an import got.
- **Month-to-date:** day 1 to the anchor day. Earlier months are cut at the same day (or their last day if shorter).
- **Baseline:** up to 6 earlier months that have data in that currency. Months with no data are skipped, not counted as zero. The comparison and the tag signals need at least 3 baseline months; otherwise `usual` is `null` and `signals` is empty.
- **Usual:** the median of the baseline months.

### Signals

Noise floor per currency: EUR 50, USD 50, BRL 250 (50 for anything else).

- **Spike:** a tag's month-to-date is at least 1.5 times its usual and at least the floor above it.
- **New spending:** a tag with a usual of 0 reaches 2 times the floor.
- **Large expense:** a single expense at least 3 times the median expense of its tag in the baseline months and at least the floor. Needs at least 5 past expenses in that tag. Untagged expenses are compared with past untagged expenses (`reason: "untagged"`).
- At most 5 of each, largest first. Untagged spending is never a tag spike.

### Account freshness

For each account: last transaction date and days behind the anchor.

- `stale`: 8 to 90 days behind. The month may look lower than it is.
- `inactive`: more than 90 days behind. Treated as closed or unused, not warned about.

### Balance history

Cumulative sum of top-level rows (`parent_transaction_id IS NULL`, transfers included), grouped by account currency, like `/accounts/balances`. Empty months repeat the previous balance.

## Frontend

`frontend/src/pages/DashboardPage.tsx` and `frontend/src/pages/dashboard/`. Query keys `["dashboard", "insights"]` and `["dashboard", "balance-history"]`, so `invalidateTransactionQueries` (which clears `["dashboard"]`) refreshes them.

- Header: "Data through <date>", month and day, accounts behind. Currency tabs when there is more than one currency.
- Cards: spent so far with the change against usual, usual by this day, income so far, latest balance.
- "Anything unusual?": signals and large expenses. Each links to `/transactions` filtered by tag and period, or by account and day.
- "Where it went": top 8 tags this month next to their usual (shadcn bar chart).
- Balance over time: monthly (last 3 years) or yearly (year-end) area chart.
- Income vs expenses: 12 months ending at the anchor month; the partial month is marked.
- Biggest expenses (excluding flagged ones), recent transactions, data by account with an Import link.

`TransactionsPage` now reads `from`, `to`, `tag_id` and `account_id` from the URL as its starting filters.

Two chart tokens were added to `src/index.css`, `--chart-in` and `--chart-out`, because the preset's chart colors are all gray.

## Known limits

- Refunds are not netted against spending.
- Credit-card bill payments imported as plain expenses look like spending; imports never create transfer pairs.
- A single global anchor: an account that is behind lowers the month. The freshness list warns about it.
- `PUT /transactions/:id` still detaches split children (see `backend/AGENTS.md`), which can distort split remainders.

## Tests

- Backend: `cd backend && uv run pytest`. Pure rule tests need no database. API tests use a `balance_test` database on the compose Postgres (`TEST_DATABASE_URL` to override); it is created on first run.
- Frontend: `cd frontend && pnpm test`, covering `tests/DashboardPage.test.tsx` and the helpers.
