import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Farm(Base):
    __tablename__ = "farms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    owner_id = Column(String(36), ForeignKey("users.id"))

    owner = relationship("User", foreign_keys=[owner_id], back_populates="farms_owned")
    animals = relationship("Animal", back_populates="farm")
    members = relationship("User", foreign_keys="[User.farm_id]", back_populates="farm")
