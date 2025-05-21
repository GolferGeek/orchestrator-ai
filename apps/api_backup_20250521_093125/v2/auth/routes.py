# apps/api/auth/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client as SupabaseClient
from gotrue.errors import AuthApiError # Corrected import
from typing import Any # For diverse response types initially
import logging
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__) # ADDED: Initialize logger

# Assuming db.py is in apps/api/core/
from ..core.db import get_current_supabase_client, get_anon_supabase_client # MODIFIED: Added get_anon_supabase_client
from .dependencies import get_current_authenticated_user # Corrected import
# from ..core.db import get_current_supabase_service_client

# Placeholder for Pydantic models (schemas.py)
from .schemas import UserCreate, UserResponse, UserLogin, TokenResponse, SupabaseAuthUser, AuthenticatedUserResponse # Import necessary schemas

router = APIRouter(
    tags=["Authentication"],
    responses={404: {"description": "Not found"}},
)

@router.post("/signup", summary="Create new user and return session token", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_in: UserCreate,
    supabase_client: SupabaseClient = Depends(get_anon_supabase_client) # MODIFIED: Use get_anon_supabase_client
):
    print(f"[AUTH_SIGNUP_ROUTE] /auth/signup hit. Email: {user_in.email}. Using Supabase client: {id(supabase_client)}") # DEBUG PRINT
    try:
        # Create user in Supabase Auth
        auth_response = supabase_client.auth.sign_up({
            "email": user_in.email,
            "password": user_in.password,
            "options": {
                "data": { # This data goes into user_metadata in auth.users
                    'display_name': user_in.display_name if user_in.display_name else user_in.email.split('@')[0]
                }
            }
        })

        # The trigger on auth.users should populate public.users table automatically.
        # We rely on this for any subsequent profile fetches.

        if auth_response.user and auth_response.session and auth_response.session.access_token:
            # User created and session is available (e.g., email confirmation disabled or auto-confirmed by Supabase settings)
            return TokenResponse(
                access_token=auth_response.session.access_token,
                refresh_token=auth_response.session.refresh_token,
                token_type="bearer",
                expires_in=auth_response.session.expires_in if hasattr(auth_response.session, 'expires_in') else None # Corrected to auth_response
            )
        elif auth_response.user and not auth_response.session:
            # User created, but no session returned - typically means email confirmation is required.
            # Cannot return JWT as requested without a session.
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED, # 202 Accepted: request accepted, processing not complete (email confirmation)
                detail="User created successfully. Please check your email to confirm your account before logging in."
            )
        else:
            # Unexpected response from Supabase sign_up
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create user or establish session.")

    except AuthApiError as e:
        # Handle specific Supabase errors, e.g., user already exists
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message or "Error during signup. User might already exist or invalid input."
        )
    except Exception as e:
        # Log e for server-side debugging (ensure you have logging configured)
        # logger.error(f"Unexpected error during signup: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during signup."
        )

@router.post("/login", summary="User login", response_model=TokenResponse) 
async def login(
    login_data: UserLogin, 
    supabase_client: SupabaseClient = Depends(get_anon_supabase_client) # MODIFIED: Use get_anon_supabase_client
):
    print(f"[AUTH_LOGIN_ROUTE_STEP3] /auth/login hit. Email: {login_data.email}. Using Supabase client: {id(supabase_client)}") # DEBUG PRINT (STEP3)
    try:
        response = supabase_client.auth.sign_in_with_password({
            "email": login_data.email,
            "password": login_data.password
        })
        
        if not response.session or not response.session.access_token:
            logger.error(f"Login attempt for {login_data.email} with client {id(supabase_client)} succeeded but response lacked session/token.")
            print(f"[AUTH_LOGIN_ROUTE_STEP2] Login for {login_data.email} SUCCEEDED (client {id(supabase_client)}) but response lacked session/token.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Login succeeded but no session or token received.")

        print(f"[AUTH_LOGIN_ROUTE_STEP2] Login for {login_data.email} successful with client {id(supabase_client)}, token obtained.")
        return TokenResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            token_type="bearer",
            expires_in=response.session.expires_in
        )
    except AuthApiError as e:
        print(f"[AUTH_LOGIN_ROUTE_STEP2] AuthApiError caught for {login_data.email} with client {id(supabase_client)}. Status: {getattr(e, 'status', 'N/A')}, Message: '{e.message}'")
        logger.error(f"AuthApiError during login for {login_data.email} (client {id(supabase_client)}): Status={getattr(e, 'status', 'N/A')}, Message='{e.message}'")
        raise HTTPException(
            status_code=getattr(e, 'status', 400), # Use status from error if available, else 400
            detail=e.message or "Invalid login credentials."
        )
    except Exception as e:
        print(f"[AUTH_LOGIN_ROUTE_STEP2] Generic Exception caught for {login_data.email} with client {id(supabase_client)}: {type(e).__name__} - {str(e)}")
        logger.error(f"Unexpected error during login for {login_data.email} (client {id(supabase_client)}): {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during login: {str(e)}"
        )

