from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import redis
import json
import os
import datetime
import jwt # pyjwt
import bcrypt
from database import engine, get_db, Base
import models

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Reliable Job Runner API")

# Password Hashing
def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis Connection
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
redis_client = redis.Redis(host=REDIS_HOST, port=int(REDIS_PORT), db=0, decode_responses=True)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str

class TaskCreate(BaseModel):
    input_data: str
    max_execution_time: int = 30 # Default 30s
    task_type: str = "text_processing"
    simulated_duration: int = 5 # Default 5s simulated "work"
    replicas: int = 1 # Number of tasks to create

class TaskResponse(BaseModel):
    id: int
    input_data: str
    status: str
    result: Optional[str] = None
    created_at: datetime.datetime
    max_execution_time: int
    is_cancelled: bool
    owner_id: Optional[int] = None
    task_type: str
    simulated_duration: int

    class Config:
        from_attributes = True

class UserQuotaResponse(BaseModel):
    quota: int
    used: int
    available: int

class UserQuotaResponse(BaseModel):
    quota: int
    used: int
    available: int

# Auth Dependency
def verify_token(authorization: str = Header(None)):
    if not authorization:
        # For simplicity in this demo, if no token, we might allow or fail.
        # But requirement says "JWT-protected API".
        # Let's allow "Bearer <token>"
        raise HTTPException(status_code=401, detail="Missing Token")
    
    try:
        scheme, _, param = authorization.partition(" ")
        if scheme.lower() != "bearer":
             raise HTTPException(status_code=401, detail="Invalid token scheme")
        payload = jwt.decode(param, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Token")

# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "api"}

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pwd = get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@app.get("/users/me/quota", response_model=UserQuotaResponse)
def get_user_quota(db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    user_id = user_payload.get("user_id")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    total_tasks = db.query(models.Task).filter(models.Task.owner_id == user_id).count()
    return {
        "quota": db_user.task_quota,
        "used": total_tasks,
        "available": max(0, db_user.task_quota - total_tasks)
    }

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

@app.put("/users/me")
def update_profile(update_data: ProfileUpdate, db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    user_id = user_payload.get("user_id")
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update_data.username:
        # Check if username taken
        existing = db.query(models.User).filter(models.User.username == update_data.username, models.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        db_user.username = update_data.username
    
    if update_data.password:
        db_user.hashed_password = get_password_hash(update_data.password)
    
    db.commit()
    db.refresh(db_user)
    return {"message": "Profile updated successfully", "username": db_user.username}

@app.post("/login")
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    expiration = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    token = jwt.encode({
        "sub": db_user.username, 
        "user_id": db_user.id, 
        "is_admin": db_user.is_admin,
        "exp": expiration
    }, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer", "is_admin": db_user.is_admin}

@app.post("/tasks", response_model=list[TaskResponse])
def create_task(task: TaskCreate, db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    user_id = user_payload.get("user_id")
    
    # Quota Check
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    current_count = db.query(models.Task).filter(models.Task.owner_id == user_id).count()
    if current_count + task.replicas > db_user.task_quota:
        raise HTTPException(status_code=400, detail=f"Quota exceeded. Available: {db_user.task_quota - current_count}")

    print(f"DEBUG: Creating {task.replicas} tasks - Input: {task.input_data[:20]}, Timeout: {task.max_execution_time}, Workload: {task.simulated_duration}")
    
    created_tasks = []
    for i in range(task.replicas):
        # 1. Save to DB
        db_task = models.Task(
            input_data=task.input_data, 
            status="Pending",
            owner_id=user_id,
            max_execution_time=task.max_execution_time,
            task_type=task.task_type,
            simulated_duration=task.simulated_duration
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)

        # 2. Push to Redis (Stream or List)
        redis_client.xadd("task_stream", {"task_id": str(db_task.id)})
        created_tasks.append(db_task)
    
    return created_tasks

@app.post("/tasks/kill-all")
def kill_all_tasks(db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    user_id = user_payload.get("user_id")
    # Mark all active/pending tasks as Cancelled
    tasks = db.query(models.Task).filter(
        models.Task.owner_id == user_id,
        models.Task.status.in_(["Pending", "Processing"])
    ).all()
    
    for task in tasks:
        task.status = "Cancelled"
        task.is_cancelled = True
    
    db.commit()
    return {"message": f"Terminated {len(tasks)} active tasks"}

@app.post("/admin/reset-system")
def reset_system(db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    if not user_payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
    
    # Thorough Reset: Clear all tasks and reset ID sequence
    db.execute("TRUNCATE TABLE tasks RESTART IDENTITY CASCADE;")
    db.commit()
    # Clear Redis
    redis_client.delete("task_stream")
    return {"message": "System purged successfully. All records cleared and IDs reset."}

@app.get("/admin/users")
def get_all_users(db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    if not user_payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
    
    users = db.query(models.User).all()
    result = []
    for u in users:
        task_count = db.query(models.Task).filter(models.Task.owner_id == u.id).count()
        result.append({
            "id": u.id,
            "username": u.username,
            "is_admin": u.is_admin,
            "task_quota": u.task_quota,
            "tasks_dispatched": task_count
        })
    return result

@app.delete("/tasks")
def delete_my_tasks(db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    user_id = user_payload.get("user_id")
    deleted_count = db.query(models.Task).filter(models.Task.owner_id == user_id).delete()
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} tasks from your history."}

@app.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: int, db: Session = Depends(get_db), user_payload: dict = Depends(verify_token)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Ownership check
    if task.owner_id != user_payload.get("user_id"):
        raise HTTPException(status_code=403, detail="Not authorized to cancel this task")

    if task.status in ["Completed", "Failed", "Cancelled"]:
        return {"message": "Task already finished"}

    task.is_cancelled = True
    task.status = "Cancelled"
    db.commit()
    return {"message": "Task cancelled"}

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    tasks = db.query(models.Task).order_by(models.Task.id.desc()).offset(skip).limit(limit).all()
    return tasks

@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
