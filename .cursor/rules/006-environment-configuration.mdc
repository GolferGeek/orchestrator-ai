---
name: "Environment Configuration"
description: "Standards for managing environment variables and application configuration across dev, test, and prod."
globs: [".env*", "**/config.py", "**/vite.config.js"]
alwaysApply: true
---

# Environment Configuration

## General Principles
- Maintain separate configurations for different environments (e.g., `dev`, `test`, `prod`).
- Never commit sensitive information (API keys, passwords, secrets) directly into the codebase.

## .env Files
- Use `.env` files for environment-specific variables.
- Each environment should have its own `.env` file (e.g., `.env.development`, `.env.production`).
- A `.env.example` file should be committed to the repository, listing all required environment variables with placeholder or default values.
- `.env` files (except `.env.example`) must be listed in `.gitignore`.

## Loading Environment Variables
- **Python/FastAPI**: Use Pydantic's `Settings` management or libraries like `python-dotenv` to load variables from `.env` files.
- **Vue/Node.js**: Utilize tools like `dotenv` or framework-specific mechanisms (e.g., Vite's built-in .env handling) to load environment variables.

## Configuration Management
- **Python**: Centralize configuration loading in a dedicated module (e.g., `shared/config.py`).
- **Vue**: Access environment variables via `import.meta.env` (Vite) or `process.env` (Node.js context).

## Environment-Specific Behavior
- Code should adapt its behavior based on the current environment where appropriate (e.g., logging levels, feature flags, API endpoints).
- Use environment variables to control these differences.

## Secrets Management
- For production and sensitive environments, use a secure secrets management solution (e.g., HashiCorp Vault, AWS Secrets Manager, Doppler) instead of relying solely on .env files.
- The application should be configured to fetch secrets from these services at startup or runtime.

## Consistency
- Ensure all developers and deployment environments use a consistent method for managing and accessing configuration.
