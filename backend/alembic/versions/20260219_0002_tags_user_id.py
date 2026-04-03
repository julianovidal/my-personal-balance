"""move tags from account scope to user scope

Revision ID: 20260219_0002
Revises: 20260219_0001
Create Date: 2026-02-19 15:10:00

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260219_0002"
down_revision: Union[str, Sequence[str], None] = "20260219_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("user_id", sa.Integer(), nullable=True))

    op.execute(
        """
        UPDATE tags
        SET user_id = accounts.user_id
        FROM accounts
        WHERE tags.account_id = accounts.id
        """
    )

    op.alter_column("tags", "user_id", nullable=False)
    op.create_foreign_key("fk_tags_user_id_users", "tags", "users", ["user_id"], ["id"], ondelete="CASCADE")
    op.create_index(op.f("ix_tags_user_id"), "tags", ["user_id"], unique=False)

    op.drop_index(op.f("ix_tags_account_id"), table_name="tags")
    op.drop_column("tags", "account_id")


def downgrade() -> None:
    op.add_column("tags", sa.Column("account_id", sa.Integer(), nullable=True))

    op.execute(
        """
        UPDATE tags
        SET account_id = accounts.id
        FROM accounts
        WHERE tags.user_id = accounts.user_id
        """
    )

    op.alter_column("tags", "account_id", nullable=False)
    op.create_foreign_key("fk_tags_account_id_accounts", "tags", "accounts", ["account_id"], ["id"], ondelete="CASCADE")
    op.create_index(op.f("ix_tags_account_id"), "tags", ["account_id"], unique=False)

    op.drop_index(op.f("ix_tags_user_id"), table_name="tags")
    op.drop_constraint("fk_tags_user_id_users", "tags", type_="foreignkey")
    op.drop_column("tags", "user_id")
