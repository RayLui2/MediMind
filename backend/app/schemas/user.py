from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserResponse(BaseModel):
    """
    Response model for user data.
    
    Backend sends this when returning user information.
    Does not include password_hash
    """
     
    id: int
    email: EmailStr
    name: Optional[str] = None
    age: Optional[int] = None
    created_at: datetime
    setup_completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Allows converting SQLAlchemy models to Pydantic
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "ray@medimind.com",
                "name": "Ray",
                "age": 25,
                "created_at": "2024-12-16T10:30:00"
            }
    }