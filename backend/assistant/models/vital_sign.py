from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class VitalSign(BaseModel):
    """User's vital signs recording"""

    id: Optional[int] = Field(default=None, description="Database record ID")
    user_id: Optional[int] = Field(default=None, description="ID of the user this reading belongs to")

    # Vital measurements
    systolic_bp: Optional[int] = Field(default=None, description="Systolic blood pressure in mmHg (top number), e.g. 120")
    diastolic_bp: Optional[int] = Field(default=None, description="Diastolic blood pressure in mmHg (bottom number), e.g. 80")
    heart_rate: Optional[int] = Field(default=None, description="Heart rate in beats per minute (bpm), e.g. 72")
    weight: Optional[int] = Field(default=None, description="Weight in pounds at time of recording")
    temperature: Optional[float] = Field(default=None, description="Body temperature in Fahrenheit, normal range 97–99°F")

    # Optional metadata
    notes: Optional[str] = Field(default=None, description="Optional clinical notes about this reading")

    recorded_at: Optional[datetime] = Field(default=None, description="Date and time this reading was recorded")

    class Config:
        from_attributes = True
