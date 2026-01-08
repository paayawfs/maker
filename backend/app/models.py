from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


# ==================== Event Models ====================

class EventCreate(BaseModel):
    """Request model for creating an event."""
    name: str = Field(..., min_length=1, max_length=255)
    host_name: Optional[str] = Field(None, max_length=100)
    matching_mode: str = Field("any", pattern="^(any|preference_based)$")  # any or preference_based
    matches_per_guest: int = Field(1, ge=1, le=5)
    event_type: str = Field("party", pattern="^(party|networking)$")  # party or networking


class EventResponse(BaseModel):
    """Response model for an event."""
    id: UUID
    code: str
    name: str
    host_name: Optional[str] = None
    created_at: datetime


class EventPublic(BaseModel):
    """Public event info (for guests joining)."""
    code: str
    name: str
    host_name: Optional[str] = None


class EventUpdate(BaseModel):
    """Request model for updating an event."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    host_name: Optional[str] = Field(None, max_length=100)
    matching_mode: Optional[str] = Field(None, pattern="^(any|preference_based)$")
    matches_per_guest: Optional[int] = Field(None, ge=1, le=5)


# ==================== Guest Models ====================

class GuestJoin(BaseModel):
    """Request model for joining an event."""
    nickname: str = Field(..., min_length=1, max_length=100)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    looking_for: Optional[str] = Field(None, pattern="^(male|female|any)$")


class GuestResponse(BaseModel):
    """Response model for a guest."""
    id: UUID
    event_id: UUID
    nickname: str
    joined_at: datetime


# ==================== Question Models ====================

class QuestionCreate(BaseModel):
    """Request model for creating a question."""
    text: str = Field(..., min_length=1)
    question_type: str = "multiple_choice"
    options: Optional[list[str]] = None
    order_index: int = 0


class QuestionResponse(BaseModel):
    """Response model for a question."""
    id: UUID
    event_id: UUID
    text: str
    question_type: str
    options: Optional[list[str]] = None
    order_index: int


class QuestionUpdate(BaseModel):
    """Request model for updating a question."""
    text: Optional[str] = Field(None, min_length=1)
    options: Optional[list[str]] = None
    order_index: Optional[int] = None


# ==================== Answer/Response Models ====================

class AnswerSubmit(BaseModel):
    """Single answer submission."""
    question_id: UUID
    answer: str


class AnswersSubmit(BaseModel):
    """Batch answer submission from a guest."""
    guest_id: UUID
    answers: list[AnswerSubmit]


class ResponseRecord(BaseModel):
    """Response model for a stored answer."""
    id: UUID
    guest_id: UUID
    question_id: UUID
    answer: str


# ==================== Match Models ====================

class MatchResult(BaseModel):
    """A match result for a guest."""
    guest_id: UUID
    nickname: str
    score: float  # 0.0 to 1.0


class EventStatus(BaseModel):
    """Event status including matching state."""
    code: str
    name: str
    host_name: Optional[str] = None
    guest_count: int
    responses_count: int
    matching_completed: bool

