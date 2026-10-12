# Tasks: Transactions row actions menu outside table scroll

Source: `specs/transactions-actions-menu-overflow.md` and `tasks/plan.md`.

## Task 1: Last-row actions menu test (portal / visibility)

**Description:** Add a Transactions page test with two (or more) mocked transactions. Open the actions menu on the **last** row. Assert the menu panel is portaled outside the table overflow wrapper (e.g. panel under `document.body`, or not inside the element with the table border wrapper). Click Edit on that row and assert the edit dialog opens.

**Acceptance criteria:**

- [x] With multiple rows loaded, opening actions on the last row shows Edit (when applicable) and the menu node is not clipped inside the `overflow-x-auto` table wrapper.
- [x] Edit on the last row opens the transaction edit dialog.
- [x] Test fails on current inline `absolute` menu implementation (menu stays inside table cell / wrapper).

**Verification:**

- [ ] Tests pass after Tasks 2–3: `cd frontend && pnpm exec vitest run tests/TransactionsPage.test.tsx`
- [ ] Build succeeds: `cd frontend && pnpm run build`

**Dependencies:** None

**Files likely touched:**

- `frontend/tests/TransactionsPage.test.tsx`

**Estimated scope:** Small: 1 file

## Task 2: `ActionsMenu` component

**Description:** Add `frontend/src/components/ui/actions-menu.tsx`: controlled `open` / `onOpenChange`, trigger child, menu children, portal to `body`, fixed positioning from trigger rect, flip upward when viewport would clip below, outside click and Escape to close, `data-actions-menu-root` on trigger root and panel.

**Acceptance criteria:**

- [x] Menu panel renders via portal to `document.body` when open.
- [x] Default placement is below trigger; flips above only when `bottom` would exceed viewport.
- [x] `z-50`, same visual classes as current popover.
- [x] Task 1 assertions pass when used from a minimal test render (or after Task 3).

**Verification:**

- [ ] Tests pass: `cd frontend && pnpm exec vitest run tests/TransactionsPage.test.tsx`
- [ ] Build succeeds: `cd frontend && pnpm run build`

**Dependencies:** Task 1 (test defines expected behavior)

**Files likely touched:**

- `frontend/src/components/ui/actions-menu.tsx`

**Estimated scope:** Small: 1 file

## Checkpoint: After Tasks 1–2

- [ ] Last-row menu test failed before portal and passes with component wired in page or test harness
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds

## Task 3: Use `ActionsMenu` on main transactions table

**Description:** Replace the inline three-dot menu in `TransactionsPage` (main list only) with `ActionsMenu`. Remove redundant page-level dismiss effects if fully handled by the primitive. Keep `openActionsMenuId` and all Edit / Split / Delete handlers unchanged.

**Acceptance criteria:**

- [x] Main transactions table uses `ActionsMenu` for row actions.
- [x] Import preview tables unchanged.
- [x] One menu open at a time; click-outside and Escape still work.
- [x] All `TransactionsPage` tests pass, including split dialog suite.

**Verification:**

- [ ] Tests pass: `cd frontend && pnpm test`
- [ ] Build succeeds: `cd frontend && pnpm run build`
- [ ] Manual check: open menu on last row in dev — full menu visible, no inner vertical scroll on table wrapper

**Dependencies:** Task 2

**Files likely touched:**

- `frontend/src/pages/TransactionsPage.tsx`
- `frontend/tests/TransactionsPage.test.tsx` (only if selectors need adjustment)

**Estimated scope:** Small: 1–2 files

## Checkpoint: After Task 3

- [x] Every success criterion in `specs/transactions-actions-menu-overflow.md` satisfied
- [x] `cd frontend && pnpm test` passes
- [x] `cd frontend && pnpm run build` succeeds
- [ ] Manual check on Transactions page (last row menu + horizontal scroll on narrow viewport)
- [ ] Review with human before `[specs]` / `[tech]` commits
