from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AccountImportMapping(Base):
    __tablename__ = "account_import_mappings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, index=True)

    date_column: Mapped[str | None] = mapped_column(String(120), nullable=True)
    description_column: Mapped[str | None] = mapped_column(String(120), nullable=True)
    amount_column: Mapped[str | None] = mapped_column(String(120), nullable=True)
    currency_column: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tag_id_column: Mapped[str | None] = mapped_column(String(120), nullable=True)

    account: Mapped["Account"] = relationship(back_populates="import_mapping")
