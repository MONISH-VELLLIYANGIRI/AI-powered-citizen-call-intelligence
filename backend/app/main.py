from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.db import create_tables

app = FastAPI(
    title="Citizen Call Intelligence Platform",
    description="AI-powered agentic pipeline for citizen complaint triage, classification, and routing",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def on_startup():
    create_tables()

# Routers
from app.routers import complaints, analytics, chatbot, citizen, officer  # noqa: E402
app.include_router(complaints.router, prefix="/api/complaints", tags=["Complaints"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])
app.include_router(citizen.router, prefix="/api/citizen", tags=["Citizen"])
app.include_router(officer.router, prefix="/api/officer", tags=["Officer"])


@app.get("/")
def root():
    return {"message": "Citizen Call Intelligence Platform API", "docs": "/docs"}
