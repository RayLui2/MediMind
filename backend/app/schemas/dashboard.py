from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ============ Health Profile Schemas ============
class HealthProfileBase(BaseModel):
    current_weight: Optional[int] = None
    height: Optional[int] = None
    blood_type: Optional[str] = None
    activity_level: Optional[str] = None  # sedentary, lightly_active, moderately_active, very_active, extremely_active
    current_conditions: List[str] = []
    allergies: List[str] = []
    family_history: List[str] = []

class HealthProfileCreate(HealthProfileBase):
    pass

class HealthProfileUpdate(HealthProfileBase):
    pass

class HealthProfileResponse(HealthProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Medication Schemas ============
class MedicationBase(BaseModel):
    name: str
    frequency: str  # "daily", "twice", "weekly", "asneeded"
    time: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True

class MedicationCreate(MedicationBase):
    pass

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    time: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class MedicationResponse(MedicationBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Medication Log Schemas ============
class MedicationLogCreate(BaseModel):
    medication_id: int

class MedicationLogResponse(BaseModel):
    id: int
    medication_id: int
    user_id: int
    taken_at: datetime
    dose_number: int

    class Config:
        from_attributes = True


# ============ Symptom Schemas ============
class SymptomBase(BaseModel):
    symptom_type: str
    severity: int = Field(..., ge=1, le=10)
    notes: Optional[str] = None

class SymptomCreate(SymptomBase):
    pass

class SymptomUpdate(BaseModel):
    symptom_type: Optional[str] = None
    severity: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None

class SymptomResponse(SymptomBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Vital Sign Schemas ============
class VitalSignBase(BaseModel):
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    heart_rate: Optional[int] = None
    weight: Optional[int] = None
    temperature: Optional[float] = None
    notes: Optional[str] = None

class VitalSignCreate(VitalSignBase):
    pass

class VitalSignResponse(VitalSignBase):
    id: int
    user_id: int
    recorded_at: datetime

    class Config:
        from_attributes = True


# ============ Dashboard Summary Schema ============
class DashboardSummary(BaseModel):
    """Aggregated dashboard data for overview stats"""
    medications_today: int
    total_medications: int
    latest_bp: Optional[str] = None  # "118/78"
    latest_weight: Optional[int] = None
    symptom_count_today: int
    active_streak_days: int


# ============ Setup Flow Schemas ============
class SetupCompleteRequest(BaseModel):
    """Request schema for completing first-time setup"""
    current_weight: Optional[int] = Field(None, ge=50, le=500)  # lbs
    height: Optional[int] = Field(None, ge=36, le=96)  # inches (3ft to 8ft)
    activity_level: Optional[str] = None  # sedentary, lightly_active, moderately_active, very_active, extremely_active
    current_conditions: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    family_history: List[str] = Field(default_factory=list)

class SetupCompleteResponse(BaseModel):
    """Response after completing setup"""
    success: bool
    message: str

class SetupStatusResponse(BaseModel):
    """Response for checking if user has completed setup"""
    setup_complete: bool
    setup_completed_at: Optional[datetime] = None


# ============ Water Intake Schemas ============
class WaterIntakeCreate(BaseModel):
    """Request schema for logging water intake"""
    amount_oz: float = Field(..., gt=0, le=200)  # 1 oz to 200 oz (reasonable range)

class WaterIntakeResponse(BaseModel):
    """Response schema for water intake log"""
    id: int
    user_id: int
    amount_oz: float
    consumed_at: datetime

    class Config:
        from_attributes = True

class WaterIntakeRecommendation(BaseModel):
    """Calculated water intake recommendation"""
    recommended_oz: float
    base_amount: float
    activity_adjustment: float
    cups: float  # oz / 8


# ============ Recommendation Schemas ============
class RecommendationResponse(BaseModel):
    """Response schema for a single recommendation"""
    id: int
    user_id: int
    title: str
    recommendation: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecommendationsListResponse(BaseModel):
    """Response schema for list of recommendations"""
    recommendations: List[RecommendationResponse]
    generated_at: Optional[datetime] = None
