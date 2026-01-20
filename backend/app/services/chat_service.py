from typing import List
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage, HumanMessage
import os

def update_instructions(user_message: str, instructions: List[str]) -> List[str]:
        print(f"Updating instructions with user message: {user_message}", flush=True)

        class InstructionsResponse(BaseModel):
            instructions: List[str] = Field(
                description="List of instruction strings extracted from the user message"
            )

        from langchain.chat_models import init_chat_model
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

        print(f"Old instructions: {instructions}", flush=True)
        print(f"New instructions: {response.instructions}", flush=True)

        return response.instructions