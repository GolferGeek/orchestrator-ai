# apps/api/auth/schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional, Union # Added Union
from uuid import UUID # Changed from UUID4 to UUID for broader compatibility if needed
from datetime import datetime

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None

class UserCreate(UserBase):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: UUID # Changed from UUID4
    created_at: Optional[datetime] = None
    # email and display_name are inherited from UserBase

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None # Supabase provides refresh_token
    token_type: str = "bearer"
    expires_in: Optional[int] = None # Supabase provides expires_in

# Represents the user object directly from supabase.auth.get_user()
class SupabaseAuthUser(BaseModel):
    id: UUID
    aud: Optional[str] = None
    role: Optional[str] = None
    email: Optional[EmailStr] = None
    email_confirmed_at: Optional[datetime] = None
    phone: Optional[str] = None
    confirmed_at: Optional[datetime] = None # Alias for email_confirmed_at or phone_confirmed_at
    last_sign_in_at: Optional[datetime] = None
    app_metadata: Optional[dict] = {}
    user_metadata: Optional[dict] = {}
    identities: Optional[list] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Represents the user data we might want to use or expose via /me, potentially combined
# from auth user and public.users table.
class AuthenticatedUserResponse(BaseModel):
    id: UUID
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None # This would come from our public.users table
    # Add any other fields you want to return for an authenticated user session

    class Config:
        from_attributes = True 