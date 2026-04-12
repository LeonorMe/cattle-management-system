from fastapi import APIRouter
from app.api.v1.routes import auth, farms, animals, events, users, notifications, invitations, reports

api_router = APIRouter()
api_router.include_router(auth.router,    prefix="/auth",    tags=["auth"])
api_router.include_router(users.router,   prefix="/users",   tags=["users"])
api_router.include_router(farms.router,   prefix="/farms",   tags=["farms"])
api_router.include_router(animals.router, prefix="/animals", tags=["animals"])
api_router.include_router(events.router,  prefix="/events",  tags=["events"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(invitations.router, prefix="/invitations", tags=["invitations"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
