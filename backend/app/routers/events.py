from fastapi import APIRouter, HTTPException, status, Depends, Header
from typing import Optional
from ..models import (
    EventCreate, EventResponse, EventPublic, EventUpdate,
    GuestJoin, GuestResponse,
    QuestionCreate, QuestionResponse, QuestionUpdate,
    EventStatus
)
from ..database import get_supabase
from ..auth import get_current_user
import random
import string

router = APIRouter(prefix="/events", tags=["events"])


def generate_event_code(length: int = 8) -> str:
    """Generate a random alphanumeric event code."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event: EventCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a new event with a unique code."""
    supabase = get_supabase()
    
    # Extract user ID from token if provided (and valid)
    host_user_id = None
    if authorization and authorization.startswith("Bearer "):
        try:
            import jwt
            from .config import get_settings
            settings = get_settings()
            token = authorization.split(" ")[1]
            decoded = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
            host_user_id = decoded.get("sub")
        except:
            # Invalid token - treat as unauthenticated
            pass
    
    # Generate unique code (retry if collision)
    for _ in range(5):
        code = generate_event_code()
        
        # Check if code already exists
        existing = supabase.table("events").select("id").eq("code", code).execute()
        if not existing.data:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate unique event code"
        )
    
    # Insert event
    event_data = {
        "code": code,
        "name": event.name,
        "host_name": event.host_name,
        "matching_mode": event.matching_mode,
        "matches_per_guest": event.matches_per_guest,
        "event_type": event.event_type,
    }
    if host_user_id:
        event_data["host_user_id"] = host_user_id
    
    result = supabase.table("events").insert(event_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )
    
    return result.data[0]


@router.get("/my-events")
async def get_my_events(current_user: dict = Depends(get_current_user)):
    """Get all events created by the authenticated host."""
    supabase = get_supabase()
    
    result = supabase.table("events").select(
        "id, code, name, host_name, created_at, matching_completed, matches_revealed"
    ).eq("host_user_id", current_user["id"]).order("created_at", desc=True).execute()
    
    return result.data


@router.get("/{code}")
async def get_event(code: str):
    """Get event details by code."""
    supabase = get_supabase()
    
    result = supabase.table("events").select(
        "code, name, host_name, matching_mode"
    ).eq("code", code.upper()).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    return result.data[0]


@router.post("/{code}/join", response_model=GuestResponse, status_code=status.HTTP_201_CREATED)
async def join_event(code: str, guest: GuestJoin):
    """Join an event with a nickname."""
    supabase = get_supabase()
    
    # Get event by code
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event_id = event_result.data[0]["id"]
    
    # Check if nickname already taken in this event
    existing_guest = supabase.table("guests").select("id").eq("event_id", event_id).eq("nickname", guest.nickname).execute()
    
    if existing_guest.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nickname already taken in this event"
        )
    
    # Insert guest
    guest_data = {
        "event_id": event_id,
        "nickname": guest.nickname,
    }
    if guest.gender:
        guest_data["gender"] = guest.gender
    if guest.looking_for:
        guest_data["looking_for"] = guest.looking_for
    
    result = supabase.table("guests").insert(guest_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to join event"
        )
    
    return result.data[0]


@router.get("/{code}/guests", response_model=list[GuestResponse])
async def get_event_guests(code: str):
    """Get all guests in an event."""
    supabase = get_supabase()
    
    # Get event by code
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event_id = event_result.data[0]["id"]
    
    # Get guests
    result = supabase.table("guests").select("*").eq("event_id", event_id).execute()
    
    return result.data


@router.get("/{code}/questions", response_model=list[QuestionResponse])
async def get_event_questions(code: str):
    """Get all questions for an event."""
    supabase = get_supabase()
    
    # Get event by code
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event_id = event_result.data[0]["id"]
    
    # Get questions ordered by order_index
    result = supabase.table("questions").select("*").eq("event_id", event_id).order("order_index").execute()
    
    return result.data


@router.post("/{code}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(code: str, question: QuestionCreate):
    """Add a question to an event."""
    supabase = get_supabase()
    
    # Get event by code
    event_result = supabase.table("events").select("id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event_id = event_result.data[0]["id"]
    
    # Insert question
    result = supabase.table("questions").insert({
        "event_id": event_id,
        "text": question.text,
        "question_type": question.question_type,
        "options": question.options,
        "order_index": question.order_index
    }).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create question"
        )
    
    return result.data[0]


# ==================== Edit/Delete Events & Questions ====================

@router.put("/{code}", response_model=EventResponse)
async def update_event(
    code: str,
    event_update: EventUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an event's details. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select(
        "id, host_user_id, matching_completed"
    ).eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this event"
        )
    
    # Build update data (only include non-None fields)
    update_data = {}
    if event_update.name is not None:
        update_data["name"] = event_update.name
    if event_update.host_name is not None:
        update_data["host_name"] = event_update.host_name
    if event_update.matching_mode is not None:
        if event["matching_completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change matching mode after matching is completed"
            )
        update_data["matching_mode"] = event_update.matching_mode
    if event_update.matches_per_guest is not None:
        if event["matching_completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change matches per guest after matching is completed"
            )
        update_data["matches_per_guest"] = event_update.matches_per_guest
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = supabase.table("events").update(update_data).eq("id", event["id"]).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event"
        )
    
    return result.data[0]


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    code: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an event and all associated data. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select(
        "id, host_user_id"
    ).eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this event"
        )
    
    # Delete event (cascades to guests, questions, responses, matches)
    supabase.table("events").delete().eq("id", event["id"]).execute()
    
    return None


@router.put("/{code}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    code: str,
    question_id: str,
    question_update: QuestionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a question. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select(
        "id, host_user_id"
    ).eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit questions for this event"
        )
    
    # Verify question exists and belongs to this event
    question_result = supabase.table("questions").select("id, event_id").eq("id", question_id).execute()
    
    if not question_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    if question_result.data[0]["event_id"] != event["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Question does not belong to this event"
        )
    
    # Build update data
    update_data = {}
    if question_update.text is not None:
        update_data["text"] = question_update.text
    if question_update.options is not None:
        update_data["options"] = question_update.options
    if question_update.order_index is not None:
        update_data["order_index"] = question_update.order_index
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    result = supabase.table("questions").update(update_data).eq("id", question_id).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update question"
        )
    
    return result.data[0]


@router.delete("/{code}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    code: str,
    question_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a question. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select(
        "id, host_user_id"
    ).eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete questions for this event"
        )
    
    # Verify question exists and belongs to this event
    question_result = supabase.table("questions").select("id, event_id").eq("id", question_id).execute()
    
    if not question_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    if question_result.data[0]["event_id"] != event["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Question does not belong to this event"
        )
    
    # Delete question (cascades to responses)
    supabase.table("questions").delete().eq("id", question_id).execute()
    
    return None
