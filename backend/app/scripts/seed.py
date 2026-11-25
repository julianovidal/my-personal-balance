from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.account import Account
from app.models.tag import Tag
from app.models.transaction import Transaction
from app.models.user import User

# example.com is reserved for documentation and passes EmailStr validation.
# The old demo@balance.local was rejected at login (.local is special-use).
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


def run_seed() -> None:
    db = SessionLocal()
    try:
        seed_demo_data(db)
        print(f"Seed complete. Demo login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
    finally:
        db.close()


def seed_demo_data(db: Session) -> None:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if not user:
        user = User(name="Demo User", email=DEMO_EMAIL, password=hash_password(DEMO_PASSWORD))
        db.add(user)
        db.flush()

    checking = db.scalar(select(Account).where(Account.user_id == user.id, Account.name == "Checking"))
    if not checking:
        checking = Account(name="Checking", currency="USD", user_id=user.id)
        db.add(checking)
        db.flush()

    credit = db.scalar(select(Account).where(Account.user_id == user.id, Account.name == "Credit Card"))
    if not credit:
        credit = Account(name="Credit Card", currency="USD", user_id=user.id)
        db.add(credit)
        db.flush()

    groceries = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == "Groceries"))
    if not groceries:
        groceries = Tag(label="Groceries", user_id=user.id)
        db.add(groceries)
        db.flush()

    rent = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == "Rent"))
    if not rent:
        rent = Tag(label="Rent", user_id=user.id)
        db.add(rent)
        db.flush()

    existing_tx = db.scalar(
        select(Transaction).join(Account, Transaction.account_id == Account.id).where(Account.user_id == user.id)
    )
    if not existing_tx:
        today = date.today()
        db.add_all(
            [
                Transaction(
                    date=today - timedelta(days=3),
                    description="Supermarket",
                    account_id=checking.id,
                    tag_id=groceries.id,
                    amount=Decimal("-82.45"),
                    currency="USD",
                ),
                Transaction(
                    date=today - timedelta(days=1),
                    description="Monthly rent",
                    account_id=checking.id,
                    tag_id=rent.id,
                    amount=Decimal("-1250.00"),
                    currency="USD",
                ),
                Transaction(
                    date=today,
                    description="Salary",
                    account_id=checking.id,
                    tag_id=None,
                    amount=Decimal("3200.00"),
                    currency="USD",
                ),
                Transaction(
                    date=today - timedelta(days=2),
                    description="Online subscription",
                    account_id=credit.id,
                    tag_id=None,
                    amount=Decimal("-19.99"),
                    currency="USD",
                ),
            ]
        )

    db.commit()


if __name__ == "__main__":
    run_seed()
