# Python - FastAPI v1 Implementation

This directory contains the source code for the **Version 1 (v1)** API, implemented using Python and FastAPI.

## Key Characteristics

- **Independent Contracts:** This v1 implementation maintains its own API contracts, separate from the `shared/v2/contracts`. These are defined through FastAPI/Pydantic models.
- **Legacy System:** Represents the current, stable version of the API that serves as the baseline implementation.
- **Self-Contained:** Largely self-contained with its own dependencies and configurations, distinct from the v2 efforts.

## Current Status: ✅ **STABLE & WORKING**

The V1 API continues to function as the stable baseline:
- **Proven Architecture**: Battle-tested agent implementation patterns
- **Frontend Compatibility**: Full compatibility with the Vue.js frontend
- **Independent Evolution**: Can be maintained and updated independently of V2
- **Reference Implementation**: Serves as the baseline for V2 comparisons

## Structure

Current structure includes:
- `agents/`: Business logic for different agents
- `core/`: Core application settings and configurations
- `routes/`: FastAPI route definitions
- `models/` or `schemas/`: Pydantic models for request/response validation
- `main.py`: FastAPI application entry point
- `pyproject.toml`: PDM dependencies

## Ports & Deployment

- **Port**: 8000 (V2 uses 8001)
- **Environment**: Supports dev, test, and prod configurations  
- **Container**: Docker setup with PDM package management

## Relationship to V2

While V2 introduces A2A protocol compliance and improved architecture, V1:
- Remains the stable fallback option
- Provides feature parity for core functionality
- Serves as a reference for migration validation
- Continues to receive critical updates and bug fixes 