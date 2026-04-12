import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    farm_id = Column(String(36), ForeignKey("farms.id"), nullable=False)
    email = Column(String, index=True, nullable=False)
    role = Column(String, default="member")
    token = Column(String, unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.datetime.utcnow() + datetime.timedelta(days=7))
    accepted_at = Column(DateTime, nullable=True)

    farm = relationship("Farm")
