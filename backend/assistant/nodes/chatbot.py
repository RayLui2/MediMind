# Third-party
from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage

# Local
from assistant.llm import get_llm
from assistant.prompts.chatbot_prompt import chatbot_prompt
from assistant.state import State


class llmResponseStructure(BaseModel):
    content: str = Field(description="The full text content of the message")


def generate_system_prompt(state: State) -> str:
    prompt = chatbot_prompt

    if state.user_instructions:
        prompt += f"\n\n##User Instructions: {state.user_instructions}"

    if state.triage_result:
        triage = state.triage_result
        prompt += f"\n\n## Triage\n- **Severity**: {triage.severity}\n- **Topic**: {triage.topic}"

        if triage.severity == "emergency":
            prompt += "\n\nIMPORTANT: This is an emergency. Lead your response by directing the user to call 911 or go to the ER immediately."
        elif triage.severity == "clinical":
            prompt += "\n\nThis requires professional medical evaluation. Recommend seeing a doctor promptly."
        elif triage.severity == "off_topic":
            prompt += "\n\nThis message is not health-related. Politely redirect the user to health topics."

    if state.retrieved_context:
        prompt += f"\n\n## Retrieved Context\n{state.retrieved_context}"

    if state.draft_response:
        prompt += f"\n\n## Draft Response\n{state.draft_response}"

    if state.critique:
        prompt += f"\n\n## Critique\nRevise your response addressing the following critique:\n{state.critique}"

    return prompt


def create_chatbot_node():
    llm = get_llm(temperature=0.2, streaming=True)

    structured_llm = llm.with_structured_output(llmResponseStructure)

    async def chatbot_node(state: State):
        messages = [SystemMessage(content=generate_system_prompt(state))] + list(state.messages)

        response = await structured_llm.ainvoke(messages)

        return {
            "draft_response": response.content
        }

    return chatbot_node
