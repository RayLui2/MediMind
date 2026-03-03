# Standard library
import os
import asyncio
from typing import Dict

# Third-party
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, HumanMessage

# Local
from assistant.models.chat import ChatMessage
from assistant.state import State
from assistant.prompts.system_prompt import system_prompt

load_dotenv()

# Global queue for streaming tokens from the chatbot node
# This allows the service layer to receive tokens as they're generated
_streaming_queues: Dict[str, asyncio.Queue] = {}


def get_streaming_queue(conversation_id: str) -> asyncio.Queue:
    """Get or create a streaming queue for a conversation"""
    if conversation_id not in _streaming_queues:
        _streaming_queues[conversation_id] = asyncio.Queue()
    return _streaming_queues[conversation_id]


def cleanup_streaming_queue(conversation_id: str):
    """Remove the streaming queue after use"""
    if conversation_id in _streaming_queues:
        del _streaming_queues[conversation_id]


def _get_attr(obj, key, default=None):
    """Get attribute from either a dict or object."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def format_health_context(state: State) -> str:
    """
    Format health profile and vital signs into a readable context string.

    Args:
        state: LangGraph state containing health_profile and vital_signs

    Returns:
        Formatted string with health context, or empty string if no data
    """
    context_parts = []

    # Format health profile (handle both dict and model)
    hp = state.health_profile
    if hp:
        profile_lines = []

        # Physical metrics
        height = _get_attr(hp, 'height')
        if height:
            feet = height // 12
            inches = height % 12
            profile_lines.append(f"- Height: {feet}'{inches}\" ({height} inches)")

        weight = _get_attr(hp, 'current_weight')
        if weight:
            profile_lines.append(f"- Weight: {weight} lbs")

        blood_type = _get_attr(hp, 'blood_type')
        if blood_type:
            profile_lines.append(f"- Blood Type: {blood_type}")

        activity = _get_attr(hp, 'activity_level')
        if activity:
            profile_lines.append(f"- Activity Level: {activity.replace('_', ' ').title()}")

        # Medical information
        conditions = _get_attr(hp, 'current_conditions', [])
        if conditions:
            profile_lines.append(f"- Current Conditions: {', '.join(conditions)}")

        allergies = _get_attr(hp, 'allergies', [])
        if allergies:
            profile_lines.append(f"- Allergies: {', '.join(allergies)}")

        family_history = _get_attr(hp, 'family_history', [])
        if family_history:
            profile_lines.append(f"- Family History: {', '.join(family_history)}")

        if profile_lines:
            context_parts.append("Health Profile:\n" + "\n".join(profile_lines))

    # Format vital signs (handle both dict and model)
    vs = state.vital_signs
    if vs:
        vitals_lines = []

        systolic = _get_attr(vs, 'systolic_bp')
        diastolic = _get_attr(vs, 'diastolic_bp')
        if systolic and diastolic:
            vitals_lines.append(f"- Blood Pressure: {systolic}/{diastolic} mmHg")

        heart_rate = _get_attr(vs, 'heart_rate')
        if heart_rate:
            vitals_lines.append(f"- Heart Rate: {heart_rate} bpm")

        temp = _get_attr(vs, 'temperature')
        if temp:
            vitals_lines.append(f"- Temperature: {temp}°F")

        weight = _get_attr(vs, 'weight')
        if weight:
            vitals_lines.append(f"- Recent Weight: {weight} lbs")

        recorded_at = _get_attr(vs, 'recorded_at')
        if recorded_at:
            if hasattr(recorded_at, 'strftime'):
                vitals_lines.append(f"- Recorded: {recorded_at.strftime('%Y-%m-%d %H:%M')}")
            else:
                vitals_lines.append(f"- Recorded: {recorded_at}")

        if vitals_lines:
            context_parts.append("Recent Vitals:\n" + "\n".join(vitals_lines))

    return "\n\n".join(context_parts)


def create_chatbot_node():
    """
    Create a chatbot node that streams responses via a queue.

    This node uses astream to get tokens and pushes them to a queue,
    which the service layer reads from to send to the client.

    Returns:
        A node function compatible with LangGraph
    """

    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.2,
        streaming=True,
    )

    async def chatbot_node(state: State):
        """
        Process user message and generate AI response with streaming.

        This node:
        1. Enhances the user message with user data and health context if available
        2. Streams tokens to a queue for real-time delivery
        3. Returns the complete response for state management

        Args:
            state: Current LangGraph state with messages, user_data, and health info

        Returns:
            Dict with updated messages and chat_history
        """
        # Handle state as either State object or dict
        messages = list(_get_attr(state, 'messages', []))
        user_data = _get_attr(state, 'user_data')
        conversation_id = _get_attr(state, 'conversation_id')
        health_profile = _get_attr(state, 'health_profile')
        vital_signs = _get_attr(state, 'vital_signs')

        # Create a simple namespace for format_health_context
        class HealthState:
            pass
        health_state = HealthState()
        health_state.health_profile = health_profile
        health_state.vital_signs = vital_signs

        # Enhance last user message with user data and health context if available
        if len(messages) > 0 and isinstance(messages[-1], HumanMessage):
            original_content = messages[-1].content

            # Build context sections
            context_sections = []

            # Add basic user info
            if user_data:
                name = user_data.get('name', 'Unknown') if isinstance(user_data, dict) else getattr(user_data, 'name', 'Unknown')
                age = user_data.get('age', 'Unknown') if isinstance(user_data, dict) else getattr(user_data, 'age', 'Unknown')
                user_info = f"""User information:
- Name: {name}
- Age: {age}"""
                context_sections.append(user_info)

            # Add health context (profile + vitals)
            health_context = format_health_context(health_state)
            if health_context:
                context_sections.append(health_context)

            # Only enhance if we have some context to add
            if context_sections:
                full_context = "\n\n".join(context_sections)
                enhanced_content = HumanMessage(content=f"""{full_context}

User message:
{original_content}
""")
                messages[-1] = enhanced_content

        # Get the streaming queue for this conversation
        conversation_id = str(conversation_id)
        queue = get_streaming_queue(conversation_id)

        # Stream tokens from LLM and push to queue
        full_content = ""
        async for chunk in llm.astream(messages):
            if hasattr(chunk, 'content') and chunk.content:
                token = chunk.content
                full_content += token
                # Push each token to the queue for streaming
                await queue.put({"type": "token", "text": token})

        # Signal end of streaming
        await queue.put({"type": "end"})

        response = AIMessage(content=full_content)

        return {
            "messages": [response],
            "chat_history": [ChatMessage(role="assistant", content=response.content)]
        }

    return chatbot_node
