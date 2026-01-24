# Third-party imports
from pydantic import BaseModel, Field
from typing import List
from sqlalchemy import Column, Integer, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

# Local
from app.database import Base


# SQLAlchemy model for database storage
class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="recommendations")


# Pydantic models for LLM structured output
class RecommendationItem(BaseModel):
    title: str = Field(description="Brief title for the recommendation (max 8 words)")
    recommendation: str = Field(description="Detailed, actionable recommendation (2-4 sentences)")


class RecommendationsResponse(BaseModel):
    content: List[RecommendationItem] = Field(
        description="List of 6 personalized health recommendations"
    )
