# Standard library imports
import os

# Third-party imports
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy.orm import Session

# Local
from assistant.state import State
from assistant.models.health_profile import HealthProfile
from assistant.models.vital_sign import VitalSign
from app.models.recommendations import Recommendation, RecommendationsResponse

load_dotenv()


def generate_recommendations_prompt(state: State) -> str:
    """
    Generate the prompt for recommendations based on state health data.

    Args:
        state: LangGraph state containing health_profile and vital_signs

    Returns:
        Formatted prompt string for the LLM
    """
    health_profile = state.health_profile
    vital_signs = state.vital_signs

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
- **Title**: A clear, concise title (max 5 words). Add an emoji before the 5 words
- **Description**: A detailed, actionable explanation (2 short, concise sentences MAX) that explains what to do and why it matters for this specific user

Make the recommendations practical, evidence-based, and appropriate for someone with their specific health profile.

IMPORTANT:
- If the user has medical conditions, ensure recommendations are safe and appropriate
- If they have allergies, avoid recommending anything that could trigger them
- If there's concerning family history, include relevant preventive measures
- Base intensity of exercise recommendations on their activity level"""

    return prompt


def create_recommendations_node(db: Session):
    """
    Create a recommendations node that generates personalized health advice.

    This node:
    1. Uses health data from state
    2. Generates recommendations via structured LLM output
    3. Persists recommendations to database

    Args:
        db: Database session for persistence

    Returns:
        A node function compatible with LangGraph
    """

    llm = init_chat_model(
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        model_provider="google_genai",
        api_key=os.getenv("GEMINI_API_KEY"),
        temperature=0.5,
    )

    # Add structured output
    structured_llm = llm.with_structured_output(RecommendationsResponse)

    def recommendations_node(state: State):
        """
        Generate and persist health recommendations.

        Args:
            state: LangGraph state with health_profile, vital_signs, and user_id

        Returns:
            Dict with generated recommendations
        """
        user_id = state.user_id

        if not user_id:
            return {"recommendations": []}

        # Generate prompt from state
        prompt = generate_recommendations_prompt(state)

        # Call LLM with structured output
        response = structured_llm.invoke([
            SystemMessage(content="You are a helpful health assistant providing personalized recommendations."),
            HumanMessage(content=prompt)
        ])

        recommendations_data = response.content

        # Delete existing recommendations
        db.query(Recommendation).filter(Recommendation.user_id == user_id).delete()

        # Insert new recommendations
        for rec in recommendations_data:
            db_recommendation = Recommendation(
                user_id=user_id,
                title=rec.title,
                recommendation=rec.recommendation,
            )
            db.add(db_recommendation)

        db.commit()

        return {"recommendations": recommendations_data}

    return recommendations_node
