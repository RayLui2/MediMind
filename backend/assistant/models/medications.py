from pydantic import BaseModel
from typing import Optional

class Medication(BaseModel):
    """User's medication tracking"""

    id: Optional[int] = None
    user_id: Optional[int] = None

    name: Optional[str] = None
    frequency: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None