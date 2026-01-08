"""Responses router for guest answer submissions."""

from fastapi import APIRouter, HTTPException, status
from ..models import AnswersSubmit, ResponseRecord
from ..database import get_supabase
from uuid import UUID

router = APIRouter(prefix="/events", tags=["responses"])


@router.post("/{code}/responses", status_code=status.HTTP_201_CREATED)
async def submit_responses(code: str, submission: AnswersSubmit):
    """Submit all answers for a guest."""
    supabase = get_supabase()
    
    # Get event by code
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event_id = event_result.data[0]["id"]
    
    # Verify guest exists in this event
    guest_result = supabase.table("guests").select("id, event_id").eq("id", str(submission.guest_id)).execute()
    
    if not guest_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest not found"
        )
    
    if guest_result.data[0]["event_id"] != event_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest does not belong to this event"
        )
    
    # Insert or update responses
    responses_to_upsert = []
    for answer in submission.answers:
        responses_to_upsert.append({
            "guest_id": str(submission.guest_id),
            "question_id": str(answer.question_id),
            "answer": answer.answer,
        })
    
    # Upsert responses (insert or update on conflict)
    result = supabase.table("responses").upsert(
        responses_to_upsert,
        on_conflict="guest_id,question_id"
    ).execute()
    
    return {"message": f"Submitted {len(submission.answers)} responses", "count": len(submission.answers)}


@router.get("/{code}/responses/{guest_id}", response_model=list[ResponseRecord])
async def get_guest_responses(code: str, guest_id: UUID):
    """Get all responses for a specific guest."""
    supabase = get_supabase()
    
    # Verify event exists
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Get responses
    result = supabase.table("responses").select("*").eq("guest_id", str(guest_id)).execute()
    
    return result.data
