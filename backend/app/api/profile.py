from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=UserResponse)
def read_profile(current_user: User = Depends(get_current_user)):
    return current_user
