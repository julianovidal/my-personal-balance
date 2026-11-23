# Spec: Disable import preview until the account's import settings are configured

## Assumptions (correct before implementation)

1. **Frontend-only** — No backend or API changes; reuse `GET /accounts/:id/import-mapping` to detect configuration.
2. **"Configured" = any mapping saved.** The backend `GET` returns a response with all-null columns when no mapping was ever saved. A mapping saved with every field emptied is indistinguishable from no mapping (backend `_normalize_optional` stores empty strings as `null`); treat that as **unconfigured** — the import would fail anyway, so this is the safer reading.
3. **Detection per selected account.** `TransactionsPage` does not currently fetch mappings; the fetch happens when an account is chosen in the import dialog, not for all accounts upfront.
4. **Required columns note stays.** The existing "Required columns: date, description, amount, currency." help text is unchanged; this feature is about the mapping, not the file format.
5. **No new dependencies.**

## Objective

The import dialog on `TransactionsPage` lets a user pick an account and preview a CSV/XLSX even when that account has no import settings configured. The preview then fails with a backend error ("no column mapping") that does not tell the user where to fix it.

**User story:** As a user importing transactions, when I select an account that has no import settings, I want the import to be visibly unavailable with a message telling me to configure it first, so I am not stuck deciphering a preview error.

**Primary success:** With an unconfigured account selected, **Preview import** is disabled and a warning message points to Accounts → Import Settings.

**Out of scope:** Backend changes; blocking the top-level **Import transactions** button; changes to the Accounts page import settings modal; auto-redirecting the user.

## Tech Stack

- React 19, TypeScript 5
- TanStack Query (new mapping query on `TransactionsPage`)
- react-router-dom `Link` (already used in `Layout.tsx`)
- shadcn-style `Button` under `frontend/src/components/ui/`

## Commands

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
cd frontend && pnpm run dev
```

## Project Structure

```text
frontend/src/pages/TransactionsPage.tsx        → Mapping query + gating logic in import dialog
frontend/tests/TransactionsPage.test.tsx       → New tests for the gating behavior
specs/import-preview-gating-unconfigured-mapping.md → This spec
```

## Code Style

Mirror the mapping query pattern already in `AccountsPage.tsx`:

- Query: `queryKey: ["account-import-mapping", uploadAccountId]`, `enabled: Boolean(uploadAccountId) && isImportModalOpen`, `refetchOnWindowFocus: false`, calling `api.get<AccountImportMapping>(`/accounts/${uploadAccountId}/import-mapping`)`.
- Derived flag: `const isMappingConfigured = Boolean(mapping && [mapping.date_column, mapping.description_column, mapping.amount_column, mapping.currency_column, mapping.tag_id_column].some((c) => c !== null));`
Gating states (per selected account — no workspace-wide check):

| State | Warning | Preview import button |
|---|---|---|
| No account selected | none | disabled |
| Account selected, no mapping saved | warning | disabled |
| Account selected, mapping exists | none | enabled |

- **Preview import button:** `disabled={!isMappingConfigured || previewUpload.isPending}`. This covers all three states — the button is disabled by default and enabled only once a configured account is selected.
- **Warning message:** rendered only when an account is selected and unconfigured — "This account has no import settings configured yet. Set them under Accounts → Import Settings first." where "Accounts" is a `Link` to `/accounts` that closes the dialog on click.
- Re-selecting a different account or changing the tag clears the preview/result state as today; the flag follows the query, so no extra state is added.

A two-tier variant (immediate workspace-wide warning when *no* account anywhere is configured) was considered and **discarded**: it requires fetching every account's mapping upfront or a backend flag, and the per-account warning already reaches the user after one selection.

## Testing Strategy

Vitest + Testing Library; mock `@/api/client` as in `AccountsPage.test.tsx` and `@/api/classifierClient` if needed by shared imports.

- Mock accounts and `GET .../import-mapping`.
- **Unconfigured:** select account, open import dialog, choose account whose mapping returns all-null columns → **Preview import** disabled and warning text visible.
- **Configured:** same setup with a mapping that has column values → button enabled, no warning.
- **No account selected:** dialog opens with no warning and **Preview import** disabled — no account means no mapping, so the button stays disabled.
- **Link:** warning contains a link to `/accounts`.

`pnpm test` must pass before the `[tech]` commit.

## Boundaries

- **Always:** Gate on the selected account only; run `pnpm test`; `[specs]` then `[tech]` commits per repo `AGENTS.md`.
- **Ask first:** Extracting a shared import dialog component; adding a backend `is_configured` flag to the mapping response.
- **Never:** Change the import-mapping API contract; disable the top-level **Import transactions** button; block the dialog from opening.

## Success Criteria

- No account selected: **Preview import** is disabled and no warning is shown.
- Selecting an account without saved import settings disables **Preview import** and shows the warning with an Accounts link.
- Selecting an account with saved import settings enables **Preview import** with no warning.
- The file input still accepts files in the unconfigured state (only the preview submission is gated).
- `cd frontend && pnpm test` passes.

## Resolved decisions

1. **Which button:** Only **Preview import** inside the dialog; the top-level **Import transactions** button stays enabled so users can open the dialog and read the message.
2. **Configured rule:** Any mapping saved (any column non-null), per user choice.
3. **Check scope:** Per selected account only. An earlier two-tier idea (immediate warning when no account anywhere is configured) was explored and discarded — it requires fetching all mappings upfront or a backend flag, and the per-account warning suffices after one selection.

## Open Questions

- None.
