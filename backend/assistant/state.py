from pydantic import BaseModel
from typing import Annotated
from langgraph.graph.message import add_messages
from assistant.models.chat import ChatMessage
from typing import Optional, List

def chat_history_reducer(curr_history: List[ChatMessage], new_chat: ChatMessage) -> List[ChatMessage]:
    return [*curr_history, new_chat]

class State(BaseModel):
    # LangGraph-managed conversation (for LLM)
    messages: Annotated[list, add_messages]

    # Metadata - use simple types, not SQLAlchemy models
    conversation_id: Optional[int] = None
    user_id: Optional[int] = None

    # User profile data
    user_data: Optional[dict] = None

    # Optional: database history (or load this IN a node instead)
    chat_history: Annotated[List[ChatMessage], lambda curr_history, new_chats: curr_history + new_chats] = []

    # Summary of the first message in the conversation
    conversation_title: Optional[str] = "New Chat"