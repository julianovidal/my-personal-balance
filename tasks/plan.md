# Implementation Plan: Disable import preview until the account's import settings are configured

## Overview

Frontend-only gating of the import dialog on `TransactionsPage`: the **Preview import** button is disabled by default and enabled only when the selected account has a saved import mapping. While an unconfigured account is selected, a warning points the user to Accounts → Import Settings. Reuses `GET /accounts/:id/import-mapping` with the same TanStack Query pattern as `AccountsPage`.

Source spec: `specs/import-preview-gating-unconfigured-mapping.md`.

## Architecture Decisions

- **Frontend-only:** no backend changes. The backend `GET` returns all-null columns when no mapping was ever saved, so "any column non-null" is the configured test.
- **Single query on TransactionsPage:** `useQuery` with key `["account-import-mapping", uploadAccountId]`, `enabled: Boolean(uploadAccountId) && isImportModalOpen`, `refetchOnWindowFocus: false` — mirrors `AccountsPage.tsx` (lines 91–99).
- **Derived flag, no extra state:** `isMappingConfigured` is computed from the query result; it follows the query so switching accounts needs no reset logic.
- **Button disabled by default:** `disabled={!isMappingConfigured || previewUpload.isPending}` covers all three states (no account / unconfigured / configured).
- **Warning with a `Link` to `/accounts`** that closes the dialog on click — matches the existing pattern of `Link` usage in `Layout.tsx`.
- **Confirm import untouched:** it already depends on a preview, and a preview can no longer be produced without a mapping.

## Dependency Graph

```
TransactionsPage.test.tsx (new gating tests)
        │
        └── TransactionsPage.tsx (mapping query + gating + warning)
```

No backend, no new dependencies. Sequential: tests first (red), then implementation (green).

## Task List

### Phase 1: Tests

- [ ] Task 1: Import dialog gating tests in `TransactionsPage.test.tsx`

### Checkpoint: After Task 1

- [ ] New gating tests fail against current code (button not gated yet)
- [ ] Existing split-dialog tests still pass (mapping query is dormant until the import dialog opens)

### Phase 2: Implementation

- [ ] Task 2: Mapping query, gating flag, and warning in `TransactionsPage.tsx`

### Checkpoint: Complete

- [ ] All success criteria in `specs/import-preview-gating-unconfigured-mapping.md` met
- [ ] `cd frontend && pnpm test` passes
- [ ] `cd frontend && pnpm run build` succeeds
- [ ] Manual: `pnpm run dev` → Transactions → Import transactions → select unconfigured account (warning + disabled) → configured account (enabled)

Full task detail: `tasks/todo.md`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `api.get` mock fallback (`return { data: [] }`) collides with the mapping response shape in tests | Med | New describe block branches on `url.includes("/import-mapping")` in its own `beforeEach` |
| Warning flashes while mapping is in flight (query fetching, flag still false) | Low | Acceptable: fetch is fast and local; could render warning only when `!isMappingLoading` if it proves noisy |
| React-query invalidation when mapping saved on Accounts page | Low | Mapping query has `refetchOnWindowFocus: false`; dialog re-open re-fetches because `enabled` toggles with `isImportModalOpen` — verify manually |
| Existing split tests share the mocked `api.get` | Low | New tests use their own `beforeEach` mock setup; split describe block untouched |

## Parallelization

Sequential only: Task 1 → Task 2. No parallel work.

## Open Questions

- None.
