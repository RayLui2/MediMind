from pydantic import BaseModel, Field
from typing import List

# Define the structure you want the LLM to return
class Recommendation(BaseModel):
    title: str = Field(description="Brief title for the recommendation")
    description: str = Field(description="Detailed recommendation text")

class RecommendationsResponse(BaseModel):
    recommendations: List[Recommendation] = Field(
        description="List of 6 personalized health recommendations"
    )