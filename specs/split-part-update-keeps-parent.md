# Spec: Updating a split part keeps it in its split

## Problem

`PUT /api/transactions/:id` set `parent_transaction_id = None` on every non-transfer update. Tagging a split part (the Classifier page does this) or editing it turned it into a standalone transaction. Its parent still carried the full amount, so the part was counted twice in account balances.

Found on account 11: part #27901 (−€8.00) of card bill #26193 had been detached. The Accounts page showed €90,989.47 while the bank showed €90,997.47.

## Behavior

When the transaction being updated is a split part (`parent_transaction_id` is set):

- The parent link is kept.
- Only `description` and `tag_id` change.
- A request that changes `date`, `account_id`, `amount`, `currency`, or sets `is_transfer` gets a 400: "Split parts can only change description and tag; edit amounts in the split dialog". Those fields follow the parent and are set by `PUT /transactions/:id/splits`.

Other transactions update as before.

## Existing data

Detached parts are not repaired automatically, because a detached part cannot be told apart from a normal transaction. A parent whose parts no longer add up to its amount is a sign of one:

```sql
SELECT p.id, p.amount, SUM(c.amount), p.amount - SUM(c.amount) AS remainder
FROM transactions p JOIN transactions c ON c.parent_transaction_id = p.id
GROUP BY p.id HAVING p.amount - SUM(c.amount) <> 0;
```

Re-link a part by setting its `parent_transaction_id` back to the parent's id.

## Tests

`backend/tests/test_transaction_update.py`: tagging and renaming a part keep the link; amount, date, and transfer changes are rejected; plain transactions still update.
