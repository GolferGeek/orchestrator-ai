import os
import logging
from pathlib import Path
from typing import AsyncGenerator, List, Optional, Dict, Any

from openai import AsyncOpenAI, OpenAIError # Assuming usage of OpenAI SDK
from .mcp_models import LLMSettings, ChatMessage, SSEContentChunk, SSEError, SSEInfoMessage, SSEEndOfStream
from ...core.config import settings # Import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client lazily
_aclient = None

def get_openai_client() -> AsyncOpenAI:
    """Get or create the OpenAI client, validating the API key."""
    global _aclient
    if _aclient is None:
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in the environment or .env file. Please configure it.")
        _aclient = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _aclient

class ContextFileNotFoundError(Exception):
    """Custom exception for when an agent's context file is not found."""
    pass

async def extract_agent_metadata(agent_id: str) -> Dict[str, Any]:
    """
    Extract metadata from an agent's context file.
    Currently supports:
    - is_sticky: Whether the agent should maintain conversation continuity
    - sticky_duration: How long (in minutes) the agent should remain sticky
    Returns a dictionary of metadata values.
    """
    try:
        context = await _load_agent_context(agent_id)
        metadata = {}
        
        # Check for stickiness declaration
        if "<!-- sticky: true -->" in context:
            metadata["is_sticky"] = True
            
            # Check for duration
            import re
            duration_match = re.search(r"<!-- sticky_duration: (\d+) -->", context)
            if duration_match:
                try:
                    metadata["sticky_duration"] = int(duration_match.group(1))
                except ValueError:
                    metadata["sticky_duration"] = 30  # Default 30 minutes
            else:
                metadata["sticky_duration"] = 30  # Default 30 minutes
        
        return metadata
    except Exception as e:
        logger.error(f"Error extracting metadata for agent {agent_id}: {e}")
        return {}

async def _load_agent_context(agent_id: str) -> str:
    """Loads the markdown context for a given agent_id."""
    # Path to llm_mcp.py -> mcp -> shared -> api -> apps -> project_root
    current_file_dir = Path(__file__).resolve().parent
    # Correct path: current_file_dir.parents[3] should be the project root /orchestrator-ai
    # llm_mcp.py is in apps/api/shared/mcp/
    # parent[0] is mcp
    # parent[1] is shared
    # parent[2] is api
    # parent[3] is apps
    # parent[4] is orchestrator-ai (project root)
    # Whoops, calculation error in comment, let's trace carefully:
    # __file__ = apps/api/shared/mcp/llm_mcp.py
    # parent (current_file_dir) = apps/api/shared/mcp/
    # parents[0] = apps/api/shared/
    # parents[1] = apps/api/
    # parents[2] = apps/
    # parents[3] = orchestrator-ai/ (project root)
    project_root = current_file_dir.parents[3] 
    
    # Try multiple file naming patterns in order of preference
    context_file_paths = [
        project_root / "markdown_context" / f"{agent_id}_agent.md",  # First try: agent_id_agent.md
        project_root / "markdown_context" / f"{agent_id}Agent.md",   # Second try: agentIdAgent.md
        project_root / "markdown_context" / f"{agent_id}.md"         # Third try: agent_id.md
    ]
    
    # Try all paths in order
    found_path = None
    for path in context_file_paths:
        if path.exists():
            found_path = path
            break
    
    # If no file found through standard paths, try fallback with CWD
    if not found_path:
        logger.error(f"Context file not found for agent_id: {agent_id} at any of the standard paths")
        # Fallback for cases where CWD might be apps/api (less robust, but a safety net)
        # This might occur if the script is run with apps/api as CWD and Path() resolves differently
        alternate_project_root = Path(os.getcwd()).parent # if cwd is apps/api, parent is orchestrator-ai
        
        # Try the same patterns with alternate root
        alt_context_paths = [
            alternate_project_root / "markdown_context" / f"{agent_id}_agent.md",
            alternate_project_root / "markdown_context" / f"{agent_id}Agent.md",
            alternate_project_root / "markdown_context" / f"{agent_id}.md"
        ]
        
        for alt_path in alt_context_paths:
            if alt_path.exists():
                found_path = alt_path
                logger.warning(f"Context file found using alternate path: {alt_path}")
                break
    
    # If still not found, raise error
    if not found_path:
        tried_paths = ", ".join(str(p) for p in context_file_paths + alt_context_paths)
        logger.error(f"Context file not found for agent {agent_id} after trying: {tried_paths}")
        raise ContextFileNotFoundError(f"Context file for agent {agent_id} not found.")
    
    try:
        with open(found_path, "r", encoding="utf-8") as f:
            content = f.read()
            logger.info(f"Context loaded for agent {agent_id} from {found_path}, length: {len(content)} chars.")
            return content
    except Exception as e:
        logger.error(f"Error reading context file for agent {agent_id} from {found_path}: {e}")
        raise

