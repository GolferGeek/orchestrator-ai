from supabase import create_client, Client
from typing import Optional
import logging # Import logging

from fastapi import Depends, HTTPException, status # Import FastAPI specific modules
from fastapi.security import OAuth2PasswordBearer # Added for oauth2_scheme

from ..core.config import settings # To access SUPABASE_URL and keys
from ..shared.auth_utils import oauth2_scheme  # Import oauth2_scheme from shared module

logger = logging.getLogger(__name__) # Create a logger instance

def get_supabase_client() -> Optional[Client]:
    """
    Creates and returns a Supabase client instance using credentials from settings.
    This client uses the ANON_KEY and is suitable for most operations
    that will respect RLS policies.
    """
    if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
        try:
            logger.info(f"Attempting to create Supabase client for URL: {settings.SUPABASE_URL[:20]}...") # Log URL prefix
            client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
            logger.info("Supabase client (anon key) created successfully.")
            return client
        except Exception as e:
            logger.error(f"Error creating Supabase anon client: {e}", exc_info=True)
            return None
    else:
        logger.warning("Supabase URL or Anon Key not configured. Cannot create Supabase anon client.")
        return None

def get_supabase_service_client() -> Optional[Client]:
    """
    Creates and returns a Supabase client instance using the SERVICE_ROLE_KEY.
    This client bypasses RLS and should be used with extreme caution for
    admin-level operations or backend-only tasks where RLS bypass is necessary.
    """
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            logger.info(f"Attempting to create Supabase service client for URL: {settings.SUPABASE_URL[:20]}...") # Log URL prefix
            client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            logger.info("Supabase service client (service role key) created successfully.")
            return client
        except Exception as e:
            logger.error(f"Error creating Supabase service client: {e}", exc_info=True)
            return None
    else:
        logger.warning("Supabase URL or Service Role Key not configured. Cannot create Supabase service client.")
        return None

async def get_anon_supabase_client( # NEW simple dependency
    client: Optional[Client] = Depends(get_supabase_client) # Uses the most basic client factory
) -> Client:
    """Provides a basic, anonymous Supabase client. Does not check for tokens."""
    print("[DB_GET_ANON_CLIENT] Entering get_anon_supabase_client.") # DEBUG PRINT
    if client is None:
        logger.error("Base Supabase client (anon) for get_anon_supabase_client is not available.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase base client is not available. Check server configuration.",
        )
    print(f"[DB_GET_ANON_CLIENT] Returning client instance {id(client)}.") # DEBUG PRINT
    return client

# FastAPI dependency providers
async def get_current_supabase_client(
    token: Optional[str] = Depends(oauth2_scheme),
    base_client: Client = Depends(get_supabase_client)
) -> Client:
    print(f"[DB_GET_CLIENT] Entering get_current_supabase_client. Token is present: {True if token else False}")
    if base_client is None:
        logger.error("Base Supabase client (anon) is not available.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not available. Check server configuration.",
        )

    if token:
        try:
            user_response = base_client.auth.get_user(token)
            if not user_response or not user_response.user:
                logger.warning(f"Token provided but could not validate or find user via get_user. Token: {token[:20]}...")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token provided.",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            logger.info(f"Supabase client instance {id(base_client)} session configured for user: {user_response.user.id} via get_user. Client will now act as this user.")
            return base_client
        except Exception as e:
            logger.error(f"Error during get_user in get_current_supabase_client: {e}. Token: {token[:20]}...", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate token for Supabase client.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    else:
        logger.info("No token provided to get_current_supabase_client, returning anon client.")
        return base_client

async def get_current_supabase_service_client(client: Optional[Client] = Depends(get_supabase_service_client)) -> Client:
    if client is None:
        logger.error("Supabase service client is not available. This might be due to missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase service client is not available. Check server configuration.",
        )
    return client 