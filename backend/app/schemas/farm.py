from pydantic import BaseModel
from typing import Optional

class FarmBase(BaseModel):
    name: str
    location: Optional[str] = None

class FarmCreate(FarmBase):
    pass

class FarmUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None

class FarmOut(FarmBase):
    id: str
    owner_id: str

    class Config:
        from_attributes = True
