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
        messages = list(state.messages)
        conversation_id = state.conversation_id
        retrieved_context = state.retrieved_context

        # Enhance last user message with user data and health context if available
        if len(messages) > 0 and isinstance(messages[-1], HumanMessage):
            original_content = messages[-1].content

            if retrieved_context:
                enhanced_content = HumanMessage(content=f"{retrieved_context}\n\nUser message:\n{original_content}")
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
