# Standard library
import logging
from typing import Optional

# Third-party
from langchain_core.messages import HumanMessage, SystemMessage

# Local
from assistant.llm import get_llm
from assistant.state import State
from assistant.models.critic import CriticResult

logger = logging.getLogger(__name__)

# Shipped instead of an emergency draft the critic never approved (LLM error or
# revision cap). A twice-rejected or unreviewed draft must not reach the user on
# an emergency turn — the safe floor is the 911 instruction itself.
EMERGENCY_FALLBACK_RESPONSE = (
    "**If this is a medical emergency, call 911 or go to the nearest emergency room now.**\n\n"
    "I'm having trouble generating a reliable answer to your question at the moment. "
    "Please don't wait on me — if you are experiencing severe or worsening symptoms, "
    "seek emergency care immediately. Otherwise, try asking again in a moment or "
    "contact a healthcare professional."
)

def generate_system_prompt(retrieved_context: Optional[str], triage_result) -> str:
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
    llm = get_llm(temperature=0.2, streaming=False)

    structured_llm = llm.with_structured_output(CriticResult)

    async def critic_node(state: State):
        severity = state.triage_result.severity if state.triage_result else None

        if state.revision_count >= 2:
            # Revision cap: the loop must exit, but an emergency draft the
            # critic still hasn't approved is not safe to auto-approve —
            # replace it with the fallback instead of shipping it.
            if severity == "emergency":
                logger.warning("revision cap hit on unapproved emergency draft — shipping fallback response")
                return {"critic_approved": True, "draft_response": EMERGENCY_FALLBACK_RESPONSE}
            return {"critic_approved": True}

        draft_response = state.draft_response
        if not draft_response:
            if state.revision_count + 1 >= 2 and severity == "emergency":
                # Rejecting here would hit the cap and ship an empty turn.
                logger.warning("no draft at revision cap on emergency turn — shipping fallback response")
                return {
                    "critic_approved": True,
                    "draft_response": EMERGENCY_FALLBACK_RESPONSE,
                    "revision_count": state.revision_count + 1
                }
            return {
                "critic_approved": False,
                "critique": "No response was generated. Please provide a response to the user's question.",
                "revision_count": state.revision_count + 1
            }

        triage_result = state.triage_result
        retrieved_context = state.retrieved_context

        user_message = next(
            (m.content for m in reversed(state.messages) if isinstance(m, HumanMessage)),
            ""
        )

        system_prompt = generate_system_prompt(retrieved_context, triage_result)

        try:
            response = await structured_llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=(
                f"User's question:\n{user_message}\n\n"
                f"Assistant's draft response:\n{draft_response}\n\n"
                "Evaluate the draft response above for safety and accuracy given the user's question. "
                "Approve it or provide a one-sentence critique."
                ))
            ])
        except Exception:
            # Fail toward safety: an emergency draft that was never reviewed
            # must not ship — the fallback's 911 lead is the safe floor.
            # For lower severities the draft was still generated with the
            # severity-aware system prompt, so shipping it unreviewed beats
            # looping against a broken critic (a retry would likely fail too).
            logger.exception("critic failed on severity=%s draft", severity)
            if severity == "emergency":
                return {
                    "critic_approved": True,
                    "draft_response": EMERGENCY_FALLBACK_RESPONSE,
                    "revision_count": state.revision_count + 1
                }
            return {"critic_approved": True, "revision_count": state.revision_count + 1}

        revision_count = state.revision_count + 1
        logger.info(f"approved: {response.approved}, critique: {response.critique}, revision_count: {revision_count}")

        if not response.approved and revision_count >= 2 and severity == "emergency":
            # The routing edge exits the loop at the cap regardless of approval,
            # which would ship this rejected draft as-is. Not acceptable for an
            # emergency turn — substitute the fallback before the exit.
            logger.warning("emergency draft rejected at revision cap — shipping fallback response")
            return {
                "critic_approved": True,
                "draft_response": EMERGENCY_FALLBACK_RESPONSE,
                "critique": response.critique,
                "revision_count": revision_count
            }

        return {"critic_approved": response.approved, "critique": response.critique, "revision_count": revision_count}

    return critic_node