# Tasks: Per-account import settings modal

Spec: `specs/accounts-import-settings-modal.md`  
Plan: `tasks/plan.md`

---

## Task 1: Accounts import modal tests

**Description:** Replace the test that expects the bottom “Account import settings” card with coverage for the row trigger, modal open/load, save, and discard-on-dirty-close. Extend `api.get` mock to return one account, balances payload, and import-mapping fields.

**Acceptance criteria:**

- [ ] `screen.queryByText("Account import settings")` is not in the document after load.
- [ ] Clicking `Import settings for {accountName}` opens a dialog whose title includes the account name.
- [ ] Mapped column values from `GET /accounts/:id/import-mapping` appear in the dialog.
- [ ] Editing and submitting “Save mapping” calls `api.put` with the expected body and closes the import dialog.
- [ ] After editing, Cancel (or closing dialog) shows discard confirmation; confirming discard closes without `put`.
- [ ] Existing tests for Add account and name-field focus still pass.

**Verification:**

- [ ] `cd frontend && pnpm test -- AccountsPage` — new tests fail before Task 2, pass after Task 3.

**Dependencies:** None

**Files likely touched:**

- `frontend/tests/AccountsPage.test.tsx`

**Estimated scope:** Small (1 file)

---

## Task 2: AccountsPage import modal and row trigger

**Description:** Remove the import settings card and page-level `selectedAccountId` / auto-select effect. Add per-row icon button and import settings `Dialog` with the five fields, intro copy, Cancel, and Save mapping. Wire query (enabled when modal open) and save mutation.

**Acceptance criteria:**

- [ ] Bottom import card removed; only “Your accounts” list card remains.
- [ ] Each row has icon import control with accessible name including account name.
- [ ] Modal title references the active account; form fields match previous placeholders/labels.
- [ ] Save mapping calls `PUT /accounts/:id/import-mapping` and closes modal on success.

**Verification:**

- [ ] Task 1 tests for card removal, open, and save pass (discard test may still fail).

**Dependencies:** Task 1 (tests written)

**Files likely touched:**

- `frontend/src/pages/AccountsPage.tsx`

**Estimated scope:** Medium (1 file, ~80–120 line net change)

---

## Task 3: Dirty close + discard dialog

**Description:** Track mapping baseline when data syncs for the open modal. Intercept close via Cancel and import dialog `onOpenChange`. Show second dialog “Discard changes?” with Keep editing / Discard; Discard clears state and closes import modal without saving.

**Acceptance criteria:**

- [ ] Closing with no edits does not show discard dialog.
- [ ] Closing with edits shows discard confirmation; Keep editing returns to import modal with edits intact.
- [ ] Discard closes import modal without `PUT`.
- [ ] All Task 1 tests pass.

**Verification:**

- [ ] `cd frontend && pnpm test`
- [ ] `cd frontend && pnpm run build`
- [ ] Manual: `pnpm run dev` → Accounts → import icon → edit → Escape → discard flow

**Dependencies:** Task 2

**Files likely touched:**

- `frontend/src/pages/AccountsPage.tsx`

**Estimated scope:** Small (same file)

---

## Checkpoint: After Tasks 1–3

- [ ] `specs/accounts-import-settings-modal.md` success criteria satisfied
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] Human review before `[specs]` / `[tech]` commits
