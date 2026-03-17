from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.models.event import EventType, SyncStatus

class EventBase(BaseModel):
    animal_id: str
    event_type: EventType
    event_date: date
    description: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    description: Optional[str] = None
    event_date: Optional[date] = None

class EventOut(EventBase):
    id: str
    sync_status: SyncStatus

    class Config:
        from_attributes = True
