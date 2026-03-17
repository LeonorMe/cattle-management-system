from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.models.animal import Animal
from app.models.user import User
from app.schemas.animal import AnimalCreate, AnimalUpdate, AnimalOut

router = APIRouter()

def _get_farm_animal(animal_id: str, db: Session, farm_id: str) -> Animal:
    animal = db.query(Animal).filter(
        Animal.id == animal_id,
        Animal.farm_id == farm_id
    ).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")
    return animal

@router.get("/", response_model=List[AnimalOut])
def list_animals(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    status: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
) -> Any:
    """List all animals in the current user's farm."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a farm")
    query = db.query(Animal).filter(Animal.farm_id == current_user.farm_id)
    if status:
        query = query.filter(Animal.status == status)
    if gender:
        query = query.filter(Animal.gender == gender)
    return query.all()

@router.post("/", response_model=AnimalOut, status_code=201)
def create_animal(
    animal_in: AnimalCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Add a new animal to the farm."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="You must belong to a farm first")
    existing = db.query(Animal).filter(
        Animal.farm_id == current_user.farm_id,
        Animal.registration_id == animal_in.registration_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Registration ID already exists in this farm")
    animal = Animal(**animal_in.model_dump(), farm_id=current_user.farm_id)
    db.add(animal)
    db.commit()
    db.refresh(animal)
    return animal

@router.get("/{animal_id}", response_model=AnimalOut)
def get_animal(
    animal_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get a single animal by ID."""
    return _get_farm_animal(animal_id, db, current_user.farm_id)

@router.patch("/{animal_id}", response_model=AnimalOut)
def update_animal(
    animal_id: str,
    animal_in: AnimalUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update an animal's data."""
    animal = _get_farm_animal(animal_id, db, current_user.farm_id)
    update_data = animal_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(animal, field, value)
    db.commit()
    db.refresh(animal)
    return animal

@router.delete("/{animal_id}", status_code=204)
def delete_animal(
    animal_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    """Soft-delete (mark as Deceased) or hard-delete an animal."""
    animal = _get_farm_animal(animal_id, db, current_user.farm_id)
    db.delete(animal)
    db.commit()
