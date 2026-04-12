from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

class InvitationBase(BaseModel):
    email: EmailStr
    role: str = "member"

class InvitationCreate(InvitationBase):
    pass

class InvitationOut(InvitationBase):
    id: str
    farm_id: str
    token: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None

    class Config:
        from_attributes = True
