import os
import logging
from pathlib import Path
from typing import AsyncGenerator, List, Optional, Dict, Any

from openai import AsyncOpenAI, OpenAIError # Assuming usage of OpenAI SDK
# Removed: import anthropic
from .mcp_models import LLMSettings, ChatMessage, SSEContentChunk, SSEError, SSEInfoMessage, SSEEndOfStream
from ...core.config import settings # Import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client lazily
_aclient = None # Reverted from _aclient_openai

def get_openai_client() -> AsyncOpenAI:
    """Get or create the OpenAI client, validating the API key."""
    global _aclient # Reverted
    if _aclient is None: # Reverted
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in the environment or .env file. Please configure it.")
        _aclient = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) # Reverted
    return _aclient # Reverted

class ContextFileNotFoundError(Exception):
    """Custom exception for when an agent's context file is not found."""
    pass

async def _load_agent_context(agent_id: str) -> str:
    """Loads the markdown context for a given agent_id."""
    # Get the absolute path to the V1 directory
    v1_dir = Path(__file__).resolve().parent.parent.parent
    markdown_context_dir = v1_dir / "markdown_context"
    
    # First try with the settings path
    context_file_path = settings.MARKDOWN_CONTEXT_DIR / f"{agent_id}_agent.md"
    
    logger.info(f"Attempting to load context from: {context_file_path}")
    logger.info(f"MARKDOWN_CONTEXT_DIR from settings is: {settings.MARKDOWN_CONTEXT_DIR}")
    logger.info(f"Calculated V1 directory is: {v1_dir}")
    logger.info(f"Calculated markdown_context_dir is: {markdown_context_dir}")
    logger.info(f"Current working directory: {os.getcwd()}")

    # If the file doesn't exist at the settings path, try the calculated path
    if not context_file_path.exists():
        logger.warning(f"Context file not found at settings path: {context_file_path}")
        # Try the calculated path with _agent suffix
        calculated_path = markdown_context_dir / f"{agent_id}_agent.md"
        logger.info(f"Trying calculated path: {calculated_path}")
        
        if calculated_path.exists():
            logger.info(f"Context file found at calculated path: {calculated_path}")
            context_file_path = calculated_path
        else:
            # Fallback to check without the _agent suffix
            alternate_context_path = settings.MARKDOWN_CONTEXT_DIR / f"{agent_id}.md"
            calculated_alternate_path = markdown_context_dir / f"{agent_id}.md"
            
            logger.info(f"Trying alternate paths: {alternate_context_path} and {calculated_alternate_path}")
            
            if alternate_context_path.exists():
                logger.info(f"Context file found using alternate naming: {alternate_context_path}")
                context_file_path = alternate_context_path
            elif calculated_alternate_path.exists():
                logger.info(f"Context file found using calculated alternate path: {calculated_alternate_path}")
                context_file_path = calculated_alternate_path
            else:
                logger.error(f"Context file not found using any path. Tried:\n" 
                             f"1. {context_file_path}\n"
                             f"2. {calculated_path}\n"
                             f"3. {alternate_context_path}\n"
                             f"4. {calculated_alternate_path}\n"
                             f"Current working directory: {os.getcwd()}")
                raise ContextFileNotFoundError(f"Context file for agent {agent_id} not found.")
    
    try:
        with open(context_file_path, "r", encoding="utf-8") as f:
            content = f.read()
            logger.info(f"Context loaded for agent {agent_id}, length: {len(content)} chars from {context_file_path}")
            # Log a preview of the content to verify it's being read correctly
            content_preview = content[:200] + "..." if len(content) > 200 else content
            logger.info(f"Context preview for agent {agent_id}: {content_preview}")
            return content
    except Exception as e:
        logger.error(f"Error reading context file for agent {agent_id} from {context_file_path}: {e}")
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
        logger.info(f"Prompt messages for OpenAI (agent {agent_id}): {prompt_messages}") # Reverted to OpenAI specific logging

        # Get the OpenAI client when needed
        aclient = get_openai_client()
        stream = await aclient.chat.completions.create(
            model=effective_settings.model_name or settings.DEFAULT_GPT_MODEL, # Use OpenAI default model
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