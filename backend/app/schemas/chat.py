from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MessageCreate(BaseModel):
    """Request to send a message"""
    content: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "content": "I have a headache, what should I do?"
            }
        }


class MessageResponse(BaseModel):
    """Response for a single message"""
    id: int
    conversation_id: int
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    """Request to create a new conversation"""
    title: Optional[str] = "New Chat"


class ConversationResponse(BaseModel):
    """Response for a conversation"""
    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationWithMessages(BaseModel):
    """Conversation with all its messages"""
    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]
    
    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    """Response after sending a message"""
    user_message: MessageResponse
    assistant_message: MessageResponse
    conversation: ConversationResponse