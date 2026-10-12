# Implementation Plan: Transactions row actions menu outside table scroll

## Overview

The transactions list wraps the table in `overflow-x-auto`, which clips the row actions popover. Extract a shared `ActionsMenu` UI primitive that portals the panel to `document.body`, positions it with `fixed` coordinates from the trigger, flips above the trigger when the viewport would clip below, and keeps dismiss behavior (outside click, Escape). Wire the main transactions table to use it; import preview tables are unchanged.

Source spec: `specs/transactions-actions-menu-overflow.md`.

## Architecture Decisions

- **New file:** `frontend/src/components/ui/actions-menu.tsx` — trigger slot + portaled panel, `data-actions-menu-root` on trigger wrapper and panel for outside-click detection.
- **Positioning:** On open, measure trigger with `getBoundingClientRect()`, place panel below with `mt-1` gap; if `top + panelHeight > window.innerHeight`, place above the trigger. Recompute on `resize` and `scroll` (capture phase on `window` and scrollable ancestors if needed; at minimum `window` scroll/resize while open).
- **Z-index:** Panel uses `z-50` so it stacks above the sticky table header (`z-10`).
- **TransactionsPage:** Replace inline `absolute` menu markup with `ActionsMenu`; keep `openActionsMenuId` state and existing menu item handlers. Move or duplicate the document `mousedown` / `keydown` dismiss logic into the primitive so the page stays thin.
- **No new dependencies:** React `createPortal` only; no Radix dropdown.
- **Tests:** Extend `frontend/tests/TransactionsPage.test.tsx` — mock at least two transactions, open actions on the **last** row, assert the menu panel is a direct descendant of `document.body` (or not contained in the table overflow wrapper), and that Edit on the last row opens the edit dialog. Existing split-dialog tests must keep passing; update `openSplitDialog` if the trigger/menu structure changes (e.g. multiple "Open actions menu" buttons — use `getAllByRole` and pick last).

## Dependency Graph

```
ActionsMenu primitive (portal + position + flip)
        │
        ├── TransactionsPage integration (main list only)
        │
        └── Vitest: last-row menu + regression on split flow
```

Task 1 is the failing test. Task 2 builds the primitive to satisfy it. Task 3 wires the page (can merge with Task 2 if done in one session after the test exists).

## Task List

### Phase 1: Test + primitive

- [ ] Task 1: Last-row actions menu test (portal / visibility)
- [ ] Task 2: `ActionsMenu` component

### Checkpoint: After Tasks 1–2

- [ ] Last-row test fails before portal, passes after
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds

### Phase 2: Integration

- [ ] Task 3: Use `ActionsMenu` on main transactions table

### Checkpoint: Spec complete

- [ ] Success criteria in `specs/transactions-actions-menu-overflow.md` met
- [ ] `cd frontend && pnpm test` passes
- [ ] Manual check: last row menu fully visible in dev, horizontal table scroll still works
- [ ] Review with human before commit

Full task detail: `tasks/todo.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| happy-dom layout: zero-height panel before paint | Med | Measure panel after open in `requestAnimationFrame` or `useLayoutEffect`; fallback min height for flip calc |
| Multiple rows → multiple triggers with same aria label | Med | Tests target last menu via `getAllByRole` + index or `within(lastRow)` |
| Stale position after scroll while open | Low | Listen to `window` scroll/resize while open; close on outside click unchanged |
| Split tests open first row menu | Low | Keep opening menu on first transaction in `openSplitDialog` |

## Parallelization

Sequential: Task 1 → Task 2 → Task 3. No parallel work.

## Open Questions

- None.
