# Spec: Classifier untagged list leaves out split parents

## Problem

`GET /api/classifier/transactions/untagged` returned every untagged, non-transfer row in the account, including a transaction that has been split. Once a transaction has split parts, the parts replace it everywhere money is counted (dashboard, balances, transactions list), and its own tag is never used. Listing the parent asked the user to tag something with no effect, showed its full amount next to the parts that make it up, and counted it in the Classifier page's "Untagged" total.

`POST /api/classifier/predict` used the same filter, so it also predicted tags for split parents.

## Behavior

An untagged row for the classifier is a transaction in the account that:

- has no tag,
- is not a transfer, and
- is not a split parent, meaning no other transaction has its `parent_transaction_id` set to this row's id.

This applies to the untagged list and to predict, with and without `transaction_ids`. A split parent id passed in `transaction_ids` gets no prediction.

Split parts stay in the list. Tagging one through `PUT /transactions/:id` keeps it in its split (`specs/split-part-update-keeps-parent.md`).

Unchanged:

- A transaction with no parts, and a split part, are listed as before.
- The remainder of a partly split parent is not a stored row, so it is not listed. Tagging it means adding a split part in the split dialog.
- Training still reads every tagged, non-transfer row, split parents included.

## Implementation

The query moves from `classifier/app/main.py` to `classifier/app/services/untagged_transactions.py`, so the list and predict share one filter.

## Tests

`classifier/tests/test_untagged_transactions.py`, on in-memory SQLite (no Postgres):

- A split parent is left out; its parts and a plain untagged row are listed.
- Tagged rows, transfers, other accounts, and other users' rows are left out.
- Limiting to ids drops a split parent id.
