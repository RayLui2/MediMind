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
    topic_category: Literal[
        "medication", "symptom", "condition", "mental_health", "lifestyle", "other", "unclassified"
    ] = Field(
        description="Broad category of the message — 'medication': dosages, side effects, interactions, missed doses, supplements; 'symptom': something the user is feeling or experiencing now; 'condition': existing diagnoses, chronic disease management, lab results; 'mental_health': mood, anxiety, mental wellbeing; 'lifestyle': diet, exercise, sleep, stress, prevention; 'other': anything else, including off-topic messages. Never use 'unclassified' — it is reserved for system errors."
    )
    mentioned_medications: list[str] = Field(
        default_factory=list,
        description="Prescription drugs, over-the-counter medicines, or supplements explicitly named in the user's message (e.g. ['ibuprofen', 'fish oil']). Empty list if none are named."
    )
