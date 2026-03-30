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

@router.get("/{animal_id}/genealogy", response_model=Any)
def get_animal_genealogy(
    animal_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get parents and children of an animal."""
    animal = _get_farm_animal(animal_id, db, current_user.farm_id)
    
    # We already have relationships `mother` and `father` defined on the model
    # and backrefs `children_as_mother` and `children_as_father`.
    mother = animal.mother
    father = animal.father
    
    children = []
    if animal.gender.value == 'F':
        children = animal.children_as_mother
    else:
        children = animal.children_as_father
        
    from app.schemas.animal import GenealogyOut
    return GenealogyOut(
        mother=mother,
        father=father,
        children=children
    )

@router.get("/export/excel")
def export_animals(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    format: str = Query("xlsx", description="Format: xlsx or csv")
) -> StreamingResponse:
    """Export all animals to Excel or CSV."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a farm")

    animals = db.query(Animal).filter(Animal.farm_id == current_user.farm_id).all()
    
    def get_reg_id(animal_id):
        if not animal_id: return ""
        parent = db.query(Animal).filter(Animal.id == animal_id).first()
        return parent.registration_id if parent else ""

    headers = [
        "registration_id", "name", "breed", "gender", 
        "birth_date", "status", "mother_registration_id", "father_registration_id"
    ]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        for a in animals:
            writer.writerow([
                a.registration_id,
                a.name or "",
                a.breed or "",
                a.gender.value,
                a.birth_date.isoformat() if a.birth_date else "",
                a.status.value,
                get_reg_id(a.mother_id),
                get_reg_id(a.father_id)
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=animals_export.csv"}
        )
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Animals"
        ws.append(headers)
        for a in animals:
            ws.append([
                a.registration_id,
                a.name or "",
                a.breed or "",
                a.gender.value,
                a.birth_date.isoformat() if a.birth_date else "",
                a.status.value,
                get_reg_id(a.mother_id),
                get_reg_id(a.father_id)
            ])
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=animals_export.xlsx"}
        )

@router.post("/import/excel")
def import_animals(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Import animals from Excel or CSV."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="You are not assigned to a farm")
        
    content = file.file.read()
    filename = file.filename.lower()
    
    rows = []
    if filename.endswith(".csv"):
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            rows.append(row)
    elif filename.endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        headers = [cell.value for cell in ws[1]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]: continue  
            row_dict = dict(zip(headers, row))
            rows.append(row_dict)
    else:
        raise HTTPException(status_code=400, detail="Invalid file type. Only .xlsx and .csv are supported.")
        
    def resolve_parent_id(reg_id):
        if not reg_id: return None
        parent = db.query(Animal).filter(Animal.farm_id == current_user.farm_id, Animal.registration_id == str(reg_id).strip()).first()
        return parent.id if parent else None
        
    imported_count = 0
    updated_count = 0
    
    for row in rows:
        reg_id = str(row.get("registration_id", "")).strip()
        if not reg_id: continue
        
        name = row.get("name")
        breed = row.get("breed")
        gender_str = str(row.get("gender", "F")).strip().upper()
        gender = AnimalGender.MALE if gender_str == "M" else AnimalGender.FEMALE
        
        birth_date_val = row.get("birth_date")
        birth_date = None
        if birth_date_val:
            if isinstance(birth_date_val, datetime):
                birth_date = birth_date_val.date()
            else:
                try:
                    birth_date = datetime.strptime(str(birth_date_val).strip(), "%Y-%m-%d").date()
                except ValueError:
                    pass
                    
        status_str = str(row.get("status", "Active")).strip().capitalize()
        status = AnimalStatus.ACTIVE
        if status_str == "Sold": status = AnimalStatus.SOLD
        elif status_str == "Deceased": status = AnimalStatus.DECEASED
        
        mother_reg_id = row.get("mother_registration_id")
        father_reg_id = row.get("father_registration_id")
        
        mother_id = resolve_parent_id(mother_reg_id)
        father_id = resolve_parent_id(father_reg_id)
        
        existing = db.query(Animal).filter(Animal.farm_id == current_user.farm_id, Animal.registration_id == reg_id).first()
        if existing:
            existing.name = name
            existing.breed = breed
            existing.gender = gender
            existing.birth_date = birth_date
            existing.status = status
            existing.mother_id = mother_id
            existing.father_id = father_id
            updated_count += 1
        else:
            new_animal = Animal(
                farm_id=current_user.farm_id,
                registration_id=reg_id,
                name=name,
                breed=breed,
                gender=gender,
                birth_date=birth_date,
                status=status,
                mother_id=mother_id,
                father_id=father_id
            )
            db.add(new_animal)
            imported_count += 1
            
    db.commit()
    return {"imported": imported_count, "updated": updated_count}
