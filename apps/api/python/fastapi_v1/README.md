# Python - FastAPI v1 Implementation

This directory contains the source code for the **Version 1 (v1)** API, implemented using Python and FastAPI.

## Key Characteristics

- **Independent Contracts:** This v1 implementation maintains its own API contracts, separate from the `shared/v2/contracts`. These might be OpenAPI v1/v2 specifications or implicitly defined through FastAPI/Pydantic models.
- **Legacy System:** Represents the current, stable version of the API.
- **Self-Contained:** Aims to be largely self-contained with its own dependencies and configurations, distinct from the v2 efforts.

## Structure

Typical structure might include:
- `agents/`: Business logic for different agents.
- `core/`: Core application settings, configurations.
- `routes/`: FastAPI route definitions.
- `models/` or `schemas/`: Pydantic models for request/response validation if not using a formal OpenAPI spec for v1.
- `main.py`: FastAPI application entry point.
- `requirements.txt`: Python dependencies. 