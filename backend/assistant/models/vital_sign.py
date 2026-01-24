from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VitalSign(BaseModel):
    """User's vital signs tracking (BP, heart rate, weight, etc.)"""

    id: Optional[int] = None
    user_id: Optional[int] = None

    # Vital measurements
    systolic_bp: Optional[int] = None  # mmHg
    diastolic_bp: Optional[int] = None  # mmHg
    heart_rate: Optional[int] = None  # bpm
    weight: Optional[int] = None  # lbs
    temperature: Optional[float] = None  # Fahrenheit

    # Optional metadata
    notes: Optional[str] = None

    recorded_at: Optional[datetime] = None

    class Config:
        from_attributes = True
