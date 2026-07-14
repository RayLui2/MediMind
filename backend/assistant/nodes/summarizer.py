# Standard library
import logging

# Third-party
from langchain_core.messages import HumanMessage

# Local
from assistant.llm import get_llm
from assistant.state import State

logger = logging.getLogger(__name__)

def create_summarizer_node():
    """Create a node that generates a concise title from the first message"""

    llm = get_llm(temperature=0.3)

    async def summarizer_node(state: State):
        # Only summarize if there's no title yet (None means "not yet titled")
        if state.conversation_title:
            return {"conversation_title": state.conversation_title}

        # Get the first user message
        messages = state.messages
        first_user_msg = None
        for msg in messages:
            if isinstance(msg, HumanMessage):
                first_user_msg = msg.content
                break

        if not first_user_msg:
            return {"conversation_title": None}

        # Create summarization prompt
        prompt = f"""Generate a concise, descriptive title (max 6 words) with an emoji at the end of the title. The title should be a single sentence and should be descriptive of the conversation:

Return only the title with the emoji at the end, nothing else.

Example:
Title: "Headache questions 🤔"
Title: "Pain in the left side of my head 😣"
Title: "I have a headache 🤒"
Title: "I have a headache 🤒"

User's first message: "{first_user_msg}"
"""

        # Get summary from LLM (use ainvoke for async)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        conversation_title = response.content.strip()

        logger.info(f"Conversation title: {conversation_title}")
        return {"conversation_title": conversation_title}

    return summarizer_node