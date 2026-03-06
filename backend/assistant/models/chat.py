from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(description="Message sender: 'user' for the patient, 'assistant' for the AI")
    content: str = Field(description="The full text content of the message")