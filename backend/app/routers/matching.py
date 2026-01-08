"""Matching router for running the matching algorithm and managing matches."""

from fastapi import APIRouter, HTTPException, status, Depends
from ..models import MatchResult
from ..database import get_supabase
from ..auth import get_current_user, verify_event_ownership
from itertools import combinations

router = APIRouter(prefix="/events", tags=["matching"])


def calculate_similarity(responses_a: dict, responses_b: dict) -> float:
    """
    Calculate similarity score between two guests based on their responses.
    Returns a score from 0.0 to 1.0.
    """
    if not responses_a or not responses_b:
        return 0.0
    
    # Find common questions
    common_questions = set(responses_a.keys()) & set(responses_b.keys())
    
    if not common_questions:
        return 0.0
    
    # Calculate match score
    matches = sum(1 for q in common_questions if responses_a[q] == responses_b[q])
    
    return matches / len(common_questions)


@router.post("/{code}/match", status_code=status.HTTP_200_OK)
async def run_matching(code: str, current_user: dict = Depends(get_current_user)):
    """
    Run the matching algorithm for an event.
    Respects matching_mode and matches_per_guest settings.
    Host only.
    """
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select(
        "id, host_user_id, matching_completed, matching_mode, matches_per_guest"
    ).eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    matching_mode = event.get("matching_mode", "any")
    matches_per_guest = event.get("matches_per_guest", 1)
    
    if event.get("host_user_id") and event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can run matching"
        )
    
    # Get all guests for this event (including profile info)
    guests_result = supabase.table("guests").select(
        "id, nickname, gender, looking_for"
    ).eq("event_id", event["id"]).execute()
    guests = guests_result.data
    
    if len(guests) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Need at least 2 guests to run matching"
        )
    
    # Get all responses for this event's guests
    guest_ids = [g["id"] for g in guests]
    responses_result = supabase.table("responses").select(
        "guest_id, question_id, answer"
    ).in_("guest_id", guest_ids).execute()
    
    # Organize responses by guest
    guest_responses = {}
    guest_by_id = {}
    for guest in guests:
        guest_responses[guest["id"]] = {}
        guest_by_id[guest["id"]] = guest
    
    for response in responses_result.data:
        guest_id = response["guest_id"]
        if guest_id in guest_responses:
            guest_responses[guest_id][response["question_id"]] = response["answer"]
    
    def is_compatible(guest_a: dict, guest_b: dict) -> bool:
        """Check if two guests are compatible based on preferences."""
        if matching_mode != "preference_based":
            return True
        
        a_looking = guest_a.get("looking_for", "any")
        b_looking = guest_b.get("looking_for", "any")
        a_gender = guest_a.get("gender")
        b_gender = guest_b.get("gender")
        
        # Check if A is looking for B's gender
        a_matches_b = a_looking == "any" or a_looking == b_gender
        # Check if B is looking for A's gender  
        b_matches_a = b_looking == "any" or b_looking == a_gender
        
        return a_matches_b and b_matches_a
    
    # Calculate all pairwise similarities (only for compatible pairs)
    similarities = {}
    for guest_a, guest_b in combinations(guests, 2):
        if is_compatible(guest_a, guest_b):
            score = calculate_similarity(
                guest_responses[guest_a["id"]],
                guest_responses[guest_b["id"]]
            )
            similarities[(guest_a["id"], guest_b["id"])] = score
            similarities[(guest_b["id"], guest_a["id"])] = score
    
    # Track how many matches each guest has
    match_count = {g["id"]: 0 for g in guests}
    matches_to_insert = []
    
    # Sort all possible pairs by similarity score
    all_pairs = []
    for guest_a, guest_b in combinations(guests, 2):
        key = (guest_a["id"], guest_b["id"])
        if key in similarities:
            all_pairs.append((guest_a["id"], guest_b["id"], similarities[key]))
    
    all_pairs.sort(key=lambda x: x[2], reverse=True)
    
    # Greedily assign matches respecting matches_per_guest limit
    for guest_a_id, guest_b_id, score in all_pairs:
        if match_count[guest_a_id] < matches_per_guest and match_count[guest_b_id] < matches_per_guest:
            matches_to_insert.append({
                "event_id": event["id"],
                "guest_a_id": guest_a_id,
                "guest_b_id": guest_b_id,
                "score": score,
            })
            match_count[guest_a_id] += 1
            match_count[guest_b_id] += 1
    
    # Clear existing matches for this event
    supabase.table("matches").delete().eq("event_id", event["id"]).execute()
    
    # Insert new matches
    if matches_to_insert:
        supabase.table("matches").insert(matches_to_insert).execute()
    
    # Mark event as matching completed
    supabase.table("events").update({"matching_completed": True}).eq("id", event["id"]).execute()
    
    return {"message": f"Created {len(matches_to_insert)} matches", "matches_count": len(matches_to_insert)}


