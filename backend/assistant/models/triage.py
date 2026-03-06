from pydantic import BaseModel, Field
from typing import Literal


class TriageResult(BaseModel):
    """Triage classification for the user's health-related message"""
    severity: Literal["emergency", "clinical", "general", "off_topic"] = Field(
        description="Urgency level — 'emergency': requires 911/ER immediately; 'clinical': needs a doctor soon; 'general': wellness or lifestyle question, no urgency; 'off_topic': not health-related"
    )
    topic: str = Field(
        description="The medical topic in 2-5 words, e.g. 'chest pain', 'medication dosage', 'diet advice', 'sleep quality'"
    )