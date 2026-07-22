import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_supabase_client: Client = None

def get_supabase_client() -> Client:
    """
    Get the globally initialized Supabase client, or initialize it on-demand.
    Raises RuntimeError if credentials are missing or initialization fails.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
        
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_ANON_KEY", "")
    if not url or not key:
        raise RuntimeError("Supabase credentials missing from environment (SUPABASE_URL, SUPABASE_ANON_KEY).")
        
    try:
        _supabase_client = create_client(url, key)
        return _supabase_client
    except Exception as e:
        raise RuntimeError(f"Failed to initialize Supabase client: {e}") from e

# Backward-compatible global variable reference
supabase_client: Client = None
try:
    supabase_client = get_supabase_client()
except Exception as e:
    print(f"Warning: Supabase client initialization failed: {e}")
