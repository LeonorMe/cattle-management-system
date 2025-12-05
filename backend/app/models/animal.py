from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import declarative_base

# delete Base = declarative_base()

class Animal(Base):
    __tablename__ = "animals"

    id = Column(Integer, primary_key=True, index=True)
    tag_number = Column(String, unique=True, nullable=False)
    birth_year = Column(Integer, nullable=False)

    """ TODO 
    genetic parents

farm_id

reproductive cycle data

events

offspring

notes

health status

img

etc
    """