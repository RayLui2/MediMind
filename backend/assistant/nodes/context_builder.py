# Standard library
import requests

# Local
from assistant.state import State

def get_rxcui_by_string(medications):
    base_url = "https://rxnav.nlm.nih.gov/REST/rxcui.json"
    rxcuis_list = []
    
    try:
        for medicine in medications:
            params = {'name': medicine.name}
            response = requests.get(base_url, params=params)
            response.raise_for_status() # Raise exception for HTTP errors
            data = response.json()
            
            # Parse the JSON response
            id_group = data.get('idGroup', {})
            rxcuis = id_group.get('rxnormId', [])
            
            if rxcuis:
                rxcuis_list.append(rxcuis[0])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        return None

    return rxcuis_list

def get_medication_interaction_flags(rxcuis_list):
    # TODO Contact one of the reputable clinical API providers: FDB (First Databank) MedKnowledge, Wolters Kluwer (Medi-Span), or Certara (DIDB)
    return []

def create_context_builder_node():
    async def context_builder(state: State):
        user_data = state.user_data
        health_profile = state.health_profile
        medications = state.medications
        vital_signs = state.vital_signs

        retrieved_context = "" # Initialize retrieved_context as an empty string

        # rxcuis_list = get_rxcui_by_string(medications=medications)
        # medication_interaction_flags = get_medication_interaction_flags(rxcuis_list) # TODO: Implement this

        triage = state.triage_result
        if not triage:
            return {"retrieved_context": None}

        topic_lower = triage.topic.lower()

        # Add basic user info
        if user_data:
            name = user_data.get('name', 'Unknown') if isinstance(user_data, dict) else getattr(user_data, 'name', 'Unknown')
            age = user_data.get('age', 'Unknown') if isinstance(user_data, dict) else getattr(user_data, 'age', 'Unknown')
            user_info = f"""User information:
- Name: {name}
- Age: {age}"""
            
            retrieved_context = user_info

        # Build retrieved_context from sections
        parts = ["[HEALTH CONTEXT — use this to personalize and inform your response]\n"]

        # Conditions
        conditions = []
        allergies = []
        if health_profile:
            conditions = health_profile.current_conditions
            allergies = health_profile.allergies
        if conditions:
            parts.append(f"Active Medical Conditions: {', '.join(conditions)}")
        if allergies:
            parts.append(f"Known Allergies: {', '.join(allergies)}")
        
        # Medications
        med_lines = []
        if medications:
            for m in medications:
                line = m.name
                if m.frequency:
                    line += f" ({m.frequency})"
                med_lines.append(line)
        parts.append(f"Active Medications: {', '.join(med_lines)}")

        # Vitals
        vitals_lines = []
        if vital_signs:
            if vital_signs.systolic_bp and vital_signs.diastolic_bp:
                vitals_lines.append(f"BP {vital_signs.systolic_bp}/{vital_signs.diastolic_bp} mmHg")
            if vital_signs.heart_rate:
                vitals_lines.append(f"HR {vital_signs.heart_rate} bpm")
            if vital_signs.temperature:
                vitals_lines.append(f"Temp {vital_signs.temperature}°F")
            if vitals_lines and vital_signs.recorded_at:
                recorded_str = vital_signs.recorded_at.strftime('%Y-%m-%d') if hasattr(vital_signs.recorded_at, 'strftime') else str(vital_signs.recorded_at)[:10]
                parts.append(f"Recent Vitals (recorded {recorded_str}): {', '.join(vitals_lines)}")

        retrieved_context += "\n".join(parts)
        
        print(f"retrieved_context: {retrieved_context}")
        return {"retrieved_context": retrieved_context}

    return context_builder