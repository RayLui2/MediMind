from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.dashboard import router as dashboard_router

app = FastAPI(title="MediMind API", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(dashboard_router)

@app.get("/")
async def root():
    return {"message": "Welcome to MediMind API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

@app.get("/test-db")
async def test_database(db: Session = Depends(get_db)):
    # see if we can query the test_data table in database
    result = db.execute(text("SELECT * FROM test_data"))
    rows = result.fetchall()

    return {
        "status": "success",
        "data": [{"id": row[0], "message": row[1]} for row in rows]
    }

