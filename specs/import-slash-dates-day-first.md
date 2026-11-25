# Spec: Import reads slash dates day-first

## Problem

CSV and XLSX import passed every date cell to `pd.to_datetime` with no format. pandas reads slash dates month-first and silently switches to day-first only when month-first is impossible. In one file, `03/04/2025` became 4 March while `15/01/2025` became 15 January. Imports from day-first banks (BRL, EUR accounts) got some transactions in the wrong month, with no row error.

## Behavior

In `backend/app/services/import_service.py`, a text date cell that contains `/` is read as day, month, year:

- `DD/MM/YYYY`, for example `03/04/2025` is 3 April 2025.
- `DD/MM/YY`, for example `03/04/25` is 3 April 2025 (Python `%y` rules).
- Single-digit day and month are fine (`3/4/2025`). Surrounding spaces are trimmed.
- Any other slash date is a row error: `Invalid date "<value>": use DD/MM/YYYY`. That covers a month-first date such as `01/15/2025`, which is no longer guessed, and a slash date with a time part.

Unchanged:

- ISO text dates (`2025-04-03`) and other text pandas can parse.
- XLSX date cells, which arrive as dates and are used as they are.
- A date pandas cannot parse is still a row error, and the other rows still parse.

There is no per-account date order setting. A month-first export has to be converted before import.

## Tests

`backend/tests/test_import_service.py`:

- `03/04/2025` and `03/04/25` parse as 3 April 2025; `3/4/2025` and ` 03/04/2025 ` also parse.
- `15/01/2025` still parses as 15 January 2025.
- `01/15/2025` is a row error and the next row still parses.
- The `test_current_ambiguous_slash_date_is_read_month_first` test, which pinned the old behavior, is replaced.
