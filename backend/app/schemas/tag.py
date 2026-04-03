from pydantic import BaseModel


class TagCreate(BaseModel):
    label: str


class TagUpdate(BaseModel):
    label: str


class TagResponse(BaseModel):
    id: int
    label: str
    user_id: int

    class Config:
        from_attributes = True
