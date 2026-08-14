"""
Local embedding-based duplicate detection using sentence-transformers.
No API call needed — runs entirely locally for demo reliability.
"""
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

# Load model once at module level (small, fast, ~80MB download)
_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> list:
    """Embed text into a float vector."""
    model = _get_model()
    return model.encode(text).tolist()


def cosine_sim(a: list, b: list) -> float:
    """Compute cosine similarity between two float vectors."""
    a_arr, b_arr = np.array(a), np.array(b)
    norm_a, norm_b = np.linalg.norm(a_arr), np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


def find_duplicate(
    transcript: str,
    category: str,
    db: Session,
    threshold: float = 0.85
) -> tuple:
    """
    Check if a transcript is a duplicate of an existing complaint.
    
    Returns: (is_duplicate, duplicate_id, confidence, embedding)
    """
    from app.models import Complaint

    # Embed the incoming transcript
    new_embedding = embed(transcript)

    # Fetch recent complaints in the same category (last 30 days)
    cutoff = datetime.utcnow() - timedelta(days=30)
    existing = db.query(Complaint).filter(
        Complaint.category == category,
        Complaint.created_at >= cutoff,
        Complaint.embedding.isnot(None),
    ).all()

    best_match_id = None
    best_score = 0.0

    for complaint in existing:
        try:
            existing_embedding = json.loads(complaint.embedding)
            score = cosine_sim(new_embedding, existing_embedding)
            if score > best_score:
                best_score = score
                best_match_id = complaint.id
        except (json.JSONDecodeError, TypeError):
            continue

    if best_score >= threshold and best_match_id is not None:
        return True, best_match_id, best_score, new_embedding
    
    return False, None, best_score, new_embedding
