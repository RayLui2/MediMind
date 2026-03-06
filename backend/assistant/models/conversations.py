from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Conversation(BaseModel):
    """A chat conversation session between user and assistant"""

    id: Optional[int] = Field(default=None, description="Database record ID")
    user_id: Optional[int] = Field(default=None, description="ID of the user this conversation belongs to")
    title: Optional[str] = Field(default="New Chat", description="Short descriptive title generated from the first message, e.g. 'Headache questions', 'Medication side effects'")
    instructions: List[str] = Field(default=[], description="Custom behavior instructions set by the user for this conversation, e.g. 'be concise', 'use bullet points'")
    created_at: Optional[datetime] = Field(default=None, description="When this conversation was created")
    updated_at: Optional[datetime] = Field(default=None, description="When this conversation was last updated")

    class Config:
        from_attributes = True
