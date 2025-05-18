from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Orchestrator AI API"
    API_V1_STR: str = "/api/v1"
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    PERPLEXITY_API_KEY: Optional[str] = None
    # Agent IDs for discovery
    AGENT_ID_ORCHESTRATOR: str = "orchestrator-agent-v1"
    AGENT_ID_METRICS: str = "metrics-agent-v1"
    # Add other settings here as needed

    # pydantic-settings will automatically load from .env if python-dotenv is installed.
    # The model_config attribute can be used for more advanced configurations if needed in Pydantic v2.
    # For now, the default behavior should be sufficient.

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

settings = Settings() 