# apps/api/a2a_protocol/supabase_chat_history.py
import logging
from typing import List, Optional
from uuid import UUID

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, message_to_dict, messages_from_dict
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
    def messages(self) -> List[BaseMessage]:  # type: ignore
        """Retrieve messages from Supabase."""
        logger.debug(f"Retrieving messages from Supabase for session {self.session_id}")
        try:
            response = (
                self.client.table(self.table_name)
                .select("role, content, metadata") # Select fields needed for message reconstruction
                                                # 'role' here is our db role: user, assistant, system, tool
                                                # 'content' is the text
                                                # 'metadata' might store additional_kwargs or name for ToolMessage
                .eq("session_id", self.session_id)
                .order("order", desc=False) # Fetch in ascending order of creation
                .execute()
            )
            if response.data:
                # Convert stored dicts back to Langchain BaseMessage objects
                # We need to map our DB role back to Langchain's 'type' for messages_from_dict
                # and structure the dict as Langchain expects: {"type": lc_type, "data": {"content": ..., "additional_kwargs": ...}}
                raw_messages = []
                role_to_lc_type_mapping = {
                    "user": "human",
                    "assistant": "ai",
                    "system": "system",
                    "tool": "tool" # Langchain tool messages also have a 'tool_call_id'
                }
                for item in response.data:
                    lc_type = role_to_lc_type_mapping.get(item.get("role"), "ai") # Default to AI if role is unknown
                    message_data_for_lc = {
                        "content": item.get("content", ""),
                        "additional_kwargs": item.get("metadata", {}) or {} # Ensure it's a dict
                    }
                    # For tool messages, Langchain might expect 'name' or 'tool_call_id' in additional_kwargs or data
                    # If 'name' was stored in metadata for ToolMessage, it should be picked up here.
                    raw_messages.append({"type": lc_type, "data": message_data_for_lc})
                
                return messages_from_dict(raw_messages)
            else:
                logger.info(f"No messages found for session {self.session_id}")
                return []
        except Exception as e:
            logger.error(f"Error retrieving messages from Supabase for session {self.session_id}: {e}", exc_info=True)
            return [] # Return empty list on error to avoid breaking chat flow

    def add_message(self, message: BaseMessage) -> None:
        """Append a message to the Supabase table."""
        logger.debug(f"Adding message to Supabase for session {self.session_id}, user {self.user_id}")
        try:
            # Langchain message_to_dict converts BaseMessage to a serializable dict.
            # The 'type' field from message_to_dict will map to our 'role' column.
            # e.g., HumanMessage -> {"type": "human", "data": {"content": ...}}
            # We need to extract the content and map the type to role.
            
            message_content = ""
            if hasattr(message, 'content'):
                message_content = message.content
            
            # Langchain types: "human", "ai", "system", "chat", "function", "tool"
            # Our DB roles: 'user', 'assistant', 'system', 'tool'
            role_mapping = {
                "human": "user",
                "ai": "assistant",
                "system": "system",
                "chat": "assistant", # Assuming "chat" type from generic ChatMessage maps to assistant
                "function": "tool", # Or handle as a special metadata? For now, map to tool.
                "tool": "tool"
            }
            mapped_role = role_mapping.get(message.type, "assistant") # Default to assistant if type unknown

            # The 'order' column is SERIAL, so PostgreSQL handles it automatically.
            # The 'timestamp' column has a DEFAULT, but we can provide it explicitly.
            message_to_insert = {
                "session_id": self.session_id,
                "user_id": self.user_id,
                "role": mapped_role,
                "content": message_content,
                # 'timestamp': datetime.utcnow().isoformat() # Let DB default handle it for consistency
                # 'metadata': message.additional_kwargs if hasattr(message, 'additional_kwargs') else None
                # If message.additional_kwargs contains complex objects, ensure they are JSON serializable
            }
            if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
                message_to_insert['metadata'] = message.additional_kwargs
            
            # if hasattr(message, 'name') and message.name: # For ToolMessage, FunctionMessage
            #     message_to_insert['name'] = message.name

            response = (
                self.client.table(self.table_name)
                .insert(message_to_insert)
                .execute()
            )
            if response.data:
                logger.info(f"Message added successfully to session {self.session_id}. Count: {len(response.data)}")
            else:
                logger.error(f"Failed to add message for session {self.session_id}. Response: {response.error if response.error else 'No data returned'}")
                # Consider raising an error if persistence is critical

        except Exception as e:
            logger.error(f"Error adding message to Supabase for session {self.session_id}: {e}", exc_info=True)
            # Optionally re-raise or handle

    def clear(self) -> None:
        """Clear all messages from the Supabase table for this session."""
        logger.debug(f"Clearing messages from Supabase for session {self.session_id}")
        try:
            response = (
                self.client.table(self.table_name)
                .delete()
                .eq("session_id", self.session_id)
                # We might also want to ensure we only delete messages for the specific user_id
                # if RLS is not solely relied upon or if this method could be called in a context
                # where user_id might be ambiguous (though __init__ sets it).
                # .eq("user_id", self.user_id) # RLS policy on messages table should handle this implicitly
                .execute()
            )
            # Delete responses don't always have informative data in response.data for count
            # We rely on lack of error. Check Supabase docs for delete response structure.
            # Typically, if no error is raised, the delete was successful or no rows matched.
            logger.info(f"Messages cleared for session {self.session_id}. Response status: {response.status_code if hasattr(response, 'status_code') else 'N/A'}")

        except Exception as e:
            logger.error(f"Error clearing messages from Supabase for session {self.session_id}: {e}", exc_info=True)
            # Optionally re-raise or handle

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