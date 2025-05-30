# Dockerfile for Python FastAPI v1 Application using PDM

FROM python:3.13-slim

WORKDIR /app_mount

# Assuming build context is monorepo root.
# Copy the root .env file to where the app expects it.
COPY .env /app_mount/apps/.env

# Copy the application code into the expected structure.
COPY apps/api/python/fastapi_v1 /app_mount/apps/api/python/fastapi_v1/

# Set the working directory for PDM to where pyproject.toml is for this app.
WORKDIR /app_mount/apps/api/python/fastapi_v1/

# Install PDM
RUN pip install --upgrade pip
RUN pip install pdm
RUN pdm config python.use_venv false

# Install dependencies (PDM will use pyproject.toml and pdm.lock from the current WORKDIR).
RUN pdm install --prod --no-editable

EXPOSE 8000

# Set PYTHONPATH to the directory containing the 'apps' top-level package.
ENV PYTHONPATH="/app_mount"
# Uvicorn app string now needs to reflect the full module path from PYTHONPATH.
CMD ["sh", "-c", "cd /app_mount/apps/api/python/fastapi_v1 && exec pdm run uvicorn apps.api.python.fastapi_v1.main:app --host 0.0.0.0 --port 8000"]