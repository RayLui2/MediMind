from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    # User Model mapped to 'users' in DB
    __tablename__ = "users"

    id = Column(Integer, primary_key = True, index = True)
    name = Column(String)
    age = Column(Integer)