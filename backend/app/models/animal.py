import uuid
import enum
from sqlalchemy import Column, String, Date, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class AnimalGender(str, enum.Enum):
    MALE = "M"
    FEMALE = "F"

class AnimalStatus(str, enum.Enum):
    ACTIVE = "Active"
    SOLD = "Sold"
    DECEASED = "Deceased"

class Animal(Base):
    __tablename__ = "animals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    farm_id = Column(String(36), ForeignKey("farms.id"), nullable=False)
    registration_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    breed = Column(String, nullable=True)
    gender = Column(SQLEnum(AnimalGender), nullable=False)
    birth_date = Column(Date, nullable=True)

    mother_id = Column(String(36), ForeignKey("animals.id"), nullable=True)
    father_id = Column(String(36), ForeignKey("animals.id"), nullable=True)

    status = Column(SQLEnum(AnimalStatus), default=AnimalStatus.ACTIVE, nullable=False)

    farm = relationship("Farm", back_populates="animals")
    events = relationship("Event", back_populates="animal", cascade="all, delete-orphan")
    mother = relationship("Animal", remote_side="Animal.id", foreign_keys=[mother_id], backref="children_as_mother")
    father = relationship("Animal", remote_side="Animal.id", foreign_keys=[father_id], backref="children_as_father")