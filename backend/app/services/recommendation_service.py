# Standard library imports
import time
import os

# Third-party imports
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage

# Local
from assistant.state import State
from app.models.health_profile import HealthProfile
from app.models.vital_sign import VitalSign
from app.models.recommendations import Recommendation, RecommendationsResponse

load_dotenv()

def generate_prompt(data: State):
    # Extract health profile data
    health_profile = data.health_profile
    vital_signs = data.vital_signs
    
    # Build the prompt with all user data
    prompt = f"""You are a professional health advisor. Based on the user's health data below, generate 6 personalized, actionable health recommendations.

## User Health Profile:

### Physical Metrics:
- Weight: {health_profile.current_weight if health_profile and health_profile.current_weight else 'Not provided'} lbs
- Height: {health_profile.height if health_profile and health_profile.height else 'Not provided'} inches
- Blood Type: {health_profile.blood_type if health_profile and health_profile.blood_type else 'Not provided'}
- Activity Level: {health_profile.activity_level if health_profile and health_profile.activity_level else 'Not provided'}

### Medical Information:
- Current Medical Conditions: {', '.join(health_profile.current_conditions) if health_profile and health_profile.current_conditions else 'None reported'}
- Allergies: {', '.join(health_profile.allergies) if health_profile and health_profile.allergies else 'None reported'}
- Family Medical History: {', '.join(health_profile.family_history) if health_profile and health_profile.family_history else 'None reported'}

### Recent Vital Signs:
{f'''- Blood Pressure: {vital_signs.systolic_bp}/{vital_signs.diastolic_bp} mmHg
- Heart Rate: {vital_signs.heart_rate} bpm
- Current Weight: {vital_signs.weight} lbs
- Temperature: {vital_signs.temperature}°F
- Notes: {vital_signs.notes if vital_signs.notes else 'None'}''' if vital_signs else '- No recent vital signs recorded'}

## Instructions:

Generate exactly 6 personalized health recommendations based on the above data. Each recommendation should:

1. Be **specific and actionable** - not generic advice
2. Consider the user's current conditions, allergies, and family history
3. Be tailored to their activity level and physical metrics
4. Cover diverse health areas such as:
- Physical exercise and activity
- Nutrition and diet
- Cardiovascular health
- Weight management
- Preventive care based on family history
- Lifestyle modifications
- Monitoring and tracking

Each recommendation should have:
- **Title**: A clear, concise title (max 8 words)
- **Description**: A detailed, actionable explanation (2-4 sentences) that explains what to do and why it matters for this specific user

Make the recommendations practical, evidence-based, and appropriate for someone with their specific health profile.

IMPORTANT: 
- If the user has medical conditions, ensure recommendations are safe and appropriate
- If they have allergies, avoid recommending anything that could trigger them
- If there's concerning family history, include relevant preventive measures
- Base intensity of exercise recommendations on their activity level"""

    return prompt

def create_recommendations(user_id: int, db):
    # time.sleep(300) # Wait 5 minutes

    def get_data(state: State):
        # Get data from database
        db_health_profile = db.query(HealthProfile).filter(
            HealthProfile.user_id == user_id
        )

        db_vital_signs = db.query(VitalSign).filter(
            VitalSign.user_id == user_id
        )
        if not state:
            state = State()

        state.health_profile = db_health_profile
        state.vital_signs = db_vital_signs

        return state

    data = get_data

    # Initilize chat model
    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.5,
    )
    
    # Add reponse structure
    structured_llm = llm.with_structured_output(RecommendationsResponse)

    # Generate prompts with user's data
    prompt = generate_prompt(data)

    # Call AI API
    response = structured_llm.invoke([
        SystemMessage(content="You are a helpful health assistant providing personalized recommendations."),
        HumanMessage(content=prompt)
    ])

    recommendations = response.content

    # Delete existing recommendations from database
    db.query(Recommendation).filter(Recommendation.user_id == user_id).delete()

    # Insert new recommendations to database
    for rec in recommendations:
        db_recommendation = Recommendation(
            user_id=user_id,
            title=rec.title,
            description=rec.description,
        )
        db.add(db_recommendation)

    db.commit()

    return