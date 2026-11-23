# Spec: Keep focus while editing a split amount

## Objective

A person splitting a transaction on the Transactions page types an amount into a split row. Today, each keystroke moves focus off that amount field, so the next character does not land in the same input.

Keep focus on the split amount field for the whole edit. The typed characters stay in that field, in order, and the "missing split" remainder updates as the amount changes.

The same dialog also has a description field and a tag select on each row. Those controls update the same row state, so they must keep focus too. The dialog still receives focus when it opens, and Escape, the close button, and the backdrop still close it.

This is frontend-only. Split save, remaining-amount rules, and the backend contract stay as they are.

### Cause to remove

`DialogContent` focuses its container whenever `onOpenChange` changes. Split (and the other dialogs) pass a new `onOpenChange` function on every render. Typing updates row state, the page re-renders, the effect runs again, and `contentRef.current?.focus()` takes focus away from the input.

Opening the dialog is the only time that container focus should run.

## Tech Stack

- React 19, TypeScript 5
- Vite 8, Vitest 4, Testing Library, happy-dom
- Existing dialog, input, and table primitives in `frontend/src/components/ui/`
- No new dependencies

## Commands

```bash
cd frontend && pnpm test
cd frontend && pnpm run build
cd frontend && pnpm run dev
```

## Project Structure

```text
frontend/src/components/ui/dialog.tsx   → Dialog focus behavior
frontend/src/pages/TransactionsPage.tsx → Split dialog (consumer; change only if the dialog fix is not enough)
frontend/tests/                         → Vitest tests for pages
specs/split-transaction-amount-focus.md → This spec
```

## Code Style

Match the existing dialog module: function components, `React.useEffect` for open/close side effects, no new abstraction for one callback.

The open effect focuses the dialog container when the dialog becomes open. It does not run again because the parent passed a new close handler.

```tsx
React.useEffect(() => {
  if (!open) return

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onOpenChange(false)
  }

  document.addEventListener("keydown", onKeyDown)
  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = "hidden"
  contentRef.current?.focus()

  return () => {
    document.removeEventListener("keydown", onKeyDown)
    document.body.style.overflow = previousOverflow
  }
}, [open])
```

`onOpenChange` inside that effect must still see the latest handler (a ref updated on each render), so Escape keeps closing the dialog after the parent re-renders.

Amounts stay strings. Do not parse split amounts with binary floats as part of this change.

## Testing Strategy

Vitest and Testing Library, same style as `frontend/tests/AccountsPage.test.tsx`. Mock `@/api/client`.

- Interaction test on the split dialog: open Split for a transaction, type several characters into the amount field (for example `12.50`), and assert that field still has focus and shows the full string.
- Same assertion for the description field on that row.
- Assert the missing-split remainder text changes after the amount is typed.
- Assert the dialog still opens with focus inside it, and that Escape still closes it after the amount has been edited.
- Cover the add-account name field the same way, because it uses the same dialog and an inline `onOpenChange`. One extra test on `AccountsPage` is enough regression coverage for the other dialogs.

`pnpm test` must pass. No backend tests.

## Boundaries

- Always: keep the dialog's open focus, Escape, close button, and backdrop behavior; add a Vitest test for the split amount field before changing the dialog; run `pnpm test`.
- Ask first: changing split save payloads, remaining-amount rules, or adding a dependency.
- Never: edit applied Alembic revisions, commit `.env` files, or change money handling to binary floats.

## Success Criteria

- After each character typed into a split row's amount field, that same input still has focus.
- Typing `12.50` leaves `12.50` in that field.
- Typing a description on the same row keeps focus on the description field.
- The missing-split remainder updates from the typed amount without moving focus.
- Opening the split dialog still moves focus into the dialog.
- Escape, the close control, and the backdrop still close the split dialog after an amount has been typed.
- The add-account name field keeps focus while typing.
- `cd frontend && pnpm test` passes.

## Open Questions

- None. Description, tag, and the add-account name field are in scope because they share the dialog focus effect. Split save behavior is out of scope.
