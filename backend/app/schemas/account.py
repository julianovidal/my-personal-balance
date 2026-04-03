from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    currency: str


class AccountUpdate(BaseModel):
    name: str
    currency: str


class AccountResponse(BaseModel):
    id: int
    name: str
    currency: str
    user_id: int

    class Config:
        from_attributes = True


class AccountImportMappingUpdate(BaseModel):
    date_column: str | None = None
    description_column: str | None = None
    amount_column: str | None = None
    currency_column: str | None = None
    tag_id_column: str | None = None


class AccountImportMappingResponse(BaseModel):
    account_id: int
    date_column: str | None = None
    description_column: str | None = None
    amount_column: str | None = None
    currency_column: str | None = None
    tag_id_column: str | None = None

    class Config:
        from_attributes = True


class AccountBalanceItem(BaseModel):
    account_id: int
    account_name: str
    currency: str
    balance: float


class AccountsBalanceResponse(BaseModel):
    overall_balance: float
    by_account: list[AccountBalanceItem]
