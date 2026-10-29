# Tasks: Import preview gating on unconfigured mapping

Spec: `specs/import-preview-gating-unconfigured-mapping.md`
Plan: `tasks/plan.md`

---

## Task 1: Import dialog gating tests

**Status:** Complete

**Description:** Add a new `describe("TransactionsPage import dialog")` block to `frontend/tests/TransactionsPage.test.tsx` covering the three gating states. Mock `api.get` to serve `/accounts`, `/tags`, the transactions list, and `/accounts/:id/import-mapping` (all-null response for the unconfigured account, populated columns for the configured one). Tests: open the import dialog and assert the disabled Preview import button with no account selected; select the unconfigured account and assert the warning plus an Accounts link; select the configured account and assert the button is enabled with no warning.

**Acceptance criteria:**

- [ ] Dialog opens with **Preview import** disabled and no warning when no account is selected.
- [ ] Selecting an account whose mapping returns all-null columns shows the warning text "This account has no import settings configured yet" and keeps **Preview import** disabled.
- [ ] The warning contains a link pointing to `/accounts`.
- [ ] Selecting an account whose mapping has non-null columns enables **Preview import** and hides the warning.
- [ ] Existing split-dialog tests in the same file still pass.

**Verification:**

- [ ] `cd frontend && pnpm test -- TransactionsPage` — new tests fail before Task 2, pass after.

**Dependencies:** None

**Files likely touched:**

- `frontend/tests/TransactionsPage.test.tsx`

**Estimated scope:** Small (1 file)

---

## Task 2: Mapping query and gating in TransactionsPage

**Status:** Complete

**Description:** Add the `["account-import-mapping", uploadAccountId]` query to `TransactionsPage` (enabled only while the import dialog is open), derive `isMappingConfigured`, disable **Preview import** unless configured, and render the warning — with a `Link` to `/accounts` that closes the dialog — when an account is selected but unconfigured.

**Acceptance criteria:**

- [ ] `Preview import` button: `disabled={!isMappingConfigured || previewUpload.isPending}`.
- [ ] Warning renders only when an account is selected and the mapping is unconfigured; contains a `Link` to `/accounts` that closes the dialog.
- [ ] Mapping query is not fetched when the dialog is closed (network condition verified by existing tests).
- [ ] File input and the rest of the import form behave unchanged in the unconfigured state.

**Verification:**

- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] Manual: import dialog → unconfigured account shows warning + disabled button; configured account enables the button

**Dependencies:** Task 1

**Files likely touched:**

- `frontend/src/pages/TransactionsPage.tsx`

**Estimated scope:** Small (1 file)

---

## Checkpoint: After Tasks 1–2

- [ ] `specs/import-preview-gating-unconfigured-mapping.md` success criteria satisfied
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] Human review before `[specs]` / `[tech]` commits
