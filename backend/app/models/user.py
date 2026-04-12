import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    farm_id = Column(String(36), ForeignKey("farms.id"), nullable=True)
    role = Column(String, default="member")  # 'owner', 'member'

    farms_owned = relationship("Farm", foreign_keys="[Farm.owner_id]", back_populates="owner")
    farm = relationship("Farm", foreign_keys=[farm_id], back_populates="members")
