from fastapi import APIRouter
from app.api.v1.routes import auth, farms, animals, events, users

api_router = APIRouter()
api_router.include_router(auth.router,    prefix="/auth",    tags=["auth"])
api_router.include_router(users.router,   prefix="/users",   tags=["users"])
api_router.include_router(farms.router,   prefix="/farms",   tags=["farms"])
api_router.include_router(animals.router, prefix="/animals", tags=["animals"])
api_router.include_router(events.router,  prefix="/events",  tags=["events"])
