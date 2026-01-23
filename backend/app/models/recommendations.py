from pydantic import Base, Field
from typing import List
from sqlalchemy import Column, Integer, ForeignKey, Text, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from sqlalchemy.event import base

# Define the structure you want the LLM to return
class Recommendation(Base):
    __table_name__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(Text, nullable=False, description="Brief title for the recommendation")
    recommendation = Column(Text, nullable=False, description="Detailed recommendation text")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="symptoms")

class RecommendationsResponse(Base):
    recommendations: List[Recommendation] = Field(
        description="List of 6 personalized health recommendations"
    )