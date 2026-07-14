# Standard library
import logging

# Third-party
from langchain_core.messages import HumanMessage, SystemMessage

# Local
from assistant.llm import get_llm
from assistant.state import State
from assistant.models.triage import TriageResult
from assistant.models.health_profile import HealthProfile
from assistant.models.medications import Medication

logger = logging.getLogger(__name__)

def generate_system_prompt(health_profile: HealthProfile, medications: list[Medication]):
    conditions = health_profile.current_conditions or [] if health_profile else []
    allergies = health_profile.allergies or [] if health_profile else []
    med_names = [m.name for m in medications if m.name] if medications else []
    
    return f"""You are a medical triage classifier for a personal health assistant.
  Classify the urgency of the user's message into exactly one severity level.

  SEVERITY LEVELS:

  emergency — Requires 911 or ER immediately. Use for:
  - Chest pain, pressure, or tightness
  - Difficulty breathing or shortness of breath at rest
  - Stroke signs: sudden numbness, confusion, slurred speech, vision changes, sudden severe headache
  - Severe allergic reaction (throat swelling, can't breathe)
  - Loss of consciousness or near-fainting
  - Uncontrolled bleeding
  - Suicidal thoughts with intent or plan
  - Suspected overdose
  - Sudden severe pain anywhere

  clinical — Needs medical evaluation soon, not emergency. Use for:
  - Symptoms persisting more than 2-3 days
  - Questions about specific symptoms that may need diagnosis
  - Medication questions: dosages, side effects, interactions, missed doses
  - Questions about lab results or existing diagnoses
  - Mental health concerns (non-emergency)
  - Chronic condition management
  - Mild symptoms that are concerning given the user's known conditions

  general — Health and wellness, no urgency. Use for:
  - Diet, nutrition, and healthy eating
  - Exercise and fitness advice
  - Sleep, stress, and lifestyle questions
  - General health education
  - Preventive care and supplements

  off_topic — Not health related at all.

  IMPORTANT: Use the user's health context below to escalate severity when relevant.
  For example:
  - "Feeling dizzy" is general normally, but clinical if the user is diabetic or on blood pressure medication
  - "Bruising easily" is general normally, but clinical if the user is on blood thinners
  - "Chest tightness" is clinical normally, but emergency if the user has heart disease

  User health context:
  - Known conditions: {', '.join(conditions) or 'none'}
  - Current medications: {', '.join(med_names) or 'none'}
  - Allergies: {', '.join(allergies) or 'none'}

  Also identify the medical topic of the message in 2-5 words (e.g. "chest pain", "medication dosage", "diet
  advice")."""

def create_triage_node():
    llm = get_llm(temperature=0.05, streaming=False, tier="fast")

    structured_llm = llm.with_structured_output(TriageResult)

    async def triage_node(state: State):
        messages = list(state.messages)

        original_content = messages[-1].content
        health_profile = state.health_profile
        medications = state.medications
        
        system_prompt = generate_system_prompt(health_profile=health_profile, medications=medications)

        response = await structured_llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=original_content)
        ])

        logger.info(f"triage_result: {response}")

        if response.severity == "general" or response.severity == "off_topic":
            return {"triage_result": response, "critic_approved": True}
        return {"triage_result": response}

    return triage_node