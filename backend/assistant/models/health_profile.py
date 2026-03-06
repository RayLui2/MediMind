from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class HealthProfile(BaseModel):
    """User's core health information and medical history"""

    id: Optional[int] = Field(default=None, description="Database record ID")
    user_id: Optional[int] = Field(default=None, description="ID of the user this profile belongs to")

    # Physical metrics
    current_weight: Optional[int] = Field(default=None, description="User's current weight in pounds")
    height: Optional[int] = Field(default=None, description="User's height in total inches, e.g. 72 = 6 feet tall")
    blood_type: Optional[str] = Field(default=None, description="ABO blood type, e.g. 'A+', 'O-', 'B+'")
    activity_level: Optional[str] = Field(default=None, description="One of: sedentary, lightly_active, moderately_active, very_active, extremely_active")

    # Medical information
    current_conditions: List[str] = Field(default=[], description="Active diagnosed medical conditions, e.g. ['Hypertension', 'Type 2 Diabetes']")
    allergies: List[str] = Field(default=[], description="Known allergies to medications, foods, or substances, e.g. ['Penicillin', 'Peanuts']")
    family_history: List[str] = Field(default=[], description="Relevant family medical history, e.g. ['Heart Disease', 'Diabetes']")

    created_at: Optional[datetime] = Field(default=None, description="When this profile was created")
    updated_at: Optional[datetime] = Field(default=None, description="When this profile was last updated")

    class Config:
        from_attributes = True
