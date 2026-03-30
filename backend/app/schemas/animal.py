from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.models.animal import AnimalGender, AnimalStatus

class AnimalBase(BaseModel):
    registration_id: str
    name: Optional[str] = None
    breed: Optional[str] = None
    gender: AnimalGender
    birth_date: Optional[date] = None
    status: AnimalStatus = AnimalStatus.ACTIVE
    mother_id: Optional[str] = None
    father_id: Optional[str] = None

class AnimalCreate(AnimalBase):
    pass

class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    breed: Optional[str] = None
    birth_date: Optional[date] = None
    status: Optional[AnimalStatus] = None
    mother_id: Optional[str] = None
    father_id: Optional[str] = None

class AnimalOut(AnimalBase):
    id: str
    farm_id: str

    class Config:
        from_attributes = True

class GenealogyOut(BaseModel):
    mother: Optional[AnimalOut] = None
    father: Optional[AnimalOut] = None
    children: list[AnimalOut] = []

    class Config:
        from_attributes = True
