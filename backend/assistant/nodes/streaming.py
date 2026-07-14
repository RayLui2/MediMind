# Third-party
from langchain_core.messages import AIMessage

# Local
from assistant.state import State


def create_streaming_node():
    """
    The commit node: appends the approved draft_response as the final AIMessage.

    This is the single writer of the assistant message into `messages` per turn.
    Delivery (live token stream vs whole message) is the caller's decision, made
    by watching astream_events — no transport lives in the graph.
    """
    async def streaming_node(state: State):
        if not state.draft_response:
            return {}

        return {
            "messages": [AIMessage(content=state.draft_response)]
        }

    return streaming_node
