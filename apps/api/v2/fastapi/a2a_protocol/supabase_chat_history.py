# apps/api/a2a_protocol/supabase_chat_history.py
import logging
from typing import List, Optional, Dict, Any
from uuid import UUID

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, message_to_dict, messages_from_dict, AIMessage, HumanMessage
from supabase import Client as SupabaseClient

logger = logging.getLogger(__name__)

class SupabaseChatMessageHistory(BaseChatMessageHistory):
    """
    Chat message history stored in a Supabase PostgREST table.

    Args:
        supabase_client: The Supabase client instance.
        session_id: The unique identifier for the chat session.
        user_id: The unique identifier for the user owning the session.
        table_name: The name of the table to store messages (defaults to "messages").
    """

    def __init__(
        self,
        supabase_client: SupabaseClient,
        session_id: str, # Keep as str for direct use in Supabase client, can be UUID internally
        user_id: str,    # Keep as str for direct use
        table_name: str = "messages",
    ):
        self.client = supabase_client
        self.session_id = session_id
        self.user_id = user_id # Important for RLS and associating messages correctly
        self.table_name = table_name
        # Ensure user_id is a string UUID for Supabase client if it comes as UUID object
        if isinstance(self.user_id, UUID):
            self.user_id = str(self.user_id)
        if isinstance(self.session_id, UUID):
            self.session_id = str(self.session_id)

    @property
    def messages(self) -> List[BaseMessage]:  # This remains for sync compatibility if needed
        """Retrieve messages from Supabase. Call from sync code only if client is sync."""
        logger.warning("Synchronous .messages property called on SupabaseChatMessageHistory. Ensure Supabase client is synchronous or use aget_messages.")
        # This sync version will fail if self.client.execute() is a coroutine.
        # For a truly async client, this property should not be used directly by async code.
        try:
            # This assumes self.client.execute() is synchronous or patched to be in tests.
            response = (
                self.client.table(self.table_name)
                .select("role, content, metadata")
                .eq("session_id", self.session_id)
                .order("order", desc=False)
                .execute()
            )
            if hasattr(response, 'data') and response.data:
                raw_messages = []
                role_to_lc_type_mapping = {
                    "user": "human", "assistant": "ai", "system": "system", "tool": "tool"
                }
                for item in response.data:
                    lc_type = role_to_lc_type_mapping.get(item.get("role"), "ai")
                    message_data_for_lc = {
                        "content": item.get("content", ""),
                        "additional_kwargs": item.get("metadata", {}) or {}
                    }
                    raw_messages.append({"type": lc_type, "data": message_data_for_lc})
                return messages_from_dict(raw_messages)
            return []
        except Exception as e:
            logger.error(f"Error in sync messages property for session {self.session_id}: {e}", exc_info=True)
            return []

    async def aget_messages(self) -> List[BaseMessage]:
        """Asynchronously retrieve messages from Supabase."""
        logger.debug(f"Asynchronously retrieving messages from Supabase for session {self.session_id}")
        try:
            # The execute() method returns an APIResponse directly, no need to await
            response = (
                self.client.table(self.table_name)
                .select("role, content, metadata")
                .eq("session_id", self.session_id)
                .order("order", desc=False)
                .execute()
            )
            
            # Check if the response object has a 'data' attribute, common for Supabase clients
            if hasattr(response, 'data') and response.data:
                raw_messages = []
                role_to_lc_type_mapping = {
                    "user": "human",
                    "assistant": "ai",
                    "system": "system",
                    "tool": "tool"
                }
                for item in response.data:
                    lc_type = role_to_lc_type_mapping.get(item.get("role"), "ai")
                    message_data_for_lc = {
                        "content": item.get("content", ""),
                        "additional_kwargs": item.get("metadata", {}) or {}
                    }
                    raw_messages.append({"type": lc_type, "data": message_data_for_lc})
                return messages_from_dict(raw_messages)
            else:
                # Handle cases where response might not have .data or it's empty
                logger.info(f"No messages data found or unexpected response format for session {self.session_id}. Response: {response}")
                return []
        except Exception as e:
            logger.error(f"Error asynchronously retrieving messages for session {self.session_id}: {e}", exc_info=True)
            return []

    async def aadd_message(self, message: BaseMessage) -> None:
        """Asynchronously append a message to the Supabase table."""
        logger.debug(f"Asynchronously adding message to Supabase for session {self.session_id}, user {self.user_id}")
        try:
            message_content = message.content if hasattr(message, 'content') else ""
            role_mapping = {
                "human": "user", "ai": "assistant", "system": "system", 
                "chat": "assistant", "function": "tool", "tool": "tool"
            }
            mapped_role = role_mapping.get(message.type, "assistant")

            message_to_insert: Dict[str, Any] = {
                "session_id": self.session_id,
                "user_id": self.user_id,
                "role": mapped_role,
                "content": message_content,
            }
            if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
                message_to_insert['metadata'] = message.additional_kwargs
            
            # The execute() method returns an APIResponse directly, no need to await
            response = (
                self.client.table(self.table_name)
                .insert(message_to_insert)
                .execute()
            )
            if hasattr(response, 'data') and response.data:
                logger.info(f"Message added successfully via aadd_message to session {self.session_id}.")
            elif hasattr(response, 'error') and response.error:
                 logger.error(f"Failed to add message via aadd_message for session {self.session_id}. Error: {response.error}")
            else:
                logger.warning(f"Message add via aadd_message for session {self.session_id} did not return data or error. Response: {response}")

        except Exception as e:
            logger.error(f"Error in aadd_message for session {self.session_id}: {e}", exc_info=True)

    # add_message (sync) remains for compatibility, but warns if client seems async
    def add_message(self, message: BaseMessage) -> None:
        logger.warning("Synchronous .add_message called on SupabaseChatMessageHistory. Ensure Supabase client is synchronous or use aadd_message.")
        # Simplified sync version, will fail if self.client.execute() is a coroutine.
        try:
            message_content = message.content if hasattr(message, 'content') else ""
            role_mapping = {
                "human": "user", "ai": "assistant", "system": "system", 
                "chat": "assistant", "function": "tool", "tool": "tool"
            }
            mapped_role = role_mapping.get(message.type, "assistant")
            message_to_insert: Dict[str, Any] = {
                "session_id": self.session_id,
                "user_id": self.user_id,
                "role": mapped_role,
                "content": message_content,
            }
            if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
                message_to_insert['metadata'] = message.additional_kwargs
            
            self.client.table(self.table_name).insert(message_to_insert).execute() # Assumes sync client
        except Exception as e:
            logger.error(f"Error in sync add_message for session {self.session_id}: {e}", exc_info=True)

    async def aclear(self) -> None:
        """Asynchronously clear all messages."""
        logger.debug(f"Asynchronously clearing messages for session {self.session_id}")
        try:
            # The execute() method returns an APIResponse directly, no need to await
            response = (
                self.client.table(self.table_name)
                .delete()
                .eq("session_id", self.session_id)
                .execute()
            )
            if hasattr(response, 'data'):
                logger.info(f"Successfully cleared messages for session {self.session_id}.")
            elif hasattr(response, 'error') and response.error:
                logger.error(f"Failed to clear messages for session {self.session_id}. Error: {response.error}")
            else:
                logger.warning(f"Clear operation for session {self.session_id} did not return data or error. Response: {response}")
        except Exception as e:
            logger.error(f"Error in aclear for session {self.session_id}: {e}", exc_info=True)

    def clear(self) -> None:
        logger.warning("Synchronous .clear called on SupabaseChatMessageHistory. Ensure Supabase client is synchronous or use aclear.")
        try:
            self.client.table(self.table_name).delete().eq("session_id", self.session_id).execute()
        except Exception as e:
            logger.error(f"Error in sync clear for session {self.session_id}: {e}", exc_info=True)

    # Helper methods for fetching, inserting, deleting will be added below

    # def _fetch_messages(self) -> List[dict]:
    #     """Fetches all messages for the current session_id from Supabase."""
    #     # ... implementation using self.client ...
    #     pass

    # def _insert_message(self, message_dict: dict) -> None:
    #     """Inserts a single message into the Supabase table."""
    #     # ... implementation including self.session_id and self.user_id ...
    #     pass

    # def _delete_messages(self) -> None:
    #     """Deletes all messages for the current session_id from Supabase."""
    #     # ... implementation ...
    #     pass 