import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

# Navigate Labs AI config
NAVIGATE_BASE_URL = os.environ.get("NAVIGATE_BASE_URL", "https://apidev.navigatelabsai.com/v1")
NAVIGATE_API_KEY = os.environ.get("NAVIGATE_API_KEY", "")
NAVIGATE_LLM_MODEL = os.environ.get("NAVIGATE_LLM_MODEL", "gemini-2.5-flash")
NAVIGATE_STT_MODEL = os.environ.get("NAVIGATE_STT_MODEL", "whisper-1")
NAVIGATE_TTS_MODEL = os.environ.get("NAVIGATE_TTS_MODEL", "gpt-4o-mini-tts")

# Database
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{_project_root / 'complaints.db'}")

# App
# App
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

# Add production frontend URL if available
FRONTEND_URL = os.environ.get("FRONTEND_URL")

if FRONTEND_URL:
    CORS_ORIGINS.append(FRONTEND_URL)
