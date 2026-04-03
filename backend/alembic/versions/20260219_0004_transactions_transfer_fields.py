"""add transfer fields to transactions

Revision ID: 20260219_0004
Revises: 20260219_0003
Create Date: 2026-02-19 18:35:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260219_0004"
down_revision: Union[str, Sequence[str], None] = "20260219_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("is_transfer", sa.Boolean(), nullable=True))
    op.add_column("transactions", sa.Column("transfer_group_id", sa.String(length=64), nullable=True))
    op.add_column("transactions", sa.Column("transfer_direction", sa.String(length=10), nullable=True))
    op.add_column("transactions", sa.Column("linked_account_id", sa.Integer(), nullable=True))

    op.execute("UPDATE transactions SET is_transfer = false WHERE is_transfer IS NULL")
    op.alter_column("transactions", "is_transfer", nullable=False)

    op.create_foreign_key(
        "fk_transactions_linked_account_id_accounts",
        "transactions",
        "accounts",
        ["linked_account_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(op.f("ix_transactions_is_transfer"), "transactions", ["is_transfer"], unique=False)
    op.create_index(op.f("ix_transactions_transfer_group_id"), "transactions", ["transfer_group_id"], unique=False)
    op.create_index(op.f("ix_transactions_linked_account_id"), "transactions", ["linked_account_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_linked_account_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_transfer_group_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_is_transfer"), table_name="transactions")

    op.drop_constraint("fk_transactions_linked_account_id_accounts", "transactions", type_="foreignkey")

    op.drop_column("transactions", "linked_account_id")
    op.drop_column("transactions", "transfer_direction")
    op.drop_column("transactions", "transfer_group_id")
    op.drop_column("transactions", "is_transfer")
