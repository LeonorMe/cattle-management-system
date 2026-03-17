from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    farm_id: Optional[str] = None

class UserOut(UserBase):
    id: str
    farm_id: Optional[str] = None

    class Config:
        from_attributes = True
