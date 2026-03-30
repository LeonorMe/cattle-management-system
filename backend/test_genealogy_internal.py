from app.db.session import SessionLocal
from app.db.base import Base  # Import this to set up all ORM mappings
from app.models.animal import Animal, AnimalGender, AnimalStatus
from app.api.v1.routes.animals import get_animal_genealogy
from app.models.farm import Farm
from app.models.user import User

db = SessionLocal()

# Cleanup
db.query(Animal).delete()
db.query(Farm).delete()
db.query(User).delete()
db.commit()

# Create dummy user to satisfy depends
user = User(email="test@test.com", name="Test", password_hash="hash")
db.add(user)
db.commit()
db.refresh(user)

farm = Farm(name="Test Farm", owner_id=user.id)
db.add(farm)
db.commit()
db.refresh(farm)

user.farm_id = farm.id
db.commit()

# Create mother
mother = Animal(
    farm_id=farm.id,
    registration_id="MOM123",
    name="Mommy",
    gender=AnimalGender.FEMALE,
    status=AnimalStatus.ACTIVE
)
db.add(mother)

# Create father
father = Animal(
    farm_id=farm.id,
    registration_id="DAD123",
    name="Daddy",
    gender=AnimalGender.MALE,
    status=AnimalStatus.ACTIVE
)
db.add(father)
db.commit()

db.refresh(mother)
db.refresh(father)

# Create child
child = Animal(
    farm_id=farm.id,
    registration_id="CHILD123",
    name="Calf",
    gender=AnimalGender.FEMALE,
    status=AnimalStatus.ACTIVE,
    mother_id=mother.id,
    father_id=father.id
)
db.add(child)
db.commit()
db.refresh(child)

print("Mother ID:", mother.id)
print("Father ID:", father.id)
print("Child ID:", child.id)

print("\n--- Testing Genealogy for Child ---")
res_c = get_animal_genealogy(child.id, db, user)
print("Mother via Genealogy:", res_c.mother.name if res_c.mother else None)
print("Father via Genealogy:", res_c.father.name if res_c.father else None)
print("Children via Genealogy:", len(res_c.children))

print("\n--- Testing Genealogy for Mother ---")
res_m = get_animal_genealogy(mother.id, db, user)
print("Mother via Genealogy:", res_m.mother.name if res_m.mother else None)
print("Father via Genealogy:", res_m.father.name if res_m.father else None)
print("Children via Genealogy:", [c.name for c in res_m.children])

print("\n--- Testing Genealogy for Father ---")
res_f = get_animal_genealogy(father.id, db, user)
print("Mother via Genealogy:", res_f.mother.name if res_f.mother else None)
print("Father via Genealogy:", res_f.father.name if res_f.father else None)
print("Children via Genealogy:", [c.name for c in res_f.children])

db.close()
print("\nDONE.")
