# Standard library
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional

# Third-party
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

# Local
from assistant.state import State
from assistant.graph import assistant_graph
from app.models.conversations import Conversation
from app.models.message import Message
from app.models.medication import Medication
from app.models.health_profile import HealthProfile as HealthProfileDB
from app.models.vital_sign import VitalSign as VitalSignDB
from app.models.recommendations import Recommendation, RecommendationsResponse
from app.models.user import User
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign

logger = logging.getLogger(__name__)


class AssistantService:
    """
    Service wrapper for LangGraph assistant operations.

    This service properly invokes the LangGraph for all AI operations:
    - Chat streaming via astream_events() for token-level streaming
    - Recommendations via graph invocation
    - Title generation via summarizer node in graph
    """

    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self._graph = assistant_graph  # Use the compiled graph

    def _initialize_state(
        self,
        conversation: Conversation,
        user_message: str,
        include_health_data: bool = False
    ) -> State:
        """
        Initialize LangGraph State with user data and conversation context.

        Args:
            conversation: The conversation object
            user_message: The current user message
            include_health_data: Whether to include health profile and vital signs

        Returns:
            Initialized State object
        """
        # Build user data dict
        user_data = {
            "name": self.user.name,
            "age": self.user.age
        } if self.user.name or self.user.age else None

        # Load message history from DB
        db_messages = self.db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.desc()).limit(10).all()
        db_messages = list(reversed(db_messages))

        # Build LangChain messages
        messages = []
        instructions = conversation.instructions or []

        # Add conversation history (excluding current message)
        for msg in db_messages:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))

        # Add user's medications
        medications = self.db.query(Medication).filter(Medication.user_id == self.user.id).all()

        # Add current user message (will be enhanced by chatbot node if user_data exists)
        messages.append(HumanMessage(content=user_message))

        # Initialize state
        state = State(
            messages=messages,
            conversation_id=conversation.id,
            user_id=self.user.id,
            user_data=user_data,
            user_instructions={"instructions": instructions},
            conversation_title=conversation.title,
            medications=medications
        )

        # Optionally load health data
        if include_health_data:
            state = self._add_health_data_to_state(state)

        return state

    def _add_health_data_to_state(self, state: State) -> State:
        """Add health profile and vital signs to state"""
        # Get health profile
        db_health_profile = self.db.query(HealthProfileDB).filter(
            HealthProfileDB.user_id == self.user.id
        ).first()

        # Get latest vital signs
        db_vital_signs = self.db.query(VitalSignDB).filter(
            VitalSignDB.user_id == self.user.id
        ).order_by(VitalSignDB.recorded_at.desc()).first()

        # Convert to Pydantic models
        if db_health_profile:
            state.health_profile = HealthProfile.model_validate(db_health_profile)
        if db_vital_signs:
            state.vital_signs = VitalSign.model_validate(db_vital_signs)

        return state

    async def stream_chat(
        self,
        user_message: str,
        conversation: Conversation
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream the chat response by consuming the graph's astream_events run.

        Delivery policy: triage's critic_approved flag — set only for
        general/off_topic, where the critic is bypassed — decides the mode for
        the turn. Live mode forwards the chatbot's tokens as they are generated;
        buffered mode (clinical/emergency, critic in the loop) sends the whole
        approved answer as a single chunk after the commit ("streaming") node
        runs. Nothing goes on the wire that the critic could still veto.

        Args:
            user_message: The user's message content
            conversation: The conversation object

        Yields:
            Dict events: chunk (token or whole message), title (from summarizer),
            error, then complete (carrying the canonical full_response)
        """
        # Initialize state with conversation context and health data
        state = self._initialize_state(conversation, user_message, include_health_data=True)

        # Convert state to dict for graph input
        state_dict = {
            "messages": state.messages,
            "conversation_id": state.conversation_id,
            "user_id": state.user_id,
            "user_data": state.user_data,
            "user_instructions": state.user_instructions,
            "conversation_title": state.conversation_title,
            "health_profile": state.health_profile.model_dump() if state.health_profile else None,
            "vital_signs": state.vital_signs.model_dump() if state.vital_signs else None,
            "medications": [m.model_dump() for m in state.medications] if state.medications else None,
        }

        live = False          # decided the moment triage finishes
        full_response = ""    # canonical text comes from the commit node, not the wire
        new_title = None

        try:
            async for event in self._graph.astream_events(state_dict, version="v2"):
                kind = event.get("event")
                name = event.get("name", "")
                node = event.get("metadata", {}).get("langgraph_node", "")

                # Triage decides the delivery mode for this turn:
                # critic_approved=True is only set for general/off_topic.
                if kind == "on_chain_end" and name == "triage":
                    output = event.get("data", {}).get("output") or {}
                    if isinstance(output, dict):
                        live = bool(output.get("critic_approved"))

                # Live path: forward chatbot tokens as they are generated.
                # The langgraph_node filter keeps triage/critic/summarizer
                # function-call fragments out of the user's chat window.
                elif kind == "on_chat_model_stream" and node == "chatbot" and live:
                    chunk = event.get("data", {}).get("chunk")
                    if chunk is not None and isinstance(chunk.content, str) and chunk.content:
                        yield {"type": "chunk", "text": chunk.content}

                # Conversation title from the summarizer (runs in parallel).
                elif kind == "on_chain_end" and name == "summarizer":
                    output = event.get("data", {}).get("output") or {}
                    if isinstance(output, dict) and output.get("conversation_title"):
                        new_title = output["conversation_title"]
                        yield {"type": "title", "title": new_title}

                # Commit node finished: the one true final text.
                # Buffered path: the whole answer goes out here, as one chunk.
                # Live path: tokens already went out; just record the canonical text.
                elif kind == "on_chain_end" and name == "streaming":
                    output = event.get("data", {}).get("output") or {}
                    msgs = output.get("messages") if isinstance(output, dict) else None
                    if msgs:
                        full_response = msgs[-1].content
                        if not live:
                            yield {"type": "chunk", "text": full_response}

        except Exception as e:
            logger.exception("stream_chat failed")
            yield {"type": "error", "message": str(e)}
            return

        # Return the complete response and any title update
        yield {
            "type": "complete",
            "full_response": full_response,
            "conversation_title": new_title
        }

    async def invoke_graph(
        self,
        user_message: str,
        conversation: Conversation
    ) -> Dict[str, Any]:
        """
        Invoke the full LangGraph without streaming (for non-streaming use cases).

        Args:
            user_message: The user's message content
            conversation: The conversation object

        Returns:
            Dict with response content and metadata
        """
        state = self._initialize_state(conversation, user_message)

        state_dict = {
            "messages": state.messages,
            "conversation_id": state.conversation_id,
            "user_id": state.user_id,
            "user_data": state.user_data,
            "user_instructions": state.user_instructions,
            "conversation_title": state.conversation_title,
            "health_profile": state.health_profile.model_dump() if state.health_profile else None,
            "vital_signs": state.vital_signs.model_dump() if state.vital_signs else None,
        }

        # Invoke the graph (runs all nodes)
        result = await self._graph.ainvoke(state_dict)

        # Extract the AI response from messages
        ai_response = ""
        for msg in reversed(result.get("messages", [])):
            if isinstance(msg, AIMessage):
                ai_response = msg.content
                break

        return {
            "response": ai_response,
            "conversation_title": result.get("conversation_title"),
            "instructions": result.get("user_instructions", {}).get("instructions", [])
        }

    def generate_recommendations(self) -> List[Recommendation]:
        """
        Generate personalized health recommendations using LangGraph.

        This invokes a dedicated recommendations graph with health data in state.
        The graph is created with the current DB session for persistence.

        Returns:
            List of generated Recommendation objects
        """
        from assistant.graphs.recommendations import create_recommendations_graph

        # Create state with health data
        state = State(
            messages=[],
            user_id=self.user.id
        )
        state = self._add_health_data_to_state(state)

        # Create the graph with DB session
        recommendations_graph = create_recommendations_graph(self.db)

        # Prepare state dict for graph input
        state_dict = {
            "user_id": self.user.id,
            "health_profile": state.health_profile,
            "vital_signs": state.vital_signs,
        }

        # Invoke recommendations graph
        recommendations_graph.invoke(state_dict)

        # Fetch the newly created recommendations from DB
        recommendations = self.db.query(Recommendation).filter(
            Recommendation.user_id == self.user.id
        ).order_by(Recommendation.created_at.desc()).all()

        return recommendations


def get_assistant_service(db: Session, user: User) -> AssistantService:
    """Factory function to create AssistantService instance"""
    return AssistantService(db, user)