@router.get("/{code}/matches")
async def get_all_matches(code: str, current_user: dict = Depends(get_current_user)):
    """Get all matches for an event. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select("id, host_user_id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event.get("host_user_id") and event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can view all matches"
        )
    
    # Get matches with guest nicknames
    matches_result = supabase.table("matches").select("*").eq("event_id", event["id"]).execute()
    
    # Get guest nicknames
    guest_ids = []
    for match in matches_result.data:
        guest_ids.extend([match["guest_a_id"], match["guest_b_id"]])
    
    guests_result = supabase.table("guests").select("id, nickname").in_("id", list(set(guest_ids))).execute()
    guest_names = {g["id"]: g["nickname"] for g in guests_result.data}
    
    # Enrich matches with nicknames
    enriched_matches = []
    for match in matches_result.data:
        enriched_matches.append({
            **match,
            "guest_a_nickname": guest_names.get(match["guest_a_id"], "Unknown"),
            "guest_b_nickname": guest_names.get(match["guest_b_id"], "Unknown"),
        })
    
    return enriched_matches


@router.post("/{code}/reveal")
async def reveal_matches(code: str, current_user: dict = Depends(get_current_user)):
    """Reveal matches to guests. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select("id, host_user_id, matching_completed").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event.get("host_user_id") and event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can reveal matches"
        )
    
    if not event.get("matching_completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Run matching first before revealing"
        )
    
    # Update event to reveal matches
    supabase.table("events").update({"matches_revealed": True}).eq("id", event["id"]).execute()
    
    return {"message": "Matches revealed to guests"}


@router.get("/{code}/my-match/{guest_id}")
async def get_my_match(code: str, guest_id: str):
    """Get the match for a specific guest. Only works if matches are revealed."""
    supabase = get_supabase()
    
    # Get event
    event_result = supabase.table("events").select("id, matches_revealed").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if not event.get("matches_revealed"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Matches have not been revealed yet"
        )
    
    # Find match where guest is either guest_a or guest_b
    match_result = supabase.table("matches").select("*").eq("event_id", event["id"]).or_(
        f"guest_a_id.eq.{guest_id},guest_b_id.eq.{guest_id}"
    ).execute()
    
    if not match_result.data:
        return {"match": None, "message": "No match found"}
    
    match = match_result.data[0]
    
    # Get the matched guest's info
    matched_guest_id = match["guest_b_id"] if match["guest_a_id"] == guest_id else match["guest_a_id"]
    
    guest_result = supabase.table("guests").select("id, nickname").eq("id", matched_guest_id).execute()
    
    if not guest_result.data:
        return {"match": None, "message": "Match data unavailable"}
    
    matched_guest = guest_result.data[0]
    
    return {
        "match": {
            "id": matched_guest["id"],
            "nickname": matched_guest["nickname"],
            "score": match["score"],
        }
    }


@router.delete("/{code}/matches/{match_id}")
async def delete_match(code: str, match_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a specific match. Host only. Use to remove problematic pairings."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select("id, host_user_id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event.get("host_user_id") and event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can delete matches"
        )
    
    # Delete the match
    result = supabase.table("matches").delete().eq("id", match_id).eq("event_id", event["id"]).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )
    
    return {"message": "Match deleted successfully"}


@router.post("/{code}/matches/manual")
async def create_manual_match(
    code: str, 
    guest_a_id: str, 
    guest_b_id: str, 
    current_user: dict = Depends(get_current_user)
):
    """Manually create a match between two guests. Host only."""
    supabase = get_supabase()
    
    # Get event and verify ownership
    event_result = supabase.table("events").select("id, host_user_id").eq("code", code.upper()).execute()
    
    if not event_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    event = event_result.data[0]
    
    if event.get("host_user_id") and event["host_user_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can create matches"
        )
    
    # Verify both guests exist and belong to this event
    guests_result = supabase.table("guests").select("id").eq("event_id", event["id"]).in_("id", [guest_a_id, guest_b_id]).execute()
    
    if len(guests_result.data) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid guest IDs"
        )
    
    # Create the match with score 1.0 (host override)
    match_data = {
        "event_id": event["id"],
        "guest_a_id": guest_a_id,
        "guest_b_id": guest_b_id,
        "score": 1.0  # Host-curated match
    }
    
    result = supabase.table("matches").insert(match_data).execute()
    
    return {"message": "Match created successfully", "match": result.data[0] if result.data else None}

