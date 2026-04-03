"""add account import mappings table

Revision ID: 20260219_0003
Revises: 20260219_0002
Create Date: 2026-02-19 17:10:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260219_0003"
down_revision: Union[str, Sequence[str], None] = "20260219_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account_import_mappings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("date_column", sa.String(length=120), nullable=True),
        sa.Column("description_column", sa.String(length=120), nullable=True),
        sa.Column("amount_column", sa.String(length=120), nullable=True),
        sa.Column("currency_column", sa.String(length=120), nullable=True),
        sa.Column("tag_id_column", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id"),
    )
    op.create_index(op.f("ix_account_import_mappings_id"), "account_import_mappings", ["id"], unique=False)
    op.create_index(
        op.f("ix_account_import_mappings_account_id"),
        "account_import_mappings",
        ["account_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_account_import_mappings_account_id"), table_name="account_import_mappings")
    op.drop_index(op.f("ix_account_import_mappings_id"), table_name="account_import_mappings")
    op.drop_table("account_import_mappings")
