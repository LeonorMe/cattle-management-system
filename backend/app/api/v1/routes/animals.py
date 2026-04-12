from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
import csv
from datetime import datetime
import openpyxl
from app.api import deps
from app.models.animal import Animal, AnimalGender, AnimalStatus
from app.models.user import User
from app.schemas.animal import AnimalCreate, AnimalUpdate, AnimalOut, AnimalBulkUpdate

router = APIRouter()

@router.patch("/bulk", status_code=200)
def update_bulk_animals(
    update_in: AnimalBulkUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update status or breed for multiple animals at once."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Not assigned to a farm")
    
    animals = db.query(Animal).filter(
        Animal.id.in_(update_in.animal_ids),
        Animal.farm_id == current_user.farm_id
    ).all()
    
    if len(animals) != len(update_in.animal_ids):
        raise HTTPException(status_code=404, detail="One or more animals not found in your farm")
    
    for animal in animals:
        if update_in.status is not None:
            animal.status = update_in.status
        if update_in.breed is not None:
            animal.breed = update_in.breed
            
    db.commit()
    return {"status": "success", "count": len(animals)}

def _get_farm_animal(animal_id: str, db: Session, farm_id: str) -> Animal:
    """
    Internal helper to fetch an animal belonging to a specific farm.
    Raises 404 if not found.
    """
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
    breed: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search by name or registration ID"),
) -> Any:
    """
    List all animals in the current user's farm.
    Supports filtering by status, gender, breed and keyword search.
    """
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a farm")
    
    query = db.query(Animal).filter(Animal.farm_id == current_user.farm_id)
    
    if status:
        query = query.filter(Animal.status == status)
    if gender:
        query = query.filter(Animal.gender == gender)
    if breed:
        query = query.filter(Animal.breed.ilike(f"%{breed}%"))
    if q:
        search = f"%{q}%"
        query = query.filter(
            (Animal.name.ilike(search)) | (Animal.registration_id.ilike(search))
        )
        
    return query.all()

@router.post("/", response_model=AnimalOut, status_code=201)
def create_animal(
    animal_in: AnimalCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Add a new animal to the farm. 
    Verifies that the registration ID is unique within the farm.
    """
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
    """
    Retrieve a single animal's details by ID.
    Only accessible if the animal belongs to the user's farm.
    """
    return _get_farm_animal(animal_id, db, current_user.farm_id)

@router.patch("/{animal_id}", response_model=AnimalOut)
def update_animal(
    animal_id: str,
    animal_in: AnimalUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update animal information. 
    Only modifies provided fields.
    """
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
    """
    Hard-delete an animal record from the database.
    (Soft-delete is usually handled via status updates in the UI).
    """
    animal = _get_farm_animal(animal_id, db, current_user.farm_id)
    db.delete(animal)
    db.commit()

@router.get("/{animal_id}/genealogy", response_model=GenealogyOut)
def get_animal_genealogy(
    animal_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Fetch the extended genealogy (Parents, Grandparents, Children).
    Uses relationship mapping from the SQLAlchemy model.
    """
    animal = _get_farm_animal(animal_id, db, current_user.farm_id)
    
    mother = animal.mother
    father = animal.father
    
    maternal_grandfather = mother.father if mother else None
    maternal_grandmother = mother.mother if mother else None
    paternal_grandfather = father.father if father else None
    paternal_grandmother = father.mother if father else None
    
    children = []
    if animal.gender.value == 'F':
        children = animal.children_as_mother
    else:
        children = animal.children_as_father
        
    return GenealogyOut(
        mother=mother,
        father=father,
        maternal_grandfather=maternal_grandfather,
        maternal_grandmother=maternal_grandmother,
        paternal_grandfather=paternal_grandfather,
        paternal_grandmother=paternal_grandmother,
        children=children
    )
