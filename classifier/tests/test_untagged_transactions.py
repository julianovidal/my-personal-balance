"""The untagged-rows query in app/services/untagged_transactions.py, on in-memory SQLite."""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.untagged_transactions import untagged_transactions

USER, OTHER_USER = 1, 2
ACCOUNT, OTHER_ACCOUNT, OTHER_USERS_ACCOUNT = 10, 11, 20

SCHEMA = [
    "CREATE TABLE accounts (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL)",
    """
    CREATE TABLE transactions (
        id INTEGER PRIMARY KEY,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        account_id INTEGER NOT NULL,
        amount NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        tag_id INTEGER,
        is_transfer BOOLEAN NOT NULL DEFAULT FALSE,
        parent_transaction_id INTEGER
    )
    """,
]


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    with Session(engine) as session:
        for statement in SCHEMA:
            session.execute(text(statement))
        session.execute(
            text("INSERT INTO accounts (id, user_id) VALUES (:id, :user_id)"),
            [
                {"id": ACCOUNT, "user_id": USER},
                {"id": OTHER_ACCOUNT, "user_id": USER},
                {"id": OTHER_USERS_ACCOUNT, "user_id": OTHER_USER},
            ],
        )
        yield session


def add(db, id, account_id=ACCOUNT, tag_id=None, is_transfer=False, parent_transaction_id=None, day=1):
    db.execute(
        text(
            """
            INSERT INTO transactions
                (id, date, description, account_id, amount, currency, tag_id, is_transfer, parent_transaction_id)
            VALUES (:id, :date, :description, :account_id, -10, 'EUR', :tag_id, :is_transfer, :parent_transaction_id)
            """
        ),
        {
            "id": id,
            "date": f"2025-01-{day:02d}",
            "description": f"row {id}",
            "account_id": account_id,
            "tag_id": tag_id,
            "is_transfer": is_transfer,
            "parent_transaction_id": parent_transaction_id,
        },
    )


def ids(rows):
    return [row["id"] for row in rows]


def test_split_parent_is_left_out_and_its_parts_are_listed(db):
    add(db, 1, day=3)
    add(db, 2, parent_transaction_id=1, day=3)
    add(db, 3, parent_transaction_id=1, tag_id=5, day=3)
    add(db, 4, day=2)

    assert ids(untagged_transactions(db, user_id=USER, account_id=ACCOUNT)) == [2, 4]


def test_tagged_transfer_and_foreign_rows_are_left_out(db):
    add(db, 1, tag_id=5)
    add(db, 2, is_transfer=True)
    add(db, 3, account_id=OTHER_ACCOUNT)
    add(db, 4, account_id=OTHER_USERS_ACCOUNT)
    add(db, 5)

    assert ids(untagged_transactions(db, user_id=USER, account_id=ACCOUNT)) == [5]
    assert ids(untagged_transactions(db, user_id=OTHER_USER, account_id=ACCOUNT)) == []


def test_rows_are_newest_first_with_the_fields_the_list_needs(db):
    add(db, 1, day=1)
    add(db, 2, day=5)
    add(db, 3, day=5)

    rows = untagged_transactions(db, user_id=USER, account_id=ACCOUNT)

    assert ids(rows) == [3, 2, 1]
    assert set(rows[0].keys()) == {"id", "date", "description", "account_id", "amount", "currency"}


def test_limiting_to_ids_drops_a_split_parent(db):
    add(db, 1)
    add(db, 2, parent_transaction_id=1)
    add(db, 3)
    add(db, 4)

    rows = untagged_transactions(db, user_id=USER, account_id=ACCOUNT, transaction_ids=[1, 2, 3])

    assert sorted(ids(rows)) == [2, 3]
