from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path
from dotenv import dotenv_values

# Determine the project root directory based on config.py's location
# config.py is in /apps/api/v1/core/config.py
# Project root is three levels up from config.py's directory
# (Path(__file__).resolve().parent) is .../orchestrator-ai/apps/api/v1/core
# .parent is .../orchestrator-ai/apps/api/v1
# .parent is .../orchestrator-ai/apps/api
# .parent is .../orchestrator-ai/apps
# .parent is .../orchestrator-ai (project root)
PROJECT_ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
V1_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DOTENV_PATH = PROJECT_ROOT_DIR / ".env"
MARKDOWN_CONTEXT_DIR = V1_ROOT_DIR / "markdown_context"

class Settings(BaseSettings):
    APP_NAME: str = "Orchestrator AI API"
    API_V1_STR: str = "/api/v1"
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    PERPLEXITY_API_KEY: Optional[str] = None
    # Supabase settings
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    # Agent IDs for discovery
    AGENT_ID_ORCHESTRATOR: str = "orchestrator-agent-v1"
    AGENT_ID_METRICS: str = "metrics-agent-v1"
    TEST_API_SECRET_KEY: Optional[str] = None
    # Markdown context directory
    MARKDOWN_CONTEXT_DIR: Path = MARKDOWN_CONTEXT_DIR
    
    # Add other settings here as needed

    # pydantic-settings will automatically load from .env if python-dotenv is installed.
    # The model_config attribute can be used for more advanced configurations if needed in Pydantic v2.
    # For now, the default behavior should be sufficient.

    model_config = SettingsConfigDict(
        env_file=DOTENV_PATH,
        env_file_encoding='utf-8',
        extra='ignore'
    )

settings = Settings()

# Print Supabase settings for verification during startup
print(f"[CONFIG_LOAD] SUPABASE_URL: {settings.SUPABASE_URL}")
print(f"[CONFIG_LOAD] SUPABASE_ANON_KEY: {'********' if settings.SUPABASE_ANON_KEY else None}") # Mask key
print(f"[CONFIG_LOAD] SUPABASE_SERVICE_ROLE_KEY: {'********' if settings.SUPABASE_SERVICE_ROLE_KEY else None}") # Mask key 