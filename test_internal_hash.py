import sys
import os
sys.path.insert(0, os.path.abspath('backend'))

from app.schemas.user import UserCreate
from app.core import security

try:
    user_in = UserCreate(email="test@example.com", name="Test", password="password123")
    print(f"UserIn: {user_in}")
    h = security.get_password_hash(user_in.password)
    print(f"Hash: {h}")
    print("Success!")
except Exception as e:
    print(f"Error: {e}")
