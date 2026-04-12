import datetime
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.invitation import Invitation
from app.models.farm import Farm
from app.schemas.invitation import InvitationCreate, InvitationOut

router = APIRouter()

@router.post("/", response_model=InvitationOut)
def invite_user(
    inv_in: InvitationCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Invite someone to the farm (Farm Owner only)."""
    if not current_user.farm_id:
        raise HTTPException(status_code=400, detail="User is not associated with any farm")
    
    farm = db.query(Farm).filter(Farm.id == current_user.farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
        
    if farm.owner_id != current_user.id:
         raise HTTPException(status_code=403, detail="Only the farm owner can invite members")

    invitation = Invitation(
        farm_id=current_user.farm_id,
        email=inv_in.email,
        role=inv_in.role
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation

@router.get("/", response_model=List[InvitationOut])
def list_invitations(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """List invitations for the current user's farm."""
    if not current_user.farm_id:
        return []
    return db.query(Invitation).filter(Invitation.farm_id == current_user.farm_id).all()

@router.post("/accept/{token}")
def accept_invitation(
    token: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Accept an invitation to join a farm."""
    invitation = db.query(Invitation).filter(Invitation.token == token).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    now = datetime.datetime.utcnow()
    if invitation.expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation has expired")
    
    if invitation.accepted_at:
        raise HTTPException(status_code=400, detail="Invitation already used")

    current_user.farm_id = invitation.farm_id
    current_user.role = invitation.role
    invitation.accepted_at = now
    
    db.commit()
    return {"status": "success", "farm_id": invitation.farm_id}
