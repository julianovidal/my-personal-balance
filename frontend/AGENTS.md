# My Personal Balance - Frontend

React SPA for My Personal Balance. Read the root [`AGENTS.md`](../AGENTS.md) first: it has the routes and the commit rules. Every API call and query key is in [`docs/api-map.md`](../docs/api-map.md).

## Stack

- React 19, TypeScript 6, Vite 8
- Tailwind CSS 4 (CSS-first config in `src/index.css`, no `tailwind.config.js`)
- shadcn/ui on Base UI (`@base-ui/react`), style `base-mira`, preset `b1D0dv72` (neutral grays, radius `0.625rem`)
- shadcn charts (Recharts 3)
- TanStack Query 5, React Router 7, axios
- Vitest 4, Testing Library, happy-dom
- ESLint 10 and Prettier

## Commands

Use pnpm. Do not use npm or yarn.

```bash
pnpm install
pnpm run dev        # http://localhost:5173, fails if the port is taken (--strictPort)
pnpm test           # Vitest
pnpm run lint       # ESLint, must pass with zero errors
pnpm run build      # tsc -b (also type-checks tests/) then vite build
```

Run `pnpm test`, `pnpm run lint` and `pnpm run build` before a `[tech]` frontend commit. Commit `pnpm-lock.yaml` with any dependency change.

Copy `.env.example` to `.env` for a local run. In compose, the `frontend` service (`balance-web`) injects the same two variables and bind-mounts this folder. Its `node_modules` lives in the `frontend_node_modules` volume. After a dependency change, remove that volume so the container reinstalls.

## Layout

```text
src/
├── api/          axios clients, session (401/403 handling), shared queries
├── components/   app shell, sidebar, header, theme, simple-select
│   └── ui/       generated shadcn components (do not edit by hand)
├── contexts/     AuthContext
├── hooks/        use-mobile (generated), use-debounced-value
├── lib/          money, dates helpers, auth-errors, nav, currencies
├── pages/        one file per route, sub-folders for page parts
└── types/        API types
tests/            Vitest tests, render helper, axios stub adapter
```

## UI components

- Add shadcn components with the pinned CLI, all in one command so it does not stop on overwrite prompts:

  ```bash
  pnpm dlx shadcn@4.23.0 add <component> [<component>...] -y
  ```

- Components are Base UI, not Radix. Use the `render` prop where Radix examples use `asChild`, for example `<SidebarMenuButton render={<Link to="/" />} />`.
- Do not edit files in `src/components/ui/` or `src/hooks/use-mobile.ts`. They are excluded from lint for that reason. Change behavior in a wrapper instead.
- For a link that looks like a button, use `<Link className={buttonVariants(...)}>`. `Button render={<Link />}` gives the link `role="button"`.
- Use `SimpleSelect` (`src/components/simple-select.tsx`) for single-value selects. It passes `items` to Base UI so the trigger shows labels, not raw ids.
- Layout follows the shadcn `dashboard-01` block. `pnpm dlx shadcn@4.23.0 view dashboard-01` prints its source for reference. Do not install the whole block.
- The sidebar collapses to an icon strip (`collapsible="icon"`), unlike the block's `offcanvas`. `app-shell.tsx` reads the `sidebar_state` cookie back into `defaultOpen`.
- The preset's five chart colors are all gray. `src/index.css` adds `--chart-in` (money in, green) and `--chart-out` (money out, red) for light and dark. Use those for income/expense and above/below-usual signals; keep the grays for neutral series.

## Money and dates

- The API sends amounts as decimal strings, except account balances, which are JSON numbers (floats). Before adding anything, convert with `toCents` from `src/lib/money.ts` and add integer cents. Send amounts back as strings with `centsToDecimal`.
- Format with `formatMoney` or `formatCents` using the row's own currency. Never add totals across currencies. Backend totals that already mix currencies are shown without a symbol unless every account in scope shares one (`formatAmount`).
- Dates are `YYYY-MM-DD` strings in local time (`src/pages/transactions/dates.ts`). Do not use `toISOString()` for "today", because it is UTC.

## Auth

- `AuthContext` keeps the user. `logout()` removes the token and calls `queryClient.clear()`.
- Both axios clients log out on 401 or 403, except for `/auth/*` requests. The backend's `HTTPBearer` answers 403 when no token is sent. The handler is registered through `src/api/session.ts`.
- Login error messages come from `getAuthErrorMessage`. Other requests use `getApiErrorMessage`, which shows the backend's `detail`.

## Tests

- Pages that render money or take user input need a test. Every page has one.
- Use `renderWithProviders` from `tests/render.tsx` (theme, query client, tooltip provider, memory router).
- Mock `@/api/client` and `@/api/classifierClient` with `vi.hoisted` objects. To test interceptors, set `defaults.adapter` to `stubAdapter` from `tests/stubAdapter.ts`.
- Find fields by label. Base UI selects are opened by clicking the labelled trigger, then the `option` role.
- Charts are mocked in page tests. happy-dom cannot measure Recharts layout.
- `vitest.config.ts` passes `--no-experimental-webstorage`, because Node 22+ has its own `localStorage` global that hides happy-dom's.

## Status

- Done: login and register, app shell, Dashboard (insights for the latest month with data), Profile (tags, theme), Accounts (balances, import settings), Transactions (filters, charts, list, add/edit, transfers, splits, import, URL filters), Classifier.
