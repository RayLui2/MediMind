from pydantic import BaseModel, Field
from typing import Optional

class Medication(BaseModel):
    """User's medication tracking"""

    id: Optional[int] = Field(default=None, description="Database record ID")
    user_id: Optional[int] = Field(default=None, description="ID of the user taking this medication")

    name: Optional[str] = Field(default=None, description="Medication name, e.g. 'Metformin', 'Warfarin', 'Lisinopril'")
    frequency: Optional[str] = Field(default=None, description="How often taken, e.g. 'once daily', 'twice daily', 'every 8 hours'")
    time: Optional[str] = Field(default=None, description="Preferred time of day to take this medication, e.g. 'morning', 'with dinner'")
    notes: Optional[str] = Field(default=None, description="Additional instructions or notes, e.g. 'take with food', 'avoid grapefruit'")
    is_active: Optional[bool] = Field(default=None, description="Whether this medication is currently being taken")