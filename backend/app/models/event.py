import uuid
import enum
from sqlalchemy import Column, String, Date, Text, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class EventType(str, enum.Enum):
    VACCINATION = "Vaccination"
    MEDICATION = "Medication"
    BIRTH = "Birth"
    HEAT = "Heat"
    PREGNANCY = "Pregnancy"

class SyncStatus(str, enum.Enum):
    PENDING = "Pending"
    SYNCED = "Synced"

class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    animal_id = Column(String(36), ForeignKey("animals.id"), nullable=False)
    event_type = Column(SQLEnum(EventType), nullable=False)
    event_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED, nullable=False)

    animal = relationship("Animal", back_populates="events")
