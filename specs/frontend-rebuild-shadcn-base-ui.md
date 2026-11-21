# Spec: Rebuild the frontend on shadcn/ui with Base UI

## Objective

Replace the old frontend (Tailwind 3, hand-written shadcn-style primitives, hand-drawn SVG charts) with a new one that keeps every function and changes how it looks.

- Stack: Vite 8, React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui on Base UI (style `base-mira`, preset `b1D0dv72`), shadcn charts (Recharts), TanStack Query, React Router.
- Layout: the shadcn `dashboard-01` block. A collapsible sidebar (icon strip when collapsed, slide-out panel on phones), a site header with the page title and theme toggle, and the user menu in the sidebar footer (Profile, Log out).
- Built in a separate folder page by page, then swapped in as `frontend/` on port 5173.

## Behavior kept

Every route and API call in the root `AGENTS.md` API map: login and register, accounts with balances and import settings, tags, transactions with filters, charts, add/edit, transfers, splits, import preview, and the classifier.

## Behavior changed

- **Auth:** logout clears the TanStack Query cache. Any 401, or a 403 (FastAPI `HTTPBearer` sends 403 when no token is attached), outside `/auth/*` logs the user out. Login shows different messages for wrong credentials, an unreachable server, and backend errors.
- **Theme:** light, dark, or system, stored under `theme` (was `balance-theme`, light/dark only).
- **Profile:** reached from the user menu, not the main nav. Tags are edited inline; delete asks for confirmation and says tagged transactions become untagged.
- **Accounts:** balances are shown in each account's currency and totalled per currency instead of one mixed overall balance. Delete warns that the account's transactions are deleted. Import settings open in a side panel and ask before discarding unsaved changes.
- **Transactions:**
  - Expense / Income / Transfer switch with a positive amount; the type sets the sign. Field errors before saving.
  - Amounts sent as decimal strings; split remainders computed in integer cents.
  - "Today" in local time, not UTC.
  - Search is debounced.
  - Expense breakdown by tag or account (top 9 plus "Other") and a 12-month tag trend as shadcn charts.
  - Totals that mix currencies are shown without a symbol, with a note.
  - Saves also refresh account balances and the tag trend.
  - The split dialog closes after saving.
- **Classifier:** a prediction does not overwrite a tag the user already picked.

## Money rule

Balances arrive as floats from `/accounts/balances`; every other amount is a decimal string. All sums use integer cents (`src/lib/money.ts`). Currencies are never added together.

## Testing

`cd frontend && pnpm test && pnpm run lint && pnpm run build`. Every page has a Vitest test under `frontend/tests/`.

## Known backend issues found (not fixed here)

Listed in `backend/AGENTS.md` and `classifier/AGENTS.md`: balances are floats, some totals mix currencies, and the remainder row description has a typo. `PUT /transactions/:id` used to detach split parts; that is fixed in `specs/split-part-update-keeps-parent.md`.
