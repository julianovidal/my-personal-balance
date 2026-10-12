# Spec: Transactions row actions menu outside table scroll

## Objective

On the Transactions page, each row has a three-dot actions control (Edit, Split, Delete). Opening that menu on a row near the bottom of the list—especially the last row on the page—should show the full menu on top of the page, fully readable and clickable.

Today the menu is `position: absolute` inside a table cell, and the table sits in a wrapper with `overflow-x-auto`. That wrapper becomes a scroll container and clips vertical overflow, so the menu is cut off, can force a scrollbar inside the table area, and appears behind or inside the bordered table box instead of floating above the layout.

**User story:** As a user browsing transactions, I open the actions menu on any row (including the last one) and see every action without scrolling inside the table container.

**Out of scope:** Edit, Split, and Delete modal dialogs; pagination; filters; backend APIs; other pages unless they reuse the same actions-menu pattern as part of this fix.

### Cause to remove

The actions popover is positioned inside the scrollable table wrapper (`overflow-x-auto` on the transactions list). CSS overflow on that ancestor clips and scrolls the menu instead of letting it extend outside the table border.

## Tech Stack

- React 19, TypeScript 5
- Vite 8, Vitest 4, Testing Library, happy-dom
- Existing UI primitives under `frontend/src/components/ui/` (no Radix Dropdown Menu in the project today)
- No new dependencies unless explicitly approved (see Boundaries)

## Commands

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
cd frontend && pnpm run dev
```

## Project Structure

```text
frontend/src/pages/TransactionsPage.tsx     → Row actions menu (trigger + menu panel)
frontend/src/components/ui/                 → Optional shared menu primitive if extracted
frontend/tests/TransactionsPage.test.tsx    → Interaction tests for actions menu
specs/transactions-actions-menu-overflow.md → This spec
```

## Code Style

Keep the current inline menu items and behavior (`openActionsMenuId`, click-outside on `data-actions-menu-root`, Escape to close). Prefer a small, local change: render the menu panel through a React portal to `document.body` and position it with `position: fixed` from the trigger’s `getBoundingClientRect()` (update on open and on `resize` / `scroll` while open).

If the panel would extend below the viewport, open it above the trigger (flip) so it stays visible without page scroll hacks.

Match existing Tailwind tokens: `border-border`, `bg-card`, `shadow-lg`, same button classes as today.

Example shape (illustrative only):

```tsx
{open && (
  <div
    ref={menuRef}
    role="menu"
    className="fixed z-50 w-40 rounded-lg border border-border bg-card p-1 shadow-lg"
    style={{ top: coords.top, left: coords.left }}
  >
    {/* Edit / Split / Delete — unchanged labels and handlers */}
  </div>
)}
```

Do not add a large abstraction unless the same portal menu is reused in a second place in the same change.

## Testing Strategy

Vitest and Testing Library, same patterns as `frontend/tests/TransactionsPage.test.tsx`. Mock `@/api/client`.

- **Regression:** Existing split-dialog tests keep passing.
- **New:** With a mocked list of at least two transactions, open the actions menu on the **last** row in the table and assert Edit (or Delete) is visible and clickable via `getByRole` without being `hidden` from an ancestor with `overflow` clipping (e.g. menu node is attached under `document.body`, not inside the table overflow wrapper).
- **Behavior:** Clicking an item still runs the same flow (e.g. last row → Edit opens the edit dialog; menu closes).
- **A11y:** Trigger keeps `aria-label="Open actions menu"`; menu items remain buttons; Escape still closes the menu (existing listener).

`pnpm test` must pass before a `[tech]` commit.

## Boundaries

- **Always:** Preserve horizontal scrolling for wide tables; preserve click-outside and Escape to close; run `pnpm test`; add or extend a Transactions page test for the last-row menu.
- **Ask first:** Adding `@radix-ui/react-dropdown-menu` or other new dependencies; refactoring every overflow table on the page (import preview tables) in the same change.
- **Never:** Change transaction APIs or delete/edit/split business rules; commit secrets.

## Success Criteria

- Opening the actions menu on the last transaction row shows the full menu (all applicable items) without a vertical scrollbar appearing **inside** the table’s bordered scroll wrapper solely because the menu opened.
- The menu renders above the table border (visually outside the clipped region) and is not cut off at the bottom of the table container.
- Horizontal overflow on the transactions table still works when columns are wide.
- Edit, Split, and Delete from the menu behave as before; only one row menu is open at a time.
- Click outside the trigger/menu and Escape still dismiss the menu.
- `cd frontend && pnpm test` passes.

## Resolved decisions

1. **Viewport flip:** Open downward when the menu fits below the trigger; flip upward only when the viewport would clip the menu.
2. **Shared primitive:** Extract a reusable actions menu component under `frontend/src/components/ui/`.
3. **Scope:** Fix only the main transactions list table; import preview tables stay as-is.

## Open Questions

- None.
