from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.event import Event
from app.models.animal import Animal
from app.models.user import User
from app.schemas.event import EventCreate, EventUpdate, EventOut

router = APIRouter()

@router.get("/", response_model=List[EventOut])
def list_events(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List all events for all animals in the current user's farm."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="Not assigned to a farm")
    animal_ids = [a.id for a in db.query(Animal.id).filter(Animal.farm_id == current_user.farm_id).all()]
    return db.query(Event).filter(Event.animal_id.in_(animal_ids)).all()

@router.post("/", response_model=EventOut, status_code=201)
def create_event(
    event_in: EventCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Record a new event for an animal."""
    animal = db.query(Animal).filter(
        Animal.id == event_in.animal_id,
        Animal.farm_id == current_user.farm_id
    ).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found in your farm")
    event = Event(**event_in.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

@router.get("/{event_id}", response_model=EventOut)
def get_event(
    event_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    event_in: EventUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    update_data = event_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event

@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> None:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
