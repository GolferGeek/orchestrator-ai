# apps/api/sessions/schemas.py
from apps.api.v2.shared.contracts.generated.python.session_types import (
    SessionCreate,
    SessionBase, 
    SessionResponse,
    SessionListResponse,
    MessageBase,
    MessageResponse,
    MessageListResponse
)

# All types are now imported from generated contracts
# No local model definitions needed 