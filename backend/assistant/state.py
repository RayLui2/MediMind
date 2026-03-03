from pydantic import BaseModel
from typing import Annotated
from langgraph.graph.message import add_messages
from typing import Optional, List

# Local
from assistant.models.chat import ChatMessage
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign
from assistant.models.medications import Medication
from assistant.models.triage import TriageResult

def chat_history_reducer(curr_history: List[ChatMessage], new_chat: ChatMessage) -> List[ChatMessage]:
    return [*curr_history, new_chat]

class State(BaseModel):
    # LangGraph-managed conversation (for LLM)
    messages: Annotated[list, add_messages]

    # Metadata - use simple types, not SQLAlchemy models
    conversation_id: Optional[int] = None
    user_id: Optional[int] = None

    # User profile data
    user_data: Optional[dict] = None # Change it from Optional[dict] to Optional[User] using the User basemodel in assistant/models/user.py

    # persistent user rules for the assistant
    user_instructions: Optional[dict] = None   # e.g. {instructions: {"bullet_points", "concise"}}

    # Optional: database history (or load this IN a node instead)
    chat_history: Annotated[
        List[ChatMessage],
        lambda curr_history, new_chats: curr_history + new_chats
    ] = []

    # Summary of the first message in the conversation
    conversation_title: Optional[str] = "New Chat"

    # Optional: health profile about the user
    health_profile: Optional[HealthProfile] = None

    # Optional: vital signs of the user
    vital_signs: Optional[VitalSign] = None

    # Optional: user's medications
    medications: Optional[list[Medication]] = None

    # Optional: triage result of last message
    triage_result: Optional[TriageResult] = None