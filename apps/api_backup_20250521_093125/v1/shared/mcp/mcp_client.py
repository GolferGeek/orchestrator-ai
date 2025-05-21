"""
Client for interacting with the Message Control Program (MCP).
"""
import httpx
import json
import logging
from typing import AsyncGenerator, List, Optional, Dict, Any

from pydantic import BaseModel, Field
from httpx_sse import aconnect_sse, ServerSentEvent # Import aconnect_sse and ServerSentEvent

from .mcp_models import LLMSettings, ChatMessage, SSEContentChunk, SSEError, SSEInfoMessage, SSEEndOfStream # Ensure these match server-side

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) # Explicitly set level for this logger

class MCPError(Exception):
    """Custom exception for MCP related errors."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

class MCPConnectionError(MCPError):
    """Raised when the client cannot connect to the MCP."""
    pass

class MCPTimeoutError(MCPError):
    """Raised when a request to the MCP times out."""
    pass

class MCPClient:
    """
    A client for interacting with the MCP, handling HTTP calls, SSE streaming,
    and parsing MCP-specific event types.
    """
    def __init__(self, base_mcp_url: str = "http://localhost:8000/mcp"):
        self.base_mcp_url = base_mcp_url.rstrip('/')
        # It's often better to create the client per request or manage its lifecycle
        # via dependency injection rather than holding an instance if the app is long-running.
        # For simplicity here, we'll create it as needed or it can be passed in.

    async def _get_client(self) -> httpx.AsyncClient:
        # This method can be used to manage client creation if needed later
        # For now, direct instantiation in methods is fine for simplicity.
        return httpx.AsyncClient(timeout=60.0)

    async def query_agent_stream(
        self,
        agent_id: str,
        user_query: str,
        session_id: Optional[str] = None, # Placeholder for future use
        llm_settings: Optional[LLMSettings] = None,
        conversation_history: Optional[List[ChatMessage]] = None
    ) -> AsyncGenerator[str, None]:
        """
        Queries a specific agent via the MCP's streaming endpoint and yields parsed event data.

        Args:
            agent_id: The ID of the agent to query (e.g., "metrics_agent").
            user_query: The user's query string.
            session_id: Optional session identifier for the MCP.
            llm_settings: Optional LLMSettings for the agent.
            conversation_history: Optional list of ChatMessage objects for the agent's history.

        Yields:
            str: Parsed string content from the MCP stream.

        Raises:
            MCPConnectionError: If connection to MCP fails.
            MCPTimeoutError: If the request to MCP times out.
            MCPError: For other MCP-related errors (e.g., non-200 status, stream errors).
        """
        mcp_agent_stream_url = f"{self.base_mcp_url}/stream/{agent_id}"
        payload = {"user_query": user_query, "agent_id": agent_id}
        if session_id:
            payload["session_id"] = session_id
        if llm_settings:
            payload["llm_settings"] = llm_settings.model_dump(exclude_none=True)
        if conversation_history:
            payload["conversation_history"] = [msg.model_dump() for msg in conversation_history]

        try:
            async with await self._get_client() as client:
                async with aconnect_sse(client, "POST", mcp_agent_stream_url, json=payload, timeout=60.0) as event_source:
                    async for sse_event in event_source.aiter_sse():
                        logger.info(f"MCPClient received SSE - Event: '{sse_event.event}', Data: '{sse_event.data}', ID: '{sse_event.id}'")
                        
                        if sse_event.event == "content":
                            try:
                                content_data = SSEContentChunk.model_validate_json(sse_event.data)
                                yield content_data.chunk
                            except json.JSONDecodeError:
                                logger.error(f"MCPClient: JSONDecodeError parsing content data: {sse_event.data}")
                            except Exception as e:
                                logger.error(f"MCPClient: Error processing content event: {e}, data: {sse_event.data}")
                        elif sse_event.event == "error":
                            try:
                                error_data = SSEError.model_validate_json(sse_event.data)
                                logger.error(f"MCP Server signaled an error: {error_data.code} - {error_data.message}")
                            except json.JSONDecodeError:
                                logger.error(f"MCPClient: JSONDecodeError parsing error data: {sse_event.data}")
                        elif sse_event.event == "info":
                            try:
                                info_data = SSEInfoMessage.model_validate_json(sse_event.data)
                                logger.info(f"MCP Server info: {info_data.message}")
                            except json.JSONDecodeError:
                                logger.error(f"MCPClient: JSONDecodeError parsing info data: {sse_event.data}")
                        elif sse_event.event == "eos":
                            try:
                                eos_data = SSEEndOfStream.model_validate_json(sse_event.data)
                                logger.info(f"MCP Server EOS: {eos_data.message}")
                            except json.JSONDecodeError:
                                logger.error(f"MCPClient: JSONDecodeError parsing EOS data: {sse_event.data}")
                            break
                        else:
                            if sse_event.event not in ["content", "error", "info", "eos"]:
                               logger.warning(f"MCPClient received SSE with unexpected event type: '{sse_event.event}', Data: '{sse_event.data}'")
        except httpx.ConnectError as e_conn:
            raise MCPConnectionError(f"Connection Error to MCP at {mcp_agent_stream_url}: {e_conn}") from e_conn
        except httpx.ReadTimeout as e_timeout:
            raise MCPTimeoutError(f"Read Timeout from MCP at {mcp_agent_stream_url}: {e_timeout}") from e_timeout
        except Exception as e_generic:
            raise MCPError(f"Unexpected error querying MCP stream at {mcp_agent_stream_url}: {str(e_generic)}") from e_generic

    async def query_agent_aggregate(
        self,
        agent_id: str,
        user_query: str,
        session_id: Optional[str] = None,
        llm_settings: Optional[LLMSettings] = None,
        conversation_history: Optional[List[ChatMessage]] = None
    ) -> str:
        """
        Queries an agent via MCP and aggregates the content chunks into a single string.
        Handles error events from the stream.
        """
        chunks = []
        final_error_message = None

        async for chunk_content in self.query_agent_stream(agent_id, user_query, session_id, llm_settings, conversation_history):
            chunks.append(chunk_content)
            if chunk_content.startswith("MCP Error:"):
                final_error_message = chunk_content
                break # Stop processing on MCP error event
        
        if final_error_message:
            # You might choose to raise an MCPError here or return the error message string
            # For now, returning it as part of the string for simplicity in MetricsService
            return final_error_message
        
        if not chunks and not final_error_message:
            return "MCP returned no specific content."
            
        aggregated_response = "".join(chunks)
        logger.info(f"MCPClient aggregated response for agent {agent_id} (length {len(aggregated_response)}): '{aggregated_response[:200]}{'...' if len(aggregated_response) > 200 else ''}'") # Log aggregated response (truncated if long)
        return aggregated_response

    async def close(self):
        # Implementation of close method
        pass

# Example usage (for testing, not to be run directly usually)
async def main_test():
    client = MCPClient()
    agent_to_test = "metrics_agent" # or any other agent_id known to your MCP
    test_query = "What are the sales figures?"
    print(f"Querying MCP for agent '{agent_to_test}' with query: '{test_query}'")
    
    print("\n--- Streaming events ---")
    try:
        async for chunk in client.query_agent_stream(agent_id=agent_to_test, user_query=test_query):
            print(f"Received chunk: '{chunk}'")
    except MCPError as e:
        print(f"MCP Client Error (stream): {e} (Status: {e.status_code if hasattr(e, 'status_code') else 'N/A'})")

    print("\n--- Aggregated response ---")
    try:
        response = await client.query_agent_aggregate(agent_id=agent_to_test, user_query=test_query)
        print(f"Aggregated response: {response}")
    except MCPError as e:
        print(f"MCP Client Error (aggregate): {e} (Status: {e.status_code if hasattr(e, 'status_code') else 'N/A'})")

if __name__ == "__main__":
    import asyncio
    # Note: This test requires the main FastAPI server with MCP to be running.
    # asyncio.run(main_test())
    print("MCPClient defined. To test, uncomment asyncio.run(main_test()) and ensure server is running.") 