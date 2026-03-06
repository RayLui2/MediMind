# Standard library
import os

# Third-party
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, SystemMessage

# Local
from assistant.state import State
from assistant.models.critic import CriticResult

load_dotenv()

def generate_system_prompt(retrieved_context: str | None, triage_result) -> str:
    context_section = f"\nUser health context:\n{retrieved_context}" if retrieved_context else ""

    strictness = {
        "emergency": "Be very strict. The response MUST lead with emergency guidance (call 911 or go to the ER immediately) before anything else.",
        "clinical":  "Be strict. The response must recommend professional evaluation and flag any conflicts with the user's health context.",
        "general":   "Be moderate. Check for obvious safety issues and contraindications only.",
        "off_topic": "Be lenient. Only flag clear misinformation or harmful advice.",
    }.get(triage_result.severity if triage_result else "", "Be moderate. Check for obvious safety issues only.")

    return f"""You are a medical safety reviewer for an AI health assistant.
Your job is to evaluate the assistant's draft response for safety and accuracy given the user's specific health profile.

Strictness level: {strictness}

Check for the following:
1. SAFETY — Does the response recommend seeking professional care where the severity warrants it?
2. CONTRAINDICATIONS — Does the response suggest anything that conflicts with the user's known conditions, medications, or allergies?
3. EMERGENCY ESCALATION — If the topic is urgent, does the response lead with appropriate emergency guidance (call 911, go to ER)?
4. COMPLETENESS — Does the response actually address the user's question?
{context_section}

If the response passes all checks, approve it.
If you find a problem, reject it with a one-sentence critique describing exactly what needs to be fixed."""

def create_critic_node():
    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.2,
        streaming=False,
    )

    structured_llm = llm.with_structured_output(CriticResult)

    async def critic_node(state: State):
        if state.revision_count >= 2:
            return {"critic_approved": True}

        draft_response = state.draft_response
        if not draft_response:
            return {
                "critic_approved": False,
                "critique": "No response was generated. Please provide a response to the user's question.",
                "revision_count": state.revision_count + 1
            }

        triage_result = state.triage_result
        retrieved_context = state.retrieved_context

        system_prompt = generate_system_prompt(retrieved_context, triage_result)

        response = await structured_llm.ainvoke([
            SystemMessage(content=system_prompt),
            AIMessage(content=draft_response)
        ])

        print(f"approved: {response.approved}, critique: {response.critique}, revision_count: {state.revision_count + 1}")
        return {"critic_approved": response.approved, "critique": response.critique, "revision_count": state.revision_count + 1}

    return critic_node