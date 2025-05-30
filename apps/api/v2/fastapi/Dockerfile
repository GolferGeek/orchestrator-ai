# Dockerfile for Python FastAPI v2 Application using PDM (aligned with v1)

FROM python:3.13-slim

WORKDIR /app_mount

# Assuming build context is monorepo root.
# Copy the root .env file to where the app expects it.
COPY .env /app_mount/apps/.env

# Copy the application code into the expected structure.
COPY apps/api/v2/fastapi /app_mount/apps/api/v2/fastapi/

# Set the working directory for PDM to where pyproject.toml is for this app.
WORKDIR /app_mount/apps/api/v2/fastapi/

# Install PDM
RUN pip install --upgrade pip
RUN pip install pdm
RUN pdm config python.use_venv false

# Install dependencies (PDM will use pyproject.toml and pdm.lock from the current WORKDIR).
RUN pdm install --prod --no-editable

EXPOSE 8001

# Set PYTHONPATH to the directory containing the 'apps' top-level package.
ENV PYTHONPATH="/app_mount"
# Uvicorn app string now needs to reflect the full module path from PYTHONPATH.
CMD ["sh", "-c", "cd /app_mount/apps/api/v2/fastapi && exec pdm run uvicorn apps.api.v2.fastapi.main:app --host 0.0.0.0 --port 8001"] 