def _construct_prompt_messages(agent_id: str, agent_context: str, user_query: str, 
                               conversation_history: Optional[List[ChatMessage]] = None) -> List[Dict[str, str]]:
    """Constructs the list of messages for the LLM prompt."""
    messages = []

    # The agent_context IS the system prompt.
    # It already defines the persona and task for the LLM based on the agent_id's .md file.
    messages.append({"role": "system", "content": agent_context})

    # Add conversation history if provided
    if conversation_history:
        for msg in conversation_history:
            # Ensure history roles are valid for OpenAI (e.g. "user" or "assistant")
            # The Task history might use "agent" for assistant's turns.
            role_to_use = msg.role
            if msg.role == "agent":
                role_to_use = "assistant"
            
            if role_to_use in ["user", "assistant"]:
                 messages.append({"role": role_to_use, "content": msg.content})
            else:
                logger.warning(f"Skipping conversation history message with unmapped role: {msg.role} for agent {agent_id}")
    
    # Add the current user query
    messages.append({"role": "user", "content": user_query})
    
    return messages

async def process_query_stream(
    agent_id: str,
    user_query: str,
    llm_settings: Optional[LLMSettings] = None,
    conversation_history: Optional[List[ChatMessage]] = None
) -> AsyncGenerator[Dict[str, Any], None]: # Yielding dictionaries for SSE formatting later
    """ 
    Processes a user query for a given agent by loading its context, 
    forming a prompt, and streaming responses from an LLM.
    Yields dictionaries structured for SSE events.
    """
    effective_settings = llm_settings if llm_settings else LLMSettings()

    try:
        yield SSEInfoMessage(message=f"Loading context for agent {agent_id}...").model_dump()
        agent_context = await _load_agent_context(agent_id)
        yield SSEInfoMessage(message=f"Context loaded. Processing query...").model_dump()
        
        prompt_messages = _construct_prompt_messages(agent_id, agent_context, user_query, conversation_history)
        
        # Log the messages for debugging (optional)
        # logger.debug(f"Prompt messages for agent {agent_id}: {prompt_messages}")
        logger.info(f"Prompt messages for OpenAI (agent {agent_id}): {prompt_messages}")

        # Get the OpenAI client when needed
        aclient = get_openai_client()
        stream = await aclient.chat.completions.create(
            model=effective_settings.model_name,
            messages=prompt_messages,
            temperature=effective_settings.temperature,
            max_tokens=effective_settings.max_tokens,
            stream=True
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                content_chunk = chunk.choices[0].delta.content
                logger.info(f"OpenAI content chunk for agent {agent_id}: '{content_chunk}'")
                yield SSEContentChunk(chunk=content_chunk).model_dump()
        
        yield SSEEndOfStream(message=f"Stream finished for agent {agent_id}").model_dump()

    except ContextFileNotFoundError as e:
        logger.error(f"ContextFileNotFoundError for agent {agent_id}: {e}")
        yield SSEError(code="CONTEXT_NOT_FOUND", message=str(e)).model_dump()
        yield SSEEndOfStream(message=f"Stream ended due to error for agent {agent_id}").model_dump()
    except OpenAIError as e:
        logger.error(f"OpenAI API error for agent {agent_id}: {e}")
        yield SSEError(code="LLM_API_ERROR", message=f"An error occurred with the LLM: {type(e).__name__} - {e}").model_dump()
        yield SSEEndOfStream(message=f"Stream ended due to LLM error for agent {agent_id}").model_dump()
    except Exception as e:
        logger.error(f"Unexpected error processing query for agent {agent_id}: {e}", exc_info=True)
        yield SSEError(code="UNEXPECTED_ERROR", message=f"An unexpected error occurred: {str(e)}").model_dump()
        yield SSEEndOfStream(message=f"Stream ended due to unexpected error for agent {agent_id}").model_dump() 