@router.post("/logout", summary="User logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    supabase_client: SupabaseClient = Depends(get_current_supabase_client),
    # The token is implicitly handled by get_current_authenticated_user if we need to ensure this is an authenticated action.
    # However, sign_out itself just needs the current session's token which the client should have.
    # For a stateless JWT approach, the client just discards the token.
    # Supabase sign_out invalidates the refresh token and potentially the access token on the server-side.
    # We need the access token to tell Supabase which user's session to invalidate.
    current_user: SupabaseAuthUser = Depends(get_current_authenticated_user) # Ensures an authenticated user is making the call
):
    try:
        # The JWT used for `get_current_authenticated_user` is the one to invalidate.
        # The `supabase_client` is already configured with this token by Supabase internally
        # if it was set using `set_session` after login. Or, `auth.sign_out` uses the global user context if set.
        # To be explicit and ensure the correct user's session is signed out based on the provided token:
        # We need to pass the token that was used for authentication to sign_out if the client handles tokens globally.
        # However, the `get_current_authenticated_user` already used the token from the header.
        # The supabase client instance injected *might* not be automatically scoped with this token for sign_out.
        # Let's ensure we pass the token used by the current_user dependency. 
        # This typically means the client (frontend) needs to have called set_session with the access token.
        # If sign_out is called without a specific token, it signs out the "current global user" for the client instance.
        # To be safe and specific, we get the token from the dependency.
        
        # The `get_current_authenticated_user` dependency already has the token via `oauth2_scheme`.
        # We need to pass this token to `sign_out` explicitly. This is tricky because the dependency
        # itself consumes the token and doesn't return it separately in this design. 
        # A common way is for client to call `supabase.auth.sign_out()` directly with its stored token.
        # If backend must do it, it must have the token.
        # For now, assuming client set the session on the supabase_client instance that `get_current_supabase_client` provides,
        # or that sign_out works on the currently authenticated user for that client instance.
        
        # The supabase-py library handles the token context internally for the auth client instance.
        # Once `auth.get_user(token)` (inside `get_current_authenticated_user`) succeeds, the client
        # instance associated with `supabase_client.auth` is aware of this authenticated user and their token.
        # So, a subsequent `supabase_client.auth.sign_out()` should work for that user.

        error = supabase_client.auth.sign_out()
        if error:
            # Log the error if any, though sign_out often doesn't return substantive error for already invalid session
            # print(f"Error during sign_out: {error}") # Supabase sign_out usually returns None on success
            # GotrueAPIResponse has no error attribute directly usually, it raises GotrueAPIError
            # This path might not be typically hit if using try/except GotrueAPIError
            pass # No specific error content to return on 204
        
        # No content is returned on successful logout as per HTTP 204
        return

    except AuthApiError as e:
        # This might happen if the session is already invalid, but we still want to signal success to client
        # or if there's another issue with the sign-out process.
        # Depending on the exact error, we might still return 204 or a specific error.
        # For simplicity, if sign_out raises an auth error, we can consider it an issue.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.message or "Error during logout."
        )
    except Exception as e:
        # logger.error(f"Unexpected error during logout: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during logout."
        )

@router.get("/me", summary="Get current user details", response_model=AuthenticatedUserResponse)
async def read_users_me(
    current_auth_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
    supabase_client: SupabaseClient = Depends(get_current_supabase_client) # For fetching from public.users
):
    # current_auth_user is the user object directly from Supabase Auth (id, email, etc.)
    # We now fetch additional profile information from our public.users table.
    try:
        response = supabase_client.table("users").select("id, email, display_name, created_at").eq("id", str(current_auth_user.id)).single().execute()
        
        if response.data:
            # Combine auth user data with public profile data
            return AuthenticatedUserResponse(
                id=current_auth_user.id,
                email=current_auth_user.email, # Email from auth is authoritative
                display_name=response.data.get("display_name"),
                # created_at can be from auth_user or public.users, decide on source of truth
                # For now, let's assume public.users.created_at is what we want for the profile
            )
        else:
            # This case should ideally not happen if the handle_new_user trigger works correctly.
            # However, as a fallback, return basic info from the auth user.
            return AuthenticatedUserResponse(
                id=current_auth_user.id,
                email=current_auth_user.email,
                display_name=current_auth_user.user_metadata.get('display_name') if current_auth_user.user_metadata else None
            )
            
    except AuthApiError as e: # Should not happen here as get_current_authenticated_user handles auth
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Auth error fetching profile: {e.message}")
    except Exception as e:
        # logger.error(f"Error fetching user profile for {current_auth_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not fetch user profile.")

# This router needs to be included in the main FastAPI app (apps/api/main.py) 