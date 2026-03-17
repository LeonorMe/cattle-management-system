from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.farm import Farm
from app.models.user import User
from app.schemas.farm import FarmCreate, FarmUpdate, FarmOut

router = APIRouter()

@router.post("/", response_model=FarmOut, status_code=201)
def create_farm(
    farm_in: FarmCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Create a new farm owned by the current user."""
    farm = Farm(name=farm_in.name, location=farm_in.location, owner_id=current_user.id)
    db.add(farm)
    # Assign user to this farm
    current_user.farm_id = farm.id
    db.commit()
    db.refresh(farm)
    return farm

@router.get("/me", response_model=FarmOut)
def get_my_farm(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get the farm the current user belongs to."""
    if not current_user.farm_id:
        raise HTTPException(status_code=404, detail="You are not assigned to a farm")
    farm = db.query(Farm).filter(Farm.id == current_user.farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm

@router.patch("/me", response_model=FarmOut)
def update_my_farm(
    farm_in: FarmUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update current user's farm (owner only)."""
    farm = db.query(Farm).filter(Farm.id == current_user.farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the farm owner can edit it")
    if farm_in.name is not None:
        farm.name = farm_in.name
    if farm_in.location is not None:
        farm.location = farm_in.location
    db.commit()
    db.refresh(farm)
    return farm

@router.post("/join/{farm_id}", response_model=FarmOut)
def join_farm(
    farm_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Join an existing farm by ID."""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    current_user.farm_id = farm_id
    db.commit()
    db.refresh(farm)
    return farm
