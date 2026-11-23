# Spec: Per-account import settings modal (Accounts page)

## Assumptions (correct before implementation)

1. **Frontend-only** — No backend or API changes; reuse `GET`/`PUT /accounts/:id/import-mapping`.
2. **Single entry point** — Import mapping is configured only from the Accounts page (not from Transactions import in this change).
3. **Create account** — No import-mapping step when adding an account; users configure later from the row control.
4. **Save semantics** — Same as today: all five fields are sent on save; empty strings are allowed for optional columns (currency, tag id).
5. **Icon** — Use `lucide-react` (already in the project), e.g. `FileSpreadsheet`, with visible `aria-label` including the account name.
6. **Unsaved confirm** — No `AlertDialog` primitive exists today; use a second small `Dialog` for “Discard changes?” (match delete-account confirmation pattern), not `window.confirm`.

## Objective

The Accounts page currently shows a full-width **Account import settings** card below the account list with its own account `<Select>`. That duplicates context (accounts are already listed above), adds scroll, and makes it easy to edit mapping for the wrong account.

**User story:** As a user managing accounts, I open import column mapping for a specific account from that account’s row, edit fields in a modal, save or cancel, and am prompted if I try to close with unsaved edits.

**Primary success:** A shorter Accounts page (no bottom import card) with mapping scoped to the account I chose.

**Out of scope:** Transactions page import UI or deep links; mapping wizard on account create; backend changes; overflow (⋯) menu on account rows; “configured / not set” badges; new npm dependencies.

## Tech Stack

- React 19, TypeScript 5
- Vite 8, Vitest 4, Testing Library, happy-dom
- TanStack Query (existing queries/mutations)
- shadcn-style `Dialog`, `Button`, `Input`, `Label` under `frontend/src/components/ui/`
- `lucide-react` for the row trigger icon

## Commands

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
cd frontend && pnpm run dev
```

## Project Structure

```text
frontend/src/pages/AccountsPage.tsx        → Row trigger, import modal, remove bottom card
frontend/tests/AccountsPage.test.tsx       → Replace/extend import mapping tests
specs/accounts-import-settings-modal.md    → This spec
```

## Code Style

Mirror existing account dialogs on `AccountsPage` (delete confirmation, add/edit account).

- State: `importSettingsAccount: Account | null` instead of page-level `selectedAccountId` for mapping.
- Fetch mapping only when the import modal is open: `queryKey: ["account-import-mapping", accountId]`, `enabled: Boolean(importSettingsAccount)`.
- On open: populate local field state from query result (same five fields as today).
- **Dirty detection:** Compare current field values to last loaded mapping snapshot (values applied when fetch settles for this open session).
- **Close paths:** Cancel button, dialog overlay/Escape via `onOpenChange` — if dirty, intercept and show discard confirmation; if clean, close and clear `importSettingsAccount`.
- **Save:** `PUT` with same body as today; on success close modal and invalidate `["account-import-mapping", accountId]`.
- Row: `Button variant="outline" size="icon"` with `aria-label={`Import settings for ${a.name}`}` and `title="Import settings"`.

Remove: the second `Card`, `selectedAccountId` used only for mapping, and the `useEffect` that auto-selects the first account for mapping.

## Testing Strategy

Vitest + Testing Library; mock `@/api/client` as in `AccountsPage.test.tsx`.

- **Remove/replace** the test that expects “Account import settings” on the page.
- **Assert** the bottom import card is **not** rendered.
- **Mock** accounts + balances with at least one account; mock `GET .../import-mapping` with sample column names.
- **Open modal:** click import control by accessible name; dialog shows account in title; fields show mocked values.
- **Save:** change a field, submit Save mapping; assert `PUT` called; modal closes.
- **Dirty close:** change a field, cancel/close; discard confirmation; confirm discard closes without `PUT`.

`pnpm test` must pass before a `[tech]` commit.

## Boundaries

- **Always:** Scope mapping UI to the account that opened the modal; run `pnpm test`; `[specs]` then `[tech]` commits per repo `AGENTS.md`.
- **Ask first:** New UI primitives package; extracting shared `ImportMappingForm` used elsewhere in the same change.
- **Never:** Change import-mapping API contract; add Transactions-page entry points in this change.

## Success Criteria

- The **Account import settings** card is removed from `AccountsPage`.
- Each account row has an icon-only control that opens a dialog titled for that account.
- The dialog contains the same five column fields and help text as today; Save mapping persists via `PUT`.
- Closing with unsaved edits shows confirmation; discarding reverts and closes.
- `cd frontend && pnpm test` passes.

## Resolved decisions

1. **Save button label:** Keep **Save mapping** (consistent with prior UI).
2. **Validation:** Keep current permissive behavior (no required-field gate on Save).

## Open Questions

- None.
