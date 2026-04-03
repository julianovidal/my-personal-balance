from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    tag_id: Mapped[int | None] = mapped_column(ForeignKey("tags.id", ondelete="SET NULL"), nullable=True, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    is_transfer: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    transfer_group_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    transfer_direction: Mapped[str | None] = mapped_column(String(10), nullable=True)
    linked_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    parent_transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"), nullable=True, index=True)

    account: Mapped["Account"] = relationship(back_populates="transactions", foreign_keys=[account_id])
    linked_account: Mapped["Account | None"] = relationship(foreign_keys=[linked_account_id])
    tag: Mapped["Tag | None"] = relationship(back_populates="transactions")
