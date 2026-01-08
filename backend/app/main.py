from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routers import events
from .routers import responses
from .routers import matching

# Initialize FastAPI app
app = FastAPI(
    title="Party Matchmaker API",
    description="Backend API for Party Matchmaker MVP",
    version="1.0.0"
)

# Configure CORS - allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(events.router)
app.include_router(responses.router)
app.include_router(matching.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "healthy", "app": "Party Matchmaker API"}


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "supabase"
    }
