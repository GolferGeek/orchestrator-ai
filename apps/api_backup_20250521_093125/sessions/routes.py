# apps/api/sessions/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client as SupabaseClient, PostgrestAPIError
from typing import List
import logging
from uuid import UUID

from ..auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user
from ..auth.schemas import SupabaseAuthUser # To get current user's ID
from .schemas import SessionCreate, SessionResponse, SessionListResponse, MessageResponse, MessageListResponse

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/sessions",
    tags=["Chat Sessions"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", summary="Create a new chat session", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_in: SessionCreate,
    current_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
    supabase_client: SupabaseClient = Depends(get_supabase_client_as_current_user)
):
    logger.info(f"create_session: Attempting to create session for user {current_user.id} with client instance {id(supabase_client)}.")
    try:
        session_data = {
            "user_id": str(current_user.id),
            "name": session_in.name
        }
        response = supabase_client.table("sessions").insert(session_data).execute()
        
        if not response.data:
            logger.error(f"Failed to create session for user {current_user.id}. Response: {response}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not create chat session.")
        
        return SessionResponse(**response.data[0])
    except PostgrestAPIError as e:
        logger.error(f"Supabase error creating session for user {current_user.id}: {e.message}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message or "Error creating session.")
    except Exception as e:
        logger.error(f"Unexpected error creating session for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/", summary="List chat sessions for the current user", response_model=SessionListResponse)
async def list_sessions(
    current_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
    supabase_client: SupabaseClient = Depends(get_supabase_client_as_current_user),
    skip: int = 0,
    limit: int = 100 # Add basic pagination
):
    try:
        # Fetch sessions ordered by updated_at descending
        response = (
            supabase_client.table("sessions")
            .select("*", count='exact') # Request count for pagination
            .eq("user_id", str(current_user.id))
            .order("updated_at", desc=True)
            .range(skip, skip + limit - 1)
            .execute()
        )
        
        if response.data is None: # Can be None on error or if data is not an array
            logger.warning(f"No session data returned for user {current_user.id}, response: {response}")
            # Consider if PostgrestAPIError would be raised first
            # If data is None but no error, it implies empty list but count should be 0
            # For now, treat as empty if no explicit error
            fetched_sessions = []
            total_count = 0
        else:
            fetched_sessions = [SessionResponse(**s) for s in response.data]
            total_count = response.count if response.count is not None else len(fetched_sessions)

        return SessionListResponse(sessions=fetched_sessions, count=total_count)
        
    except PostgrestAPIError as e:
        logger.error(f"Supabase error listing sessions for user {current_user.id}: {e.message}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message or "Error listing sessions.")
    except Exception as e:
        logger.error(f"Unexpected error listing sessions for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/{session_id}", summary="Get a specific chat session", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    current_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
    supabase_client: SupabaseClient = Depends(get_supabase_client_as_current_user)
):
    try:
        response = (
            supabase_client.table("sessions")
            .select("*")
            .eq("id", str(session_id))
            .eq("user_id", str(current_user.id)) # Ensure user owns the session
            .single() # Expects a single row or raises an error if not found/multiple
            .execute()
        )

        if not response.data:
            # This case might be hit if .single() doesn't find a match and doesn't raise PostgrestAPIError for it.
            # Or if RLS prevents access and returns empty data instead of 401/403 directly from Postgrest.
            logger.warning(f"Session {session_id} not found for user {current_user.id} or access denied. Response: {response}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or access denied.")

        return SessionResponse(**response.data)
        
    except PostgrestAPIError as e:
        # Handle cases where .single() might raise an error if >1 row found (shouldn't happen with PK)
        # or other DB related errors.
        logger.error(f"Supabase error getting session {session_id} for user {current_user.id}: {e.message}", exc_info=True)
        if "PGRST116" in str(e.message): # PGRST116: Row count mismatch for single() - not found
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message or "Error getting session.")
    except Exception as e:
        logger.error(f"Unexpected error getting session {session_id} for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

@router.get("/{session_id}/messages", summary="List messages for a specific chat session", response_model=MessageListResponse)
async def list_session_messages(
    session_id: UUID,
    current_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
    supabase_client: SupabaseClient = Depends(get_supabase_client_as_current_user),
    skip: int = 0, 
    limit: int = 50 # Default limit for messages
):
    try:
        # First, verify the user owns the session (or has access if sharing were implemented)
        session_check = (
            supabase_client.table("sessions")
            .select("id")
            .eq("id", str(session_id))
            .eq("user_id", str(current_user.id))
            .single()
            .execute()
        )
        if not session_check.data:
            logger.warning(f"User {current_user.id} attempted to access messages for session {session_id} they don't own or doesn't exist.")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or access denied.")

        # Fetch messages for the session, ordered by the 'order' field (or timestamp)
        response = (
            supabase_client.table("messages")
            .select("*", count='exact') # Request total count for pagination
            .eq("session_id", str(session_id))
            # .eq("user_id", str(current_user.id)) # RLS policy on messages table should handle this
            .order("order", desc=False) # Assuming 'order' is an auto-incrementing field for sequence
            .range(skip, skip + limit - 1)
            .execute()
        )

        if response.data is None:
            fetched_messages = []
            total_count = 0
        else:
            fetched_messages = [MessageResponse(**m) for m in response.data]
            total_count = response.count if response.count is not None else len(fetched_messages)

        return MessageListResponse(
            messages=fetched_messages, 
            session_id=session_id, 
            count=total_count, 
            skip=skip, 
            limit=limit
        )

    except PostgrestAPIError as e:
        logger.error(f"Supabase error listing messages for session {session_id}, user {current_user.id}: {e.message}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message or "Error listing messages.")
    except Exception as e:
        logger.error(f"Unexpected error listing messages for session {session_id}, user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred while listing messages.") 