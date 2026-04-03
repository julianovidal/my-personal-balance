"""add split transaction parent field

Revision ID: 20260219_0005
Revises: 20260219_0004
Create Date: 2026-02-19 19:10:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260219_0005"
down_revision: Union[str, Sequence[str], None] = "20260219_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("parent_transaction_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_transactions_parent_transaction_id_transactions",
        "transactions",
        "transactions",
        ["parent_transaction_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(op.f("ix_transactions_parent_transaction_id"), "transactions", ["parent_transaction_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_parent_transaction_id"), table_name="transactions")
    op.drop_constraint("fk_transactions_parent_transaction_id_transactions", "transactions", type_="foreignkey")
    op.drop_column("transactions", "parent_transaction_id")
