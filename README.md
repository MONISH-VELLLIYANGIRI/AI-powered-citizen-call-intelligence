# AI-Powered Citizen Call Intelligence Platform

> Hexaware Premier League — Mavericks Hackathon, Track 2

An agentic AI platform that processes citizen complaints through a multi-node LangGraph pipeline: transcription → triage → classification → duplicate detection → department routing → summarization. Features full reasoning trace transparency, officer dashboard, admin analytics, and citizen self-service portal.

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env   # Fill in your API key
cd app
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Architecture
- **Backend**: FastAPI + SQLAlchemy + LangGraph
- **AI Pipeline**: 7-node agentic graph with conditional edges
- **Duplicate Detection**: Local sentence-transformers embeddings
- **Frontend**: React + Vite + Recharts
- **LLM Provider**: Navigate Labs AI (OpenAI SDK-compatible)
