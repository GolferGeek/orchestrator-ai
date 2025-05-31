# apps/api/auth/schemas.py
from apps.api.v2.shared.contracts.generated.python.auth_types import (
    UserBase,
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    SupabaseAuthUser,
    AuthenticatedUserResponse
)

# All types are now imported from generated contracts
# No local model definitions needed 