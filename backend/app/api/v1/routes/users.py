from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter()

@router.get("/me", response_model=UserOut)
def get_current_user_info(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Return the currently authenticated user's profile."""
    return current_user
