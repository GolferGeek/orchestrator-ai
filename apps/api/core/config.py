from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "Orchestrator AI API"
    API_V1_STR: str = "/api/v1"
    OPENAI_API_KEY: Optional[str] = None
    # Agent IDs for discovery
    AGENT_ID_ORCHESTRATOR: str = "orchestrator-agent-v1"
    AGENT_ID_METRICS: str = "metrics-agent-v1"
    # Add other settings here as needed

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding='utf-8', extra='ignore')

settings = Settings() 