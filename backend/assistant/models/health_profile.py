from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class HealthProfile(BaseModel):
    """User's core health information and medical history"""

    id: Optional[int] = None
    user_id: Optional[int] = None

    # Physical metrics
    current_weight: Optional[int] = None  # in lbs
    height: Optional[int] = None  # in inches
    blood_type: Optional[str] = None
    activity_level: Optional[str] = None  # sedentary, lightly_active, moderately_active, very_active, extremely_active

    # Medical information
    current_conditions: List[str] = []  # ["Hypertension", "Type 2 Diabetes"]
    allergies: List[str] = []  # ["Penicillin", "Peanuts"]
    family_history: List[str] = []  # ["Heart Disease", "Diabetes"]

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
