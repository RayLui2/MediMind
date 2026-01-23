from sqlalchemy import JSON, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from pydantic import BaseModel, Field

class Conversation(BaseModel):
    """
    Represents a chat conversation/session.
    Each user can have multiple conversations.
    """

    title = Field(String, default="New Chat")  # e.g. "Headache questions"
    instructions = Field(JSON, default=list)  # List of instructions for the conversation
    created_at = Field(DateTime(timezone=True), server_default=func.now())
    updated_at = Field(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to User
    user = relationship("User", back_populates="conversations")
    # Relationship to messages
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")