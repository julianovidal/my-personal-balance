# Spec: Import reports bad amounts and blank descriptions as row errors

## Problem

Two kinds of bad cell in a CSV or XLSX import were not reported as row errors:

- **Amount.** `Decimal("abc")` raises `decimal.InvalidOperation`, which is not a `ValueError`. It escaped the per-row error handling, and preview and import answered 500 for the whole file. A blank amount cell reached `Decimal` as NaN and became `Decimal("NaN")`, and `inf` became `Decimal("Infinity")`. Both passed as valid rows; Postgres `numeric` can store NaN, which would break every balance that adds it.
- **Description.** pandas reads a blank CSV cell as NaN. `str(NaN)` is `"nan"`, so the "Description cannot be empty" check never fired and the row was imported with the description `nan`.

## Behavior

In `backend/app/services/import_service.py`, per row:

- A blank amount cell is a row error: `Amount cannot be empty`.
- An amount that is not a number, or is not finite (`NaN`, `inf`), is a row error: `Invalid amount "<value>"`.
- A blank description cell is a row error: `Description cannot be empty`, the same message a whitespace-only description already gets. pandas' default missing-value markers count as blank, so a description of exactly `N/A`, `NA`, `NaN`, or `null` is also rejected.

The other rows in the file still parse, as with any row error.

Unchanged: valid amounts keep the exact `Decimal` from the cell's text, and amounts with more than two decimals are passed on as before.

## Tests

`backend/tests/test_import_service.py`:

- Blank, non-numeric, and non-finite amounts are row errors with the messages above, and the next row still parses.
- A blank description is a row error.
- The two `test_current_*` tests that pinned the old behavior are replaced.
