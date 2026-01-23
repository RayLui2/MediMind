# Standard library
import os
from typing import List

# Third-party
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

# Local
from assistant.state import State

def update_instructions(user_message: str, instructions: List[str]) -> List[str]:
        class InstructionsResponse(BaseModel):
            instructions: List[str] = Field(
                description="List of instruction strings extracted from the user message"
            )

        llm = init_chat_model(
            os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            model_provider="google_genai",
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.0,
        )

        structured_llm = llm.with_structured_output(InstructionsResponse)

        prompt = f"""
Current instructions: {instructions}

Analyze the user's message and extract any instructions about how they want responses formatted or delivered.
Update the full list (add new instructions, remove ones that are no longer needed).

Examples of instructions:
- "bullet_points" (user wants bullet point format)
- "concise" (user wants brief responses)
- "detailed" (user wants detailed explanations)
- "step_by_step" (user wants step-by-step guidance)

Return an empty list if no instructions are found.
"""
        response = structured_llm.invoke([
            SystemMessage(content=prompt),
            HumanMessage(content=user_message),
        ])

        return response.instructions

def create_summarizer_node():
    """Create a node that generates a concise title from the first message"""
    
    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.3,
    )
    
    def summarizer_node(state: State):
        # Only summarize if there's no summary yet
        if state.conversation_title != "New Chat":
            return {"conversation_title": state.conversation_title}

        # Get the first user message
        messages = state.messages
        first_user_msg = None
        for msg in messages:
            if isinstance(msg, HumanMessage):
                first_user_msg = msg.content
                break

        if not first_user_msg:
            return {"conversation_title": "New Chat"}
        
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
        
        # Get summary from LLM
        response = llm.invoke([HumanMessage(content=prompt)])
        conversation_title = response.content.strip()
        
        print(f"Conversation title: {conversation_title}")
        return {"conversation_title": conversation_title}
    
    return summarizer_node