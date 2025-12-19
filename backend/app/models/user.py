from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    # User Model mapped to 'users' in DB
    __tablename__ = "users"

    id = Column(Integer, primary_key = True, index = True)
    email = Column(String, unique = True, nullable = False, index = True)
    password_hash = Column(String, nullable = False)
    name = Column(String)
    age = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())