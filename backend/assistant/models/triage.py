from pydantic import BaseModel
from typing import Literal


class TriageResult(BaseModel):
    """Triage result for the user's query"""
    severity: Literal["emergency", "clinical", "general", "off_topic"]
    topic: str  # e.g. "chest pain", "medication dosage", "diet advice"