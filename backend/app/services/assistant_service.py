# Standard library
import asyncio
import os
from typing import AsyncGenerator, Dict, Any, List, Optional

# Third-party
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

# Local
from assistant.state import State
from assistant.system_prompt import system_prompt
from assistant.chat import assistant_graph, create_assistant_graph, compile_graph
from assistant.nodes.chatbot import get_streaming_queue, cleanup_streaming_queue
from app.models.conversations import Conversation
from app.models.message import Message
from app.models.medication import Medication
from app.models.health_profile import HealthProfile as HealthProfileDB
from app.models.vital_sign import VitalSign as VitalSignDB
from app.models.recommendations import Recommendation, RecommendationsResponse
from app.models.user import User
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign

load_dotenv()


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

        # Add system prompt with instructions
        system_content = system_prompt
        if instructions:
            system_content = f"{system_prompt}\nUser instructions:\n{instructions}"
        messages.append(SystemMessage(content=system_content))

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
            conversation_title=conversation.title or "New Chat",
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
        Stream chat response tokens using LangGraph's astream_events.

        This method:
        1. Initializes State with user data and conversation context
        2. Invokes the LangGraph with astream_events for token-level streaming
        3. Captures streaming tokens from the chatbot node's LLM calls
        4. Also captures the conversation title from the summarizer node

        Args:
            user_message: The user's message content
            conversation: The conversation object

        Yields:
            Dict events: chunk (tokens), title (from summarizer), or complete
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

        # Config for the graph invocation
        config = {"configurable": {"thread_id": f"conversation_{conversation.id}"}}

        full_response = ""
        new_title = None
        conversation_id = str(conversation.id)

        # Get the streaming queue for this conversation
        queue = get_streaming_queue(conversation_id)

        try:
            # Create a task to run the graph in the background
            async def run_graph():
                nonlocal new_title
                async for event in self._graph.astream_events(state_dict, config=config, version="v2"):
                    event_type = event.get("event")
                    event_name = event.get("name", "")

                    # Capture the conversation title from summarizer node output
                    if event_type == "on_chain_end" and "summarizer" in event_name.lower():
                        output = event.get("data", {}).get("output", {})
                        if isinstance(output, dict) and output.get("conversation_title"):
                            title = output["conversation_title"]
                            if title and title != "New Chat":
                                new_title = title
                                await queue.put({"type": "title", "title": new_title})

            # Start the graph execution in background
            graph_task = asyncio.create_task(run_graph())

            # Read streaming tokens from the queue
            streaming_done = False
            while not streaming_done:
                try:
                    # Wait for tokens with a timeout
                    item = await asyncio.wait_for(queue.get(), timeout=60.0)

                    if item["type"] == "token":
                        token = item["text"]
                        full_response += token
                        yield {"type": "chunk", "text": token}
                        await asyncio.sleep(0)
                    elif item["type"] == "title":
                        yield {"type": "title", "title": item["title"]}
                    elif item["type"] == "end":
                        streaming_done = True

                except asyncio.TimeoutError:
                    # Timeout waiting for tokens, check if graph is done
                    if graph_task.done():
                        streaming_done = True
                    else:
                        yield {"type": "error", "message": "Streaming timeout"}
                        return

            # Wait for the graph task to complete
            await graph_task

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield {"type": "error", "message": str(e)}
            return
        finally:
            # Clean up the streaming queue
            cleanup_streaming_queue(conversation_id)

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
            "chat_history": state.chat_history,
            "health_profile": state.health_profile.model_dump() if state.health_profile else None,
            "vital_signs": state.vital_signs.model_dump() if state.vital_signs else None,
        }

        config = {"configurable": {"thread_id": f"conversation_{conversation.id}"}}

        # Invoke the graph (runs all nodes)
        result = await self._graph.ainvoke(state_dict, config=config)

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
