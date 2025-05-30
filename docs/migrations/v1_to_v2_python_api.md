# Migration Guide: API v1 to Python FastAPI v2

This document outlines the key changes and considerations when migrating from the v1 API structure to the new Python-based FastAPI v2 architecture.

## 1. Structural Changes

*   **Application Location:**
    *   The primary Python FastAPI v2 application code is located at: `apps/api/v2/fastapi/`.
    *   The Python FastAPI v1 application code is located at: `apps/api/v1/fastapi/`.
*   **Hierarchical Agent Structure:**
    *   V2 introduces a hierarchical model for agents:
        *   **Parent Agents:** Reside directly within a category (department) folder. For example, the main business logic for the "business" category can be found in `apps/api/v2/fastapi/agents/business/main.py`.
        *   **Child Agents:** Are located in subdirectories under their parent agent's category. For example, the metrics agent (a child of business) is at `apps/api/v2/fastapi/agents/business/metrics/main.py`.
*   **Focused Initial Migration:**
    *   For the initial v2 rollout, only a specific subset of agents has been migrated and restructured:
        *   `system/orchestrator/`: The core orchestrator agent.
        *   `business/`: Parent business agent, with `business/metrics/` as its child.
        *   `marketing/`: Parent marketing agent, with `marketing/blog_post/` and `marketing/research/` as its children.
    *   Other agents present in v1 are not part of this initial Python v2 structure and will be added iteratively.
*   **Markdown Context:**
    *   Markdown context files for these v2 Python agents are located in `apps/api/v2/fastapi/markdown_context/`.

## 2. Shared Contracts

*   **Centralized Pydantic Models:**
    *   The V2 Python API now exclusively uses shared Pydantic models for A2A (Agent-to-Agent) communication and other core types. These models are generated and located in `apps/api/v2/shared/generated/python/`.
    *   Key contract files include `a2a_protocol.py` and `agent_types.py` within this directory.
*   **Deprecation of Local Types:**
    *   Any local type definitions previously found within an agent's own `types.py` or within a common `apps/api/v2/fastapi/a2a_protocol/types.py` should be considered deprecated. All new development must use the shared contracts.

## 3. Dependency, Build, and Deployment Changes

*   **Python Version:**
    *   The standard Python version for the v2 API is **3.13**.
*   **Package Management:**
    *   **PDM** is the designated package manager for the Python v2 API.
    *   Dependencies are defined in `apps/api/v2/fastapi/pyproject.toml`.
    *   A `pdm.lock` file ensures reproducible builds.
*   **Dockerfile:**
    *   The `Dockerfile` located at `apps/api/v2/fastapi/Dockerfile` has been updated to:
        *   Use `python:3.13-slim` as the base image.
        *   Install and use PDM for managing dependencies within the Docker build.
        *   Follow v1 practices for directory structure (`/app_mount`) and `PYTHONPATH` setup (`ENV PYTHONPATH="/app_mount"`).
*   **.env File Handling (Docker):**
    *   Consistent with v1, the Docker setup for v2 copies the root `.env` file to `/app_mount/apps/.env` inside the container.
*   **Running the Application (Docker):**
    *   The `CMD` in the Dockerfile is: `sh -c "cd /app_mount/apps/api/v2/fastapi && exec pdm run uvicorn apps.api.v2.fastapi.main:app --host 0.0.0.0 --port 8001"`

## 4. Key File Locations

*   **Main Application Entry Point:** `apps/api/v2/fastapi/main.py`
*   **Shared Contract Models:** `apps/api/v2/shared/generated/python/`
*   **Agent Base Classes (Example):**
    *   `apps/api/v2/fastapi/a2a_protocol/unified_agent_service.py`
    *   `apps/api/v2/fastapi/agents/base/mcp_context_agent_base.py`
*   **Agent Implementations (Examples):**
    *   Parent: `apps/api/v2/fastapi/agents/business/main.py`
    *   Child: `apps/api/v2/fastapi/agents/business/metrics/main.py`
*   **Configuration & Build:**
    *   `apps/api/v2/fastapi/Dockerfile`
    *   `apps/api/v2/fastapi/pyproject.toml`
    *   `apps/api/v2/fastapi/pdm.lock`

## 5. High-Level Migration Considerations (for Developers)

*   **Monorepo Structure:** Always ensure your local workspace is up-to-date with the latest changes from the monorepo.
*   **New Agent Development (V2 Python):**
    *   Follow the established hierarchical structure (category folder for parent, sub-folder for child).
    *   All new agents must utilize the shared Pydantic contracts from `apps/api/v2/shared/generated/python/`.
    *   Develop using Python 3.13 and manage dependencies with PDM.
*   **Environment:**
    *   For local development, ensure your Python environment matches (3.13, PDM).
    *   For Docker-based development or deployment, refer to the `apps/api/v2/fastapi/Dockerfile`.

## 6. Port Configuration

*   **V1 API:** Runs on port 8000
*   **V2 API:** Runs on port 8001
*   **Frontend:** Can switch between V1 and V2 APIs using the API selector

This guide provides a snapshot of the V2 Python API architecture. As development progresses, further details and refinements will be documented. 