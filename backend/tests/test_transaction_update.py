"""PUT /api/transactions/:id must not detach split parts (it used to clear parent_transaction_id)."""

from datetime import date
from decimal import Decimal

from app.core.security import create_access_token
from app.models import Account, Tag, Transaction, User


def seed(db):
    user = User(name="Ana", email="ana@example.com", password="x")
    db.add(user)
    db.flush()
    account = Account(name="Checking", currency="EUR", user_id=user.id)
    tag = Tag(label="Parking", user_id=user.id)
    db.add_all([account, tag])
    db.flush()
    parent = Transaction(date=date(2024, 9, 2), description="Card bill", account_id=account.id, amount=Decimal("-20.00"), currency="EUR")
    db.add(parent)
    db.flush()
    part = Transaction(
        date=parent.date, description="PARKING", account_id=account.id, amount=Decimal("-8.00"),
        currency="EUR", parent_transaction_id=parent.id,
    )
    plain = Transaction(date=date(2024, 9, 3), description="Coffee", account_id=account.id, amount=Decimal("-3.00"), currency="EUR")
    db.add_all([part, plain])
    db.commit()
    return user, account, tag, parent, part, plain


def body(tx, **changes):
    payload = {
        "date": tx.date.isoformat(),
        "description": tx.description,
        "account_id": tx.account_id,
        "tag_id": tx.tag_id,
        "is_transfer": False,
        "destination_account_id": None,
        "amount": str(tx.amount),
        "currency": tx.currency,
    }
    payload.update(changes)
    return payload


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def test_tagging_a_split_part_keeps_it_in_the_split(client, db):
    user, _, tag, parent, part, _ = seed(db)
    res = client.put(f"/api/transactions/{part.id}", json=body(part, tag_id=tag.id), headers=auth(user))
    assert res.status_code == 200
    assert res.json()["parent_transaction_id"] == parent.id
    assert res.json()["tag_id"] == tag.id
    db.expire_all()
    assert db.get(Transaction, part.id).parent_transaction_id == parent.id


def test_split_part_description_can_change(client, db):
    user, _, _, parent, part, _ = seed(db)
    res = client.put(f"/api/transactions/{part.id}", json=body(part, description="Parking Cité"), headers=auth(user))
    assert res.status_code == 200
    assert res.json()["description"] == "Parking Cité"
    assert res.json()["parent_transaction_id"] == parent.id


def test_split_part_amount_or_date_cannot_change_here(client, db):
    user, _, _, _, part, _ = seed(db)
    for change in ({"amount": "-9.00"}, {"date": "2024-09-03"}, {"is_transfer": True}):
        res = client.put(f"/api/transactions/{part.id}", json=body(part, **change), headers=auth(user))
        assert res.status_code == 400, change
    db.expire_all()
    assert db.get(Transaction, part.id).amount == Decimal("-8.00")


def test_plain_transaction_update_still_works(client, db):
    user, _, tag, _, _, plain = seed(db)
    res = client.put(f"/api/transactions/{plain.id}", json=body(plain, amount="-4.50", tag_id=tag.id), headers=auth(user))
    assert res.status_code == 200
    assert Decimal(res.json()["amount"]) == Decimal("-4.50")
    assert res.json()["parent_transaction_id"] is None
