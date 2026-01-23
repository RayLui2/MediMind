from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class VitalSign(Base):
    """User's vital signs tracking (BP, heart rate, weight, etc.)"""
    __tablename__ = "vital_signs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Vital measurements
    systolic_bp = Column(Integer)  # mmHg
    diastolic_bp = Column(Integer)  # mmHg
    heart_rate = Column(Integer)  # bpm
    weight = Column(Integer)  # lbs
    temperature = Column(Float)  # Fahrenheit

    # Optional metadata
    notes = Column(String)

    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="vital_signs")
