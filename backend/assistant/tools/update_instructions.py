# Standard library
import json
import os
from typing import Annotated, List

# Third-party
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools.base import InjectedToolCallId
from langgraph.types import Command
from pydantic import BaseModel, Field

# Local
from assistant.state import State

class UpdateInstructionsTool(BaseModel):
    instructions: dict = Field(description="The instructions to update")

@tool(args_schema=UpdateInstructionsTool)
def update_instructions(
    tool_call_id: Annotated[str, InjectedToolCallId],
    state: State,
    instructions: List[str]
) -> Command:
    """Update the user instructions"""

    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.0,
    )

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
    response = llm.invoke([
        HumanMessage(content=state.messages[-1].content),
        SystemMessage(content=prompt),
    ])
    
    return response.instructions