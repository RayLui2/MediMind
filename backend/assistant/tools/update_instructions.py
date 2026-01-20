import json
from langchain.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.types import Command
from typing import Annotated
from langchain_core.tools.base import InjectedToolCallId
from assistant.state import State
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model
import os

class UpdateInstructionsTool(BaseModel):
    instructions: dict = Field(description="The instructions to update")

@tool(args_schema=UpdateInstructionsTool)
def update_instructions(
    tool_call_id: Annotated[str, InjectedToolCallId],
    state: State,
) -> Command:
    """Update the user instructions"""

    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.0,
    )

    prompt = f"""
find instructions in the user prompt, and return a json object with the instructions.

Example:
user prompt: "I want the answer in bullet point format, and in a concise manner"

Return: {{"instructions": {{"bullet_points": true, "concise": true}}}}
    """
    response = llm.invoke([
        HumanMessage(content=state.messages[-1].content),
        SystemMessage(content=prompt),
    ])
    instructions = response.content.strip()
    instructions = json.loads(instructions)["instructions"]

    print(f"Instructions: {instructions}")

    return Command(
        update = {
            "user_instructions": instructions
        }
    )