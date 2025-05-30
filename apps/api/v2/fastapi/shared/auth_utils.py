from fastapi.security import OAuth2PasswordBearer

# Define the oauth2_scheme here to avoid circular imports
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False) 