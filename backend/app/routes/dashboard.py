# Standard library
from datetime import date, datetime, timedelta
from typing import List

# Third-party
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# Local
from app.database import get_db
from app.models.health_profile import HealthProfile
from app.models.medication import Medication, MedicationLog
from app.models.symptom import Symptom
from app.models.user import User
from app.models.vital_sign import VitalSign
from app.routes.auth import get_current_user
from app.schemas.dashboard import (
    DashboardSummary,
    HealthProfileCreate,
    HealthProfileResponse,
    HealthProfileUpdate,
    MedicationCreate,
    MedicationLogResponse,
    MedicationResponse,
    MedicationUpdate,
    SymptomCreate,
    SymptomResponse,
    VitalSignCreate,
    VitalSignResponse,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ============ Health Profile Routes ============
@router.get("/health-profile", response_model=HealthProfileResponse)
async def get_health_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's health profile"""
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Health profile not found")
    return profile


@router.post("/health-profile", response_model=HealthProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_health_profile(
    profile_data: HealthProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create user's health profile (one-time setup)"""
    # Check if profile already exists
    existing_profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    if existing_profile:
        raise HTTPException(status_code=400, detail="Health profile already exists. Use PUT to update.")

    profile = HealthProfile(**profile_data.model_dump(), user_id=current_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/health-profile", response_model=HealthProfileResponse)
async def update_health_profile(
    profile_data: HealthProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's health profile"""
    profile = db.query(HealthProfile).filter(HealthProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Health profile not found. Create one first.")

    for key, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)

    db.commit()
    db.refresh(profile)
    return profile


# ============ Medication Routes ============
@router.get("/medications", response_model=List[MedicationResponse])
async def get_medications(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all user medications"""
    query = db.query(Medication).filter(Medication.user_id == current_user.id)
    if active_only:
        query = query.filter(Medication.is_active == True)
    medications = query.order_by(Medication.time).all()
    return medications


@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def create_medication(
    medication_data: MedicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new medication"""
    medication = Medication(**medication_data.model_dump(), user_id=current_user.id)
    db.add(medication)
    db.commit()
    db.refresh(medication)
    return medication


@router.put("/medications/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: int,
    medication_data: MedicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a medication"""
    medication = db.query(Medication).filter(
        Medication.id == medication_id,
        Medication.user_id == current_user.id
    ).first()

    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    for key, value in medication_data.model_dump(exclude_unset=True).items():
        setattr(medication, key, value)

    db.commit()
    db.refresh(medication)
    return medication


@router.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medication(
    medication_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a medication"""
    medication = db.query(Medication).filter(
        Medication.id == medication_id,
        Medication.user_id == current_user.id
    ).first()

    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    db.delete(medication)
    db.commit()


# ============ Medication Log Routes ============
@router.post("/medications/{medication_id}/log", response_model=MedicationLogResponse, status_code=status.HTTP_201_CREATED)
async def log_medication_taken(
    medication_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log that a medication was taken"""
    # Verify medication belongs to user
    medication = db.query(Medication).filter(
        Medication.id == medication_id,
        Medication.user_id == current_user.id
    ).first()

    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")

    # Check if already logged today
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    existing_log = db.query(MedicationLog).filter(
        MedicationLog.medication_id == medication_id,
        MedicationLog.user_id == current_user.id,
        MedicationLog.taken_at >= today_start,
        MedicationLog.taken_at <= today_end
    ).first()

    if existing_log:
        raise HTTPException(status_code=400, detail="Medication already logged for today")

    log = MedicationLog(medication_id=medication_id, user_id=current_user.id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/medications/logs/today", response_model=List[int])
async def get_todays_medication_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of medication IDs that were logged today"""
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    logs = db.query(MedicationLog.medication_id).filter(
        MedicationLog.user_id == current_user.id,
        MedicationLog.taken_at >= today_start
    ).distinct().all()

    return [log[0] for log in logs]


@router.get("/medications/{medication_id}/logs", response_model=List[MedicationLogResponse])
async def get_medication_logs(
    medication_id: int,
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get medication logs for the past N days"""
    since_date = datetime.now() - timedelta(days=days)
    logs = db.query(MedicationLog).filter(
        MedicationLog.medication_id == medication_id,
        MedicationLog.user_id == current_user.id,
        MedicationLog.taken_at >= since_date
    ).order_by(MedicationLog.taken_at.desc()).all()
    return logs


# ============ Symptom Routes ============
@router.get("/symptoms", response_model=List[SymptomResponse])
async def get_symptoms(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user symptoms from the past N days"""
    since_date = datetime.now() - timedelta(days=days)
    symptoms = db.query(Symptom).filter(
        Symptom.user_id == current_user.id,
        Symptom.created_at >= since_date
    ).order_by(Symptom.created_at.desc()).all()
    return symptoms


@router.post("/symptoms", response_model=SymptomResponse, status_code=status.HTTP_201_CREATED)
async def create_symptom(
    symptom_data: SymptomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log a new symptom"""
    symptom = Symptom(**symptom_data.model_dump(), user_id=current_user.id)
    db.add(symptom)
    db.commit()
    db.refresh(symptom)
    return symptom


@router.delete("/symptoms/{symptom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_symptom(
    symptom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a symptom"""
    symptom = db.query(Symptom).filter(
        Symptom.id == symptom_id,
        Symptom.user_id == current_user.id
    ).first()

    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom not found")

    db.delete(symptom)
    db.commit()


# ============ Vital Signs Routes ============
@router.get("/vital-signs", response_model=List[VitalSignResponse])
async def get_vital_signs(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get vital signs from the past N days"""
    since_date = datetime.now() - timedelta(days=days)
    vitals = db.query(VitalSign).filter(
        VitalSign.user_id == current_user.id,
        VitalSign.recorded_at >= since_date
    ).order_by(VitalSign.recorded_at.desc()).all()
    return vitals


@router.post("/vital-signs", response_model=VitalSignResponse, status_code=status.HTTP_201_CREATED)
async def create_vital_sign(
    vital_data: VitalSignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log new vital signs"""
    vital = VitalSign(**vital_data.model_dump(), user_id=current_user.id)
    db.add(vital)
    db.commit()
    db.refresh(vital)

    # Sync weight to health profile if provided
    if vital.weight:
        health_profile = db.query(HealthProfile).filter(
            HealthProfile.user_id == current_user.id
        ).first()
        if health_profile:
            health_profile.current_weight = vital.weight
            # Manually update the updated_at timestamp
            health_profile.updated_at = datetime.now()
            db.commit()
        else:
            # Create health profile with just the weight if it doesn't exist
            new_profile = HealthProfile(user_id=current_user.id, current_weight=vital.weight)
            db.add(new_profile)
            db.commit()

    return vital


@router.delete("/vital-signs/{vital_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vital_sign(
    vital_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a vital sign record"""
    vital = db.query(VitalSign).filter(
        VitalSign.id == vital_id,
        VitalSign.user_id == current_user.id
    ).first()

    if not vital:
        raise HTTPException(status_code=404, detail="Vital sign not found")

    db.delete(vital)
    db.commit()


# ============ Dashboard Summary Route ============
@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated dashboard summary for overview cards"""
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    # Medications today (logs from today)
    medications_today = db.query(MedicationLog).filter(
        MedicationLog.user_id == current_user.id,
        MedicationLog.taken_at >= today_start
    ).count()

    # Total active medications
    total_medications = db.query(Medication).filter(
        Medication.user_id == current_user.id,
        Medication.is_active == True
    ).count()

    # Latest BP (from vital signs with BP data)
    latest_bp_vital = db.query(VitalSign).filter(
        VitalSign.user_id == current_user.id,
        VitalSign.systolic_bp.isnot(None),
        VitalSign.diastolic_bp.isnot(None)
    ).order_by(VitalSign.recorded_at.desc()).first()

    latest_bp = None
    if latest_bp_vital:
        latest_bp = f"{latest_bp_vital.systolic_bp}/{latest_bp_vital.diastolic_bp}"

    # Latest weight (compare timestamps between vital signs and health profile)
    latest_weight_vital = db.query(VitalSign).filter(
        VitalSign.user_id == current_user.id,
        VitalSign.weight.isnot(None)
    ).order_by(VitalSign.recorded_at.desc()).first()

    health_profile = db.query(HealthProfile).filter(
        HealthProfile.user_id == current_user.id
    ).first()

    latest_weight = None

    # Compare which one is more recent
    if latest_weight_vital and health_profile:
        # Both exist - use whichever was updated more recently
        if health_profile.updated_at and health_profile.updated_at > latest_weight_vital.recorded_at:
            latest_weight = health_profile.current_weight
        else:
            latest_weight = latest_weight_vital.weight
    elif latest_weight_vital:
        # Only vital signs exist
        latest_weight = latest_weight_vital.weight
    elif health_profile:
        # Only health profile exists
        latest_weight = health_profile.current_weight

    # Symptoms today
    symptom_count_today = db.query(Symptom).filter(
        Symptom.user_id == current_user.id,
        Symptom.created_at >= today_start
    ).count()

    # Active streak (days with medication logs in a row, going backwards from today)
    active_streak_days = 0
    current_day = today
    while True:
        day_start = datetime.combine(current_day, datetime.min.time())
        day_end = datetime.combine(current_day, datetime.max.time())

        logs_that_day = db.query(MedicationLog).filter(
            MedicationLog.user_id == current_user.id,
            MedicationLog.taken_at >= day_start,
            MedicationLog.taken_at <= day_end
        ).count()

        if logs_that_day > 0:
            active_streak_days += 1
            current_day -= timedelta(days=1)
        else:
            break

        # Safety limit
        if active_streak_days > 365:
            break

    return DashboardSummary(
        medications_today=medications_today,
        total_medications=total_medications,
        latest_bp=latest_bp,
        latest_weight=latest_weight,
        symptom_count_today=symptom_count_today,
        active_streak_days=active_streak_days
    )
