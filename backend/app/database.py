from supabase import create_client, Client
from .config import get_settings


def get_supabase() -> Client:
    """Get Supabase client instance."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)
