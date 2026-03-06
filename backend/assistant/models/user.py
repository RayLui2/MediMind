from pydantic import BaseModel, Field
from typing import Optional


class User(BaseModel):
    """User account information"""

    id: Optional[int] = Field(default=None, description="Database record ID")
    name: Optional[str] = Field(default=None, description="User's full name")
    age: Optional[int] = Field(default=None, description="User's age in years")
