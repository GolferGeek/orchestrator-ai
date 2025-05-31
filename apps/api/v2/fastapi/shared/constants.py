# Shared constants for V2 FastAPI application

# Base path for generated contract types
SHARED_CONTRACTS_BASE = "apps.api.v2.shared.contracts.generated.python"

# Individual contract module paths
A2A_PROTOCOL_MODULE = f"{SHARED_CONTRACTS_BASE}.a2a_protocol"
MCP_TYPES_MODULE = f"{SHARED_CONTRACTS_BASE}.mcp_types"
SESSION_TYPES_MODULE = f"{SHARED_CONTRACTS_BASE}.session_types"
AUTH_TYPES_MODULE = f"{SHARED_CONTRACTS_BASE}.auth_types"
TASK_STORE_TYPES_MODULE = f"{SHARED_CONTRACTS_BASE}.task_store_types"
COMMON_TYPES_MODULE = f"{SHARED_CONTRACTS_BASE}.common_types"

# FastAPI Application Metadata
APP_TITLE = "MCP API"
APP_DESCRIPTION = "Multi-Agent Coordination Protocol API"
APP_VERSION = "1.0.0"

# Route Prefixes
AUTH_PREFIX = "/auth"
SESSIONS_PREFIX = "/sessions"
MCP_PREFIX = "/mcp"
AGENTS_PREFIX = "/agents"

# Router Tags
AUTH_TAG = "auth"
SESSIONS_TAG = "sessions"
MCP_TAG = "mcp"

# CORS Configuration
CORS_ALLOW_ORIGINS = [
    "http://localhost:5173",  # V1 Frontend (default Vite port)
    "http://localhost:5174",  # V2 Frontend (next available port)
    "http://127.0.0.1:5173",  # V1 Frontend (alternative localhost)
    "http://127.0.0.1:5174",  # V2 Frontend (alternative localhost)
    # "http://localhost:8100", # If using ionic serve
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
CORS_ALLOW_HEADERS = ["*"]

# Directory Names
AGENTS_DIRECTORY = "agents"
BASE_DIRECTORY = "base"
MAIN_FILE = "main.py"

# Excluded Directory Patterns
EXCLUDED_DIR_PREFIXES = ["_"]
EXCLUDED_DIRS = [BASE_DIRECTORY]

# Module Paths
FASTAPI_BASE_MODULE = "apps.api.v2.fastapi"
AGENTS_MODULE_BASE = f"{FASTAPI_BASE_MODULE}.agents"

# Default Values
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEFAULT_ENV_PORT_VAR = "PORT"

# API Response Messages
API_RUNNING_MESSAGE = "MCP API is running"
HEALTH_STATUS_HEALTHY = "healthy"
HEALTH_STATUS_OK = "ok"

# Error Messages
ERROR_MESSAGE_KEY = "message"

# Environment Variables
OPENAI_API_KEY_VAR = "OPENAI_API_KEY"
LOG_LEVEL_VAR = "LOG_LEVEL"

# Default Log Level
DEFAULT_LOG_LEVEL = "WARNING"

# Debug Constants
NOT_FOUND_MESSAGE = "NOT_FOUND_OR_EMPTY"
NOT_IN_OS_ENVIRON = "NOT_IN_OS_ENVIRON" 