import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from .mcp_models import MCPRequest, AgentIDPath # LLMSettings, ChatMessage are part of MCPRequest
from .llm_mcp import process_query_stream, ContextFileNotFoundError

logger = logging.getLogger(__name__)

mcp_router = APIRouter(
    prefix="/mcp",
    tags=["MCP - Message Control Program"],
)

async def sse_event_formatter(event_generator):
    """Formats dictionaries from process_query_stream into SSE events."""
    async for event_data in event_generator:
        event_type = event_data.get("type", "message") # Default event type
        # Special handling for different data structures if needed, or assume model_dump() was called
        # For now, assume event_data is a dict ready for JSON serialization.
        try:
            json_data = json.dumps(event_data)
            yield f"event: {event_type}\ndata: {json_data}\n\n"
        except TypeError as e:
            logger.error(f"Error serializing event data to JSON: {e}. Data: {event_data}")
            # Fallback or skip event
            error_event = {"type": "error", "code": "SERIALIZATION_ERROR", "message": "Failed to serialize event data."}
            json_error_data = json.dumps(error_event)
            yield f"event: error\ndata: {json_error_data}\n\n"

@mcp_router.post("/stream/{agent_id}")
async def stream_agent_response(
    path_params: AgentIDPath = Depends(), # Validates agent_id in path
    request_data: MCPRequest = None # Body can be optional if defaults in MCPRequest are suitable, or make it non-optional
):
    """
    Streams responses from the specified agent using Server-Sent Events (SSE).

    - **agent_id**: The unique identifier for the agent.
    - **request_data**: JSON body containing the user query, optional LLM settings, and conversation history.
    """
    if request_data is None:
        # Handle cases where client might send an empty body if it's truly optional
        # Or raise HTTPException if body is required but Pydantic model allows None (not typical for POST)
        # For this example, let's assume request_data (and thus user_query) is essential.
        raise HTTPException(status_code=400, detail="Request body is required.")

    agent_id = path_params.agent_id
    logger.info(f"Streaming request received for agent_id: {agent_id}, query: '{request_data.user_query[:50]}...'")

    try:
        event_generator = process_query_stream(
            agent_id=agent_id,
            user_query=request_data.user_query,
            llm_settings=request_data.llm_settings,
            conversation_history=request_data.conversation_history
        )
        return StreamingResponse(sse_event_formatter(event_generator), media_type="text/event-stream")
    except ContextFileNotFoundError as e:
        logger.warning(f"Context file not found for agent {agent_id} during route handling: {e}")
        # This specific error is now handled within process_query_stream and yields an SSEError event.
        # However, if _load_agent_context was NOT async and called directly here before process_query_stream,
        # this would be a place to catch it and return an HTTPException.
        # Since it's handled by yielding an SSEError, we might not need to raise HTTPException here for this specific error.
        # For robustness, ensure process_query_stream always yields something the client can parse as an error.
        # Consider if a 404 HTTP response is more appropriate than a 200 OK with an error event for context not found.
        # For now, let the stream handle it. The client must be designed to check event types.
        # If we want an HTTP 404 for this, we'd need to check earlier or change process_query_stream.
        # Let's stick to the current design: 200 OK with SSE error events for now.
        # This should already be caught by process_query_stream, but as a fallback:
        async def error_stream():
            error_event = {"type": "error", "code": "CONTEXT_NOT_FOUND_ROUTE", "message": str(e)}
            json_data = json.dumps(error_event)
            yield f"event: error\ndata: {json_data}\n\n"
            eos_event = {"type": "eos", "message": "Stream aborted due to context error."}
            json_eos_data = json.dumps(eos_event)
            yield f"event: eos\ndata: {json_eos_data}\n\n"
        return StreamingResponse(error_stream(), media_type="text/event-stream", status_code=200) # Or 404

    except Exception as e:
        logger.error(f"Unexpected error in /stream/{agent_id} endpoint: {e}", exc_info=True)
        # Generic fallback for other unexpected errors before streaming starts
        # Again, process_query_stream is designed to catch its own errors and yield SSEError.
        async def critical_error_stream():
            error_event = {"type": "error", "code": "UNEXPECTED_ROUTE_ERROR", "message": "A critical server error occurred."}
            json_data = json.dumps(error_event)
            yield f"event: error\ndata: {json_data}\n\n"
            eos_event = {"type": "eos", "message": "Stream aborted due to critical server error."}
            json_eos_data = json.dumps(eos_event)
            yield f"event: eos\ndata: {json_eos_data}\n\n"
        # For truly unexpected errors here, a 500 might be more appropriate.
        # However, to maintain SSE protocol, we stream an error.
        return StreamingResponse(critical_error_stream(), media_type="text/event-stream", status_code=500) 