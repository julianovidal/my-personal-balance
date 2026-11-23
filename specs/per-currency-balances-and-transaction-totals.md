# Spec: Per-currency balances and transaction totals

## Problem

Four endpoints add amounts in different currencies as if they were one:

- `GET /api/accounts/balances` returns `overall_balance`, the sum of every account's balance regardless of currency. It also returns `balance` and `overall_balance` as JSON floats.
- `GET /api/transactions/summary/monthly` returns one `overall` income, expenses, and net across all currencies.
- `GET /api/transactions/analytics/monthly` returns expense totals by tag and by account across all currencies. `by_account` also groups by account name, so two accounts with the same name merge.
- `GET /api/transactions/analytics/tag-trend` returns one monthly series across all currencies when no account is picked.

With a EUR and a BRL account, the Transactions page shows totals with no currency symbol and a note saying they are added without converting. The Accounts page ignores `overall_balance` and adds balances itself, per currency, from the floats.

## Rule

Money in different currencies is never added together. Every total is grouped by currency, the same way the dashboard does it (`specs/dashboard-insights-latest-data-month.md`).

- **Account balances** use the account's currency, as `/dashboard/balance-history` does.
- **Transaction totals** (summary, analytics, tag trend) use the transaction's own `currency`, as `/dashboard/insights` does. An imported row can carry a currency that differs from its account's.
- **Amounts** go over the wire as decimal strings, like every other amount in the API. No `float()` anywhere in these handlers.
- Currencies are sorted alphabetically in every list below.

Filters, transfer handling, and split handling do not change: the summary still includes transfers only when one account is selected, analytics and tag trend still skip transfers, and split parts still replace their parent (`_effective_transaction_condition`). The tag trend still covers the last 12 calendar months, anchored on today.

## API changes

These are breaking changes. The frontend is the only caller and changes in the same release.

### `GET /api/accounts/balances`

```json
{
  "totals": [{ "currency": "BRL", "balance": "1520.00" }, { "currency": "EUR", "balance": "90997.47" }],
  "by_account": [{ "account_id": 11, "account_name": "Main", "currency": "EUR", "balance": "90997.47" }]
}
```

- `overall_balance` is removed and replaced by `totals`, one entry per currency in use by the user's accounts. An account with no transactions counts as `"0.00"` in its currency.
- `by_account[].balance` becomes a decimal string.

### `GET /api/transactions/summary/monthly`

```json
{
  "totals": [{ "currency": "EUR", "income": "3200.00", "expenses": "2140.55", "net": "1059.45" }],
  "by_account": [{ "account_id": 11, "account_name": "Main", "currency": "EUR", "income": "…", "expenses": "…", "net": "…" }]
}
```

- `overall` is removed and replaced by `totals`, one entry per transaction currency in the filtered rows. No rows means `totals: []`.
- `by_account` is grouped by account and transaction currency, so an account with rows in two currencies has two entries. Each entry gains `currency`.

### `GET /api/transactions/analytics/monthly`

```json
{
  "by_tag": [{ "currency": "EUR", "label": "Groceries", "total_expense": "412.30" }],
  "by_account": [{ "currency": "EUR", "account_id": 11, "label": "Main", "total_expense": "1630.10" }]
}
```

- Every item gains `currency`. Items are grouped by currency and label, sorted by currency, then by `total_expense` descending.
- `by_account` is grouped by account id, not name, and each item gains `account_id`. `label` is still the account name.
- Items with a zero total are still left out.

### `GET /api/transactions/analytics/tag-trend`

```json
{
  "tag_id": 4,
  "series": [{ "currency": "EUR", "points": [{ "month": "2025-12", "total_expense": "0.00" }] }]
}
```

- `points` is replaced by `series`, one entry per currency that has at least one expense in the tag over the 12 months. Each series has all 12 months, with zero for empty months. No expenses means `series: []`.

## Frontend

The Transactions page follows the dashboard: when the data has more than one currency, a currency tab list (`Tabs`, as in `DashboardPage`) picks which one the summary cards and charts show.

- The currency choices are the currencies in `summary.totals`. With one or none there are no tabs.
- The default is the first currency (alphabetical). If the user's choice disappears after a filter change, fall back to the first.
- The summary cards, the expense breakdown, and the tag trend all show the chosen currency's data, formatted with `formatMoney` in that currency. The breakdown and the trend show their own empty state when the chosen currency has no data for them.
- The "Your accounts use different currencies…" note and `scopeCurrency` in `TransactionsPage.tsx` are removed. `formatAmount` in `src/lib/money.ts` is removed if nothing else uses it.
- The Accounts page shows `totals` from the response instead of adding balances itself, and treats `balance` as a string (`toCents`).
- Types in `src/types/index.ts` change to match the shapes above.

## Out of scope

- Converting between currencies.
- `GET /api/dashboard/summary` and `/api/dashboard/charts`. The UI does not call them.
- The tag trend's "last 12 months from today" window, which differs from the dashboard's anchor on the newest transaction.
- The split remainder row typo (`Missing Spllited Transactions`).

## Tests

Backend, in a new `backend/tests/test_per_currency_totals.py` against `balance_test`, with one user who has a EUR account and a BRL account:

- Balances: `totals` has one entry per currency with the right sums, `balance` values are strings, and there is no `overall_balance`.
- Summary: `totals` keeps EUR and BRL apart, and an account with rows in two currencies gets two `by_account` entries.
- Analytics: the same tag in two currencies gives two `by_tag` items, and two accounts with the same name stay separate in `by_account`.
- Tag trend: one series per currency, each with 12 points.
- A user who sees another user's data in any of these responses is a failure.

Frontend:

- `AccountsPage.test.tsx`: per-currency totals render from `totals`, and string balances format correctly.
- `TransactionsPage.test.tsx`: one currency shows no tabs; two currencies show tabs, and switching changes the summary cards' values and currency symbol.

After this ships, the first two items under "Known issues" in `backend/AGENTS.md` are removed.
