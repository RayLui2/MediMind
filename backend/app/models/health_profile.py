from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class HealthProfile(Base):
    """User's core health information and medical history"""
    __tablename__ = "health_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Physical metrics
    current_weight = Column(Integer)  # in lbs
    height = Column(Integer)  # in inches
    blood_type = Column(String)

    # Medical information
    current_conditions = Column(ARRAY(String), default=[])  # ["Hypertension", "Type 2 Diabetes"]
    allergies = Column(ARRAY(String), default=[])  # ["Penicillin", "Peanuts"]
    family_history = Column(ARRAY(String), default=[])  # ["Heart Disease", "Diabetes"]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="health_profile")
