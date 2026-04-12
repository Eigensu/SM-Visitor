from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import connect_to_mongo, close_mongo_connection
from config import ALLOWED_ORIGINS
from routers import auth, visitors, temp_qr, visits, uploads, events, users, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()


app = FastAPI(
    title="Pantry API",
    version="0.2.0",
    description="Backend API for SM-Visitor Management System",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(visitors.router)
app.include_router(temp_qr.router)
app.include_router(visits.router)
app.include_router(uploads.router)
app.include_router(events.router)
app.include_router(users.router)
app.include_router(notifications.router)


@app.get("/")
async def read_root() -> dict[str, str]:
    return {"message": "Welcome to the Pantry API", "version": "0.2.0"}


@app.get("/health")
async def health_check() -> dict:
    from utils.sse_manager import sse_manager
    # Flatten connections to get total active streams
    total_connections = sum(len(conns) for conns in sse_manager.connections.values())
    return {
        "status": "ok",
        "sse": {
            "active_users": len(sse_manager.connections),
            "total_connections": total_connections,
            "event_count": sse_manager.event_count
        }
    }



