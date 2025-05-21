# apps/api/auth/dependencies.py
import logging
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from supabase import Client as SupabaseClient
# from supabase.lib.errors import GotrueApiError as GotrueAPIError # Old path
from gotrue.errors import AuthApiError # Corrected import and class name
from typing import Optional
import uuid # ADDED for test user ID
from datetime import datetime, timezone # ADDED for test user fields

from ..core.db import get_current_supabase_client
from ..core.config import settings # ADDED for new client creation
from supabase import create_client # ADDED for new client creation
from .schemas import SupabaseAuthUser # Using the more detailed SupabaseAuthUser

logger = logging.getLogger(__name__)

TEST_API_KEY_HEADER = "X-Test-Api-Key"
# Define a fixed UUID for the test user authenticated via API key
TEST_USER_ID_FOR_API_KEY_AUTH = uuid.UUID("00000000-0000-0000-0000-000000000001") 

# tokenUrl should point to your login endpoint where the client obtains the token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False) 

async def get_current_authenticated_user(
    request: Request, # ADDED request to access headers
    token: Optional[str] = Depends(oauth2_scheme), # Token is now Optional
    supabase_client: SupabaseClient = Depends(get_current_supabase_client)
) -> SupabaseAuthUser:
    # API Key Authentication (for testing or trusted services)
    if settings.TEST_API_SECRET_KEY:
        test_api_key = request.headers.get(TEST_API_KEY_HEADER)
        if test_api_key and test_api_key == settings.TEST_API_SECRET_KEY:
            logger.info(f"Authenticated via Test API Key as user {TEST_USER_ID_FOR_API_KEY_AUTH}")
            # Return a mock/predefined SupabaseAuthUser for the test API key user
            return SupabaseAuthUser(
                id=TEST_USER_ID_FOR_API_KEY_AUTH,
                aud="authenticated",
                role="authenticated", # Or a special test role if needed
                email="test_api_key_user@example.com",
                email_confirmed_at=datetime.now(timezone.utc),
                confirmed_at=datetime.now(timezone.utc),
                last_sign_in_at=datetime.now(timezone.utc),
                app_metadata={ "provider": "api_key", "providers": ["api_key"] },
                user_metadata={ "name": "Test API Key User" },
                identities=[],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

    # JWT Token Authentication (existing logic)
    if not token:
        logger.warning("No JWT token provided and Test API Key authentication failed or not configured.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # get_user() automatically verifies the JWT against Supabase Auth.
        # If the token is invalid or expired, it will raise an error.
        response = supabase_client.auth.get_user(token)
        # logger.debug(f"Supabase get_user response: {response}")
        if response and response.user:
            # The user object from supabase-py is already Pydantic-like
            # We can directly parse it into our SupabaseAuthUser model for validation and type hinting.
            return SupabaseAuthUser.model_validate(response.user.model_dump())
        else:
            logger.warning(f"get_user did not return a user. Token: {token[:20]}...")
            raise credentials_exception
            
    except AuthApiError as e: # Corrected exception type
        logger.warning(f"Supabase auth error (AuthApiError) during token validation: {e}. Token: {token[:20]}...")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error during token validation: {e}. Token: {token[:20]}...", exc_info=True)
        raise credentials_exception

async def get_supabase_client_as_current_user(
    token: str = Depends(oauth2_scheme)
    # REMOVED: base_supabase_client: SupabaseClient = Depends(get_current_supabase_client)
) -> SupabaseClient:
    logger.info(f"Entering get_supabase_client_as_current_user. Token received: {'yes' if token else 'no'}.")
    """
    Provides a Supabase client instance that is authenticated as the current user.
    Creates a NEW client instance and configures it with the user's auth.
    """
    if not (settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY):
        logger.error("get_supabase_client_as_current_user: Supabase URL or Anon Key not configured in settings.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication service configuration error.")

    new_client: SupabaseClient = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    logger.info(f"get_supabase_client_as_current_user: Created new client instance {id(new_client)} to authenticate with token.")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired for Supabase client session.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_response = new_client.auth.get_user(token)
        if not user_response or not user_response.user:
            logger.warning(f"get_supabase_client_as_current_user: No user found for token on new client. Token: {token[:20]}...")
            raise credentials_exception
        
        # Explicitly try to set the session on the auth client using the validated token
        try:
            # The refresh_token is not strictly needed if we only make calls with this access_token before it expires.
            # Some libraries might require a non-null refresh_token here, even if it's a dummy one.
            new_client.auth.set_session(access_token=token, refresh_token="dummy_refresh_token_not_used_for_this_test")
            logger.info(f"Called new_client.auth.set_session() for user {user_response.user.id} on client {id(new_client)}.")
        except Exception as set_session_exc:
            logger.error(f"Error calling new_client.auth.set_session(): {set_session_exc}", exc_info=True)
            # Decide if this should be fatal or if we proceed with just get_user having been called.
            # For this test, let's proceed but log it as an error.

        logger.info(f"New Supabase client instance {id(new_client)} is now authenticated as user {user_response.user.id} (after get_user and attempting set_session)")
        return new_client # Return the new, user-authenticated client instance
    except AuthApiError as e:
        logger.warning(f"get_supabase_client_as_current_user: Supabase auth error on new client: {e}. Token: {token[:20]}...")
        raise credentials_exception
    except Exception as e:
        logger.error(f"get_supabase_client_as_current_user: Unexpected error on new client: {e}. Token: {token[:20]}...", exc_info=True)
        raise credentials_exception

# Example of a dependency that would fetch full profile from public.users table
# from .schemas import UserResponse # Assuming UserResponse is for public.users data
# 
# async def get_current_user_profile(
#     current_auth_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
#     supabase_client: SupabaseClient = Depends(get_current_supabase_client)
# ) -> UserResponse: 
#     try:
#         response = supabase_client.table("users").select("*").eq("id", str(current_auth_user.id)).single().execute()
#         if not response.data:
#             logger.warning(f"No public user profile found for auth user id: {current_auth_user.id}")
#             raise HTTPException(status_code=404, detail="User profile not found in public.users table.")
#         return UserResponse(**response.data)
#     except GotrueAPIError as e:
#         logger.error(f"Supabase error fetching user profile for {current_auth_user.id}: {e}")
#         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not fetch user profile.")
#     except Exception as e:
#         logger.error(f"Unexpected error fetching user profile for {current_auth_user.id}: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail="Internal server error fetching user profile.") 