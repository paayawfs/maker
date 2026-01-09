"""Authentication utilities for verifying Supabase JWT tokens."""

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import httpx
from functools import lru_cache
from .config import get_settings

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks_url() -> str:
    """Get the JWKS URL for the Supabase project."""
    settings = get_settings()
    return f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Verify the JWT token and return the user info.
    
    This validates the token against Supabase's JWKS.
    """
    token = credentials.credentials
    settings = get_settings()
    
    try:
        # Verify the JWT signature using Supabase's JWT secret
        decoded = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )
        
        # Get the user ID from the token
        user_id = decoded.get("sub")
        email = decoded.get("email")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        return {
            "id": user_id,
            "email": email,
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )


def verify_event_ownership(event_host_id: str, current_user_id: str) -> bool:
    """Check if the current user owns the event."""
    return event_host_id == current_user_id
