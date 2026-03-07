from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Medication(Base):
    """User's medication tracking"""
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)  # "Aspirin 81mg"
    frequency = Column(String, nullable=False)  # "daily", "twice", "weekly", "asneeded"
    time = Column(String)  # "08:00" stored as string for simplicity
    notes = Column(String)
    is_active = Column(Boolean, default=True)  # To track if medication is still being taken

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="medications")
    medication_logs = relationship("MedicationLog", back_populates="medication", cascade="all, delete-orphan")


class MedicationLog(Base):
    """Track when medications are taken"""
    __tablename__ = "medication_logs"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    taken_at = Column(DateTime(timezone=True), server_default=func.now())
    dose_number = Column(Integer, default=1, nullable=False)  # Track which dose (1st, 2nd, etc.)

    # Relationships
    medication = relationship("Medication", back_populates="medication_logs")
    user = relationship("User", back_populates="medication_logs")
