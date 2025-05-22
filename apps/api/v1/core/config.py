from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import validator
from typing import Optional, List
from pathlib import Path
import os
from dotenv import load_dotenv

# --- Explicit .env loading from project root ---
# This config.py is at apps/api/v1/core/config.py
# Project root is 4 levels up.
_CONFIG_FILE_PATH = Path(__file__).resolve()
PROJECT_ROOT_FOR_DOTENV = _CONFIG_FILE_PATH.parents[4]
DOTENV_PATH_FOR_EXPLICIT_LOAD = PROJECT_ROOT_FOR_DOTENV / ".env"

print(f"[CONFIG_PY_DEBUG] Attempting to explicitly load .env from: {DOTENV_PATH_FOR_EXPLICIT_LOAD}")
if DOTENV_PATH_FOR_EXPLICIT_LOAD.exists():
    load_dotenv(dotenv_path=DOTENV_PATH_FOR_EXPLICIT_LOAD, override=True)
    print(f"[CONFIG_PY_DEBUG] SUCCESS: Explicitly loaded .env from {DOTENV_PATH_FOR_EXPLICIT_LOAD}")
    print(f"[CONFIG_PY_DEBUG] TEST_API_SECRET_KEY from os.environ after explicit load: {os.getenv('TEST_API_SECRET_KEY')}")
else:
    print(f"[CONFIG_PY_DEBUG] WARNING: .env file NOT FOUND at {DOTENV_PATH_FOR_EXPLICIT_LOAD} for explicit load.")
# --- End explicit .env loading ---

# The DOTENV_PATH for Pydantic's model_config will be the same, but the explicit load above should pre-populate os.environ
# Pydantic will prioritize os.environ variables over those in the .env file if both are present.
_calculated_project_root_for_pydantic = Path(__file__).resolve().parents[4] # For consistency, though explicit load is key
_dotenv_path_for_pydantic_config = _calculated_project_root_for_pydantic / ".env"

DEFAULT_MARKDOWN_CONTEXT_PATH = _calculated_project_root_for_pydantic / "apps" / "api" / "v1" / "markdown_context"

# (Keep the earlier [CONFIG_INIT_DEBUG] prints if useful, or remove if too verbose now)
# print(f"[CONFIG_INIT_DEBUG] Path(__file__).resolve() in config.py: {_CONFIG_FILE_PATH}")
# print(f"[CONFIG_INIT_DEBUG] Calculated project root based on __file__: {_calculated_project_root_for_pydantic}")
# print(f"[CONFIG_INIT_DEBUG] Current Working Directory (os.getcwd()): {Path(os.getcwd())}")
# print(f"[CONFIG_INIT_DEBUG] FINAL DOTENV_PATH for Pydantic Settings (model_config): {_dotenv_path_for_pydantic_config}")
# if _dotenv_path_for_pydantic_config.exists():
#     print(f"[CONFIG_INIT_DEBUG] .env file confirmed to exist at path for Pydantic model_config.")
# else:
#     print(f"[CONFIG_INIT_DEBUG] WARNING: .env file NOT FOUND at path for Pydantic model_config.")

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "OrchestratorAI API"
    PROJECT_VERSION: str = "1.0.0"

    # Supabase
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    DEFAULT_GPT_MODEL: str = "gpt-4-turbo-preview"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-ada-002"

    # Test API Key for E2E tests or trusted services
    TEST_API_SECRET_KEY: Optional[str] = None
    TEST_USER_ID_FOR_API_KEY_AUTH: str = "00000000-0000-0000-0000-000000000api"

    AGENT_MAX_ITERATIONS: int = 10
    DEFAULT_AGENT_PROVIDER: str = "openai"

    MARKDOWN_CONTEXT_DIR: Path = DEFAULT_MARKDOWN_CONTEXT_PATH

    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    model_config = SettingsConfigDict(
        env_file=_dotenv_path_for_pydantic_config, # Pydantic can still be told where it *would* look
        env_file_encoding='utf-8',
        extra='ignore'
    )

# print("[CONFIG_PY_DEBUG] Attempting to instantiate Settings()...") # Moved slightly
settings = Settings() # This will now use pre-populated os.environ or load from file if not set
print(f"[CONFIG_PY_DEBUG] Settings() instantiated. TEST_API_SECRET_KEY from settings object: '{settings.TEST_API_SECRET_KEY}'")

# (The [CONFIG_LOAD] prints below are somewhat redundant if the one above shows the key, but fine for verification)
# print(f"[CONFIG_LOAD] SUPABASE_URL: {settings.SUPABASE_URL}")
# print(f"[CONFIG_LOAD] SUPABASE_ANON_KEY: {'********' if settings.SUPABASE_ANON_KEY else None}")
# print(f"[CONFIG_LOAD] SUPABASE_SERVICE_ROLE_KEY: {'********' if settings.SUPABASE_SERVICE_ROLE_KEY else None}")
# print(f"[CONFIG_LOAD] TEST_API_SECRET_KEY at settings object creation: '{settings.TEST_API_SECRET_KEY}'") 