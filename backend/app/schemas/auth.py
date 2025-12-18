from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class SignUpRequest(BaseModel):
    """
    Request model for user signup.
    
    Frontend sends this when creating a new account.
    """

    email: EmailStr  # Validates email format automatically
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=1, le=150, description="Age must be between 1 and 150")

    class Config:
        json_schema_extra = {
            "example": {
                "email": "ray@medimind.com",
                "password": "mypassword123",
                "name": "Ray",
                "age": 25
            }
        }

class LoginRequest(BaseModel):
    """
    Request model for user login.
    
    Frontend sends this when logging in.
    """

    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "ray@medimind.com",
                "password": "mypassword123"
            }
        }

class Token(BaseModel):
    """
    Response model for successful login.
    
    Backend sends this after successful authentication.
    """
    access_token: str
    token_type: str = "bearer"
    
    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
        
