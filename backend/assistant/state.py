from pydantic import BaseModel
from typing import Annotated
from langgraph.graph.message import add_messages
from typing import Optional

# Local
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign
from assistant.models.medications import Medication
from assistant.models.triage import TriageResult

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

    # Summary of the first message in the conversation
    conversation_title: Optional[str] = None

    # Optional: health profile about the user
    health_profile: Optional[HealthProfile] = None

    # Optional: vital signs of the user
    vital_signs: Optional[VitalSign] = None

    # Optional: user's medications
    medications: Optional[list[Medication]] = None

    # Optional: triage result and retrieved context
    triage_result: Optional[TriageResult] = None
    retrieved_context: Optional[str] = None  # drug info, condition facts, etc.

    # Optional: draft response of the chatbot
    draft_response: Optional[str] = None

    # Critic approval of draft
    critic_approved: bool = False

    # Optional: critique message from the critic node about the draft response if the response is critical
    critique: Optional[str] = None

    # Optional: revision count of the response
    revision_count: int = 0