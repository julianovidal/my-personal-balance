# Implementation Plan: Per-account import settings modal (Accounts page)

## Overview

Move CSV/XLSX column mapping off the full-width **Account import settings** card and into a per-account modal opened from an icon button on each row. Reuse existing import-mapping APIs and TanStack Query patterns; add dirty-state handling with a nested discard confirmation dialog (same pattern as delete account).

Source spec: `specs/accounts-import-settings-modal.md`.

## Architecture Decisions

- **Single file UI change:** `frontend/src/pages/AccountsPage.tsx` — no new shared component unless the page exceeds ~250 lines after the change (unlikely).
- **State model:**
  - `importSettingsAccount: Account | null` — which row opened the modal.
  - `mappingBaseline` — snapshot of the five column strings when mapping data last synced for this open session (for dirty checks).
  - `discardConfirmOpen: boolean` — nested dialog when user closes main import dialog while dirty.
- **Query:** `useQuery` for import mapping with `enabled: Boolean(importSettingsAccount)`, key `["account-import-mapping", String(importSettingsAccount.id)]`. Reset local fields when `mapping` loads or when modal opens.
- **Mutation:** `saveMapping` uses `importSettingsAccount.id` instead of `selectedAccountId`; `onSuccess` closes import modal, clears baseline, invalidates mapping query.
- **Close flow:** `requestCloseImportModal()` — if dirty, set `discardConfirmOpen`; else clear `importSettingsAccount`. Wire `Dialog` `onOpenChange` on the import dialog to call this when `open` becomes false.
- **Row control:** `FileSpreadsheet` from `lucide-react`, `Button variant="outline" size="icon"`, `aria-label={`Import settings for ${a.name}`}`, `title="Import settings"`.
- **Loading:** While mapping fetch is in flight on first open, show short helper text in dialog or disable Save until loaded (match existing page behavior — no skeleton required if fields start empty then populate).
- **Layout:** Remove second `Card` and `md:grid-cols-3` if only one card remains (use simple `div` with `gap-4` or single full-width card).

## Dependency Graph

```
AccountsPage.test.tsx (new expectations)
        │
        └── AccountsPage.tsx (remove card, modal, discard, row icon)
```

No backend, no new dependencies. Sequential: tests first (red), then implementation (green).

## Task List

### Phase 1: Tests

- [ ] Task 1: Accounts import modal tests

### Checkpoint: After Task 1

- [ ] New tests fail against current page (card still present / no row control)
- [ ] Existing Add account / focus tests still run (may need mock `api.get` routing by URL)

### Phase 2: Implementation

- [ ] Task 2: AccountsPage import modal and row trigger
- [ ] Task 3: Dirty close + discard dialog

Tasks 2–3 can be one commit/session if preferred; split only if Task 2 is done without discard first.

### Checkpoint: Spec complete

- [ ] All success criteria in `specs/accounts-import-settings-modal.md` met
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] Manual: open import settings from a row, save, edit and discard — Accounts page has no bottom import card

Full task detail: `tasks/todo.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `api.get` mock returns `[]` for all URLs | High | In tests, branch on path (`/accounts`, `/accounts/balances`, `/import-mapping`) |
| Dirty false positive when mapping loads async | Med | Set baseline only after mapping applied to fields; don’t mark dirty until user input after baseline set |
| Nested Dialog focus trap (import + discard) | Low | Close discard first; keep import dialog open until discard confirmed or cancelled |
| `onOpenChange` fires on successful save | Low | Clear account and baseline in save `onSuccess` before close animation |

## Parallelization

Sequential only: Task 1 → Tasks 2–3. No parallel work.

## Open Questions

- None (save label and validation resolved in spec).
