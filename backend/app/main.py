from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.api.v1.api import api_router

app = FastAPI(title="Cattle Management System API", version="1.0.0")

# Allow the frontend (file:// OR local dev server) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Serve the frontend from /app/*
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs", "frontend": "/app"}