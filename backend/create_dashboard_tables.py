"""
Create dashboard-related tables in the database
Run this script: python create_dashboard_tables.py
"""
from app.database import engine, Base
from app.models import User, HealthProfile, Medication, MedicationLog, Symptom, VitalSign

def create_dashboard_tables():
    """Create all dashboard tables"""
    print("Creating dashboard tables...")
    print("- health_profiles")
    print("- medications")
    print("- medication_logs")
    print("- symptoms")
    print("- vital_signs")

    Base.metadata.create_all(bind=engine)
    print("\n✓ All dashboard tables created successfully!")

if __name__ == "__main__":
    create_dashboard_tables()
