# Standard library
import asyncio
from typing import Dict

# Third-party
from langchain_core.messages import AIMessage

# Local
from assistant.state import State

# Global queue for streaming tokens
# Single source of truth — imported by chatbot.py and assistant_service.py
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

def create_streaming_node():
    async def streaming_node(state: State):
        conversation_id = state.conversation_id
        # Get the streaming queue for this conversation
        conversation_id = str(conversation_id)
        queue = get_streaming_queue(conversation_id)
        
        draft_response = state.draft_response
        if not draft_response:
            await queue.put({"type": "end"})
            return {}

        # Stream tokens from LLM and push to queue
        for word in draft_response.split():
            await queue.put({"type": "token", "text": word + " "})
            await asyncio.sleep(0)  # yield control to the event loop

        # Signal end of streaming
        await queue.put({"type": "end"})

        response = AIMessage(content=draft_response)

        return {
            "messages": [response]
        }


    return streaming_node