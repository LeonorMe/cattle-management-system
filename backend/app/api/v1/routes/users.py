from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
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

@router.get("/farm-members", response_model=List[UserOut])
def get_farm_members(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all users in the current user's farm."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="User not assigned to a farm")
    
    return db.query(User).filter(User.farm_id == current_user.farm_id).all()

@router.delete("/farm-members/{user_id}", status_code=204)
def remove_farm_member(
    user_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Remove a user from the farm (only owner can do this)."""
    from app.models.farm import Farm
    
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="User not assigned to a farm")
        
    farm = db.query(Farm).filter(Farm.id == current_user.farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
        
    if farm.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized. Only the farm owner can remove members.")
        
    user_to_remove = db.query(User).filter(User.id == user_id, User.farm_id == current_user.farm_id).first()
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="Member not found in this farm")
        
    if user_to_remove.id == farm.owner_id:
        raise HTTPException(status_code=400, detail="Owner cannot be removed from their own farm")
        
    user_to_remove.farm_id = None
    db.commit()
    return None
