from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    task_quota = Column(Integer, default=100) # Max total tasks allowed
    is_admin = Column(Boolean, default=True)
    
    tasks = relationship("Task", back_populates="owner")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    input_data = Column(Text, nullable=False)
    status = Column(String, default="Pending") # Pending, Processing, Completed, Failed, Cancelled
    result = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Phase 2
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Check
    max_execution_time = Column(Integer, default=30) # seconds
    is_cancelled = Column(Boolean, default=False)
    
    # Phase 3
    task_type = Column(String, default="text_processing") # image_gen, video_gen, code_analysis
    
    # New: Explicit Duration Control
    simulated_duration = Column(Integer, default=5) # seconds to "work"
    
    owner = relationship("User", back_populates="tasks")
