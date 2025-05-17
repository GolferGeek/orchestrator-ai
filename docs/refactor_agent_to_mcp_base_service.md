# Procedure: Refactor Agent to use MCPContextAgentBaseService

This document outlines the standardized steps to refactor an existing A2A sub-agent to use the `MCPContextAgentBaseService`. The `apps/api/agents/business/metrics/main.py` agent and its corresponding test file `apps/api/tests/integration/agents/business/test_metrics_service.py` serve as the **strict templates** for this process.

**Goal:** Update an agent to leverage the common functionalities provided by `MCPContextAgentBaseService`, ensuring consistency in implementation and testing.

**Key Principle:** Minimize deviations from the `metrics` agent's implementation. Copy code directly and only modify agent-specific names, IDs, paths, and descriptions. This applies to both the agent's `main.py` and its integration test.

## Prerequisites

Before starting, identify:

1.  **Agent Name (Snake Case):** e.g., `new_agent`
2.  **Agent Category/Department:** e.g., `productivity`, `business`
3.  **Agent ID (String):** e.g., `new-agent-v1`
4.  **Agent Display Name (Title Case String):** e.g., `New Agent`
5.  **Agent Description (String):** A brief description of the agent.
6.  **MCP Target Agent ID (String):** The ID of the agent it will query via MCP (if applicable, often a more capable LLM or specialized agent).
7.  **Primary Capability Name (String):** e.g., `query_new_agent_via_mcp`

## Steps

### 1. Refactor Agent's `main.py`

**Target file:** `apps/api/agents/[agent_category]/[agent_name]/main.py`

**Template file:** `apps/api/agents/business/metrics/main.py`

1.  **Copy Content:** Open `apps/api/agents/business/metrics/main.py`. Copy its entire content.
2.  **Paste and Replace:** Paste the copied content into the target agent's `main.py`, replacing its existing content.
3.  **Clean Up Old Routes:** After pasting, immediately scroll to the bottom of the target agent's `main.py`. Delete any pre-existing route definitions (e.g., `@router.get("/")`, `@router.get("/.well-known/agent.json")`) or other old code that might conflict with the newly pasted template code, especially if it refers to an old `router` variable. The template code uses `agent_router`.
4.  **Update Constants:**
    *   Modify `AGENT_VERSION` if necessary (usually start with `0.1.0`).
    *   Update `AGENT_ID` with the new agent's ID.
    *   Update `AGENT_NAME` with the new agent's display name.
    *   Update `AGENT_DESCRIPTION` with the new agent's description.
    *   Update `MCP_TARGET_AGENT_ID` with the appropriate target.
    *   Update `CONTEXT_FILE_NAME` to `[agent_name]_agent.md`.
    *   Update `PRIMARY_CAPABILITY_NAME` to the new agent's primary capability.
5.  **Update Class Name:** Change the class name from `MetricsAgentService` to `[AgentNamePascalCase]AgentService` (e.g., `NewAgentService`).
6.  **Update Router:**
    *   Change the `APIRouter` instance name, e.g., `router = APIRouter(prefix=f"/agents/[agent_category]/[agent_name]")`.
    *   Ensure all route paths are correct for the new agent.
7.  **Update Dependencies:** In the `get_[agent_name]_agent_service` function:
    *   Ensure it returns an instance of `[AgentNamePascalCase]AgentService`.
    *   Update type hints and variable names if necessary.
8.  **Verify Imports:** Ensure all imports are still relevant and correct. Add or remove as needed, but the `metrics` agent's imports should be a very close match.

### 2. Create/Update Markdown Context File

**Target file:** `markdown_context/[agent_name]_agent.md`

**Template:** While there isn't a strict template *content* to copy (as context is agent-specific), the *structure* should follow `004-markdown-context-standards`. The `MCPContextAgentBaseService` relies on this file.

1.  **Create File:** If it doesn't exist, create `markdown_context/[agent_name]_agent.md`.
2.  **Add Content:** Populate the file with:
    *   Agent Persona/Role
    *   Key Information
    *   Capabilities & Limitations
    *   Example Interactions
    *   Follow guidelines in `004-markdown-context-standards`.
    *   Refer to `markdown_context/metrics_agent.md` for a structural example.

### 3. Create Integration Test File

**Target directory:** `apps/api/tests/integration/agents/[agent_category]/[agent_name]/`
**Target file name:** `test_[agent_name]_agent.py` (if the service class is `[AgentName]AgentService`, then `test_[agent_name]_service.py` might be more consistent with `test_metrics_service.py`). Let's stick to `test_[agent_name]_service.py` for consistency with the template.

**Template file:** `apps/api/tests/integration/agents/business/test_metrics_service.py`

**CRITICAL NOTE ON TEST FILE CREATION:**
To minimize errors and ensure consistency, the `test_metrics_service.py` file (or another known, fully working test file for an `MCPContextAgentBaseService`-based agent) must be **DIRECTLY COPIED** to the new agent's test directory. **DO NOT REWRITE OR RE-IMPLEMENT** parts of the test file, especially fixtures like `client_and_app`, from memory or by adapting other non-template test files. The goal is a byte-for-byte copy followed by targeted, minimal modifications only for agent-specific names, IDs, paths, and other unique constants.

1.  **Create Directory:** If the `apps/api/tests/integration/agents/[agent_category]/[agent_name]/` directory doesn't exist, create it.
2.  **Copy Test File:** **Strictly copy** the entire content of `apps/api/tests/integration/agents/business/test_metrics_service.py` into the new file `apps/api/tests/integration/agents/[agent_category]/[agent_name]/test_[agent_name]_service.py`. Do not omit or change any part of the copied code at this stage, especially fixtures or client instantiation logic.
3.  **Update Imports and Constants:**
    *   In the new test file, find the section importing agent-specific constants:
        ```python
        from apps.api.agents.business.metrics.main import (
            AGENT_ID as METRICS_AGENT_ID,
            # ... and other constants
        )
        ```
    *   Change this to import from the new agent's `main.py`:
        ```python
        from apps.api.agents.[agent_category].[agent_name].main import (
            AGENT_ID as NEW_AGENT_ID, # Use a consistent alias pattern
            AGENT_NAME as NEW_AGENT_NAME,
            AGENT_VERSION as NEW_AGENT_VERSION,
            AGENT_DESCRIPTION as NEW_AGENT_DESCRIPTION,
            MCP_TARGET_AGENT_ID as NEW_MCP_TARGET_ID,
            CONTEXT_FILE_NAME as NEW_CONTEXT_FILE,
            PRIMARY_CAPABILITY_NAME as NEW_PRIMARY_CAPABILITY
        )
        ```
    *   Update the `PROJECT_ROOT` calculation if necessary. For an agent in `apps/api/tests/integration/agents/[category]/[agent_name]/test_[agent_name]_service.py`, `Path(__file__).resolve().parents[7]` should still point to the project root. Double-check this.
    *   Update `AGENT_CONTEXT_FILE_PATH` to use the new agent's context file name.
4.  **Update Fixture `client_and_app`:**
    *   Modify the `app.include_router` line to include the new agent's router:
        ```python
        # from apps.api.agents.business.metrics.main import router as metrics_router
        # app.include_router(metrics_router)
        from apps.api.agents.[agent_category].[agent_name].main import router as new_agent_router
        app.include_router(new_agent_router)
        ```
5.  **Update Test Function Names and Docstrings:** Rename test functions and update docstrings to reflect the new agent (e.g., `test_get_metrics_agent_card` becomes `test_get_new_agent_card`).
6.  **Update Assertions:**
    *   In `test_get_[agent_name]_agent_card`:
        *   Assert against the new agent's ID, name, version, description, and capability name.
    *   In `test_get_[agent_name]_agent_discovery_well_known`:
        *   Assert against the new agent's ID.
        *   Update the expected task endpoint path: `f"/agents/[agent_category]/[agent_name]/tasks"`
    *   In `test_[agent_name]_process_message_success`:
        *   Update `mock_mcp_response` if needed.
        *   Update `user_query` if a different one is more suitable.
        *   When constructing `expected_prompt_for_mcp`, ensure it uses the correct context file content for the new agent.
        *   The `mock_send_to_mcp.assert_called_once_with` should use `NEW_MCP_TARGET_ID`.
    *   In error handling tests (`test_[agent_name]_process_message_mcp_connection_error`, `_mcp_timeout_error`, `_mcp_unexpected_error`):
        *   Ensure they are testing the new agent's endpoint.
        *   The mocked method `apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate` and `A2AAgentBaseService._get_error_response_message` remain the same as they are part of the base service or shared client.
        *   Update any agent-specific details in the error messages or setup if necessary (though usually not, as these test base class error handling).
7.  **Critical Check**: The core logic of how `MCPContextAgentBaseService` interacts with `MCPClient` (i.e., calling `query_agent_aggregate`) and how prompts are constructed (context + user query) should remain **identical** to the `metrics` agent test. Do not change the mocked methods or the fundamental structure of these assertions unless the base service itself has changed.

### 4. Run Tests

1.  Navigate to the project root in your terminal.
2.  Ensure your Python environment with `pdm` is active or use the `python3 -m pdm run ...` prefix.
3.  Run the specific test file:
    ```bash
    python3 -m pdm run pytest apps/api/tests/integration/agents/[agent_category]/[agent_name]/test_[agent_name]_service.py
    ```
4.  Run all tests to ensure no regressions:
    ```bash
    python3 -m pdm run pytest
    ```

### 5. Debug

*   If tests fail, carefully compare the failing test and the corresponding agent code against the `metrics` agent's `main.py` and `test_metrics_service.py`.
*   Common issues:
    *   Incorrect paths or constant values.
    *   Typos in agent IDs, names, or endpoint paths.
    *   Mismatched expected prompt for MCP.
    *   Incorrect `PROJECT_ROOT` calculation leading to `FileNotFoundError` for the context file.
    *   The `expected_prompt_for_mcp` in `test_[agent_name]_process_message_success` must exactly match how `MCPContextAgentBaseService` constructs it. This often involves: `actual_context_content.rstrip('\n') + "\n\nUser Query: " + user_query`.
    *   The `session_id` passed to `query_agent_aggregate` by the base service is the `task_id` from the request, or `None` if not provided.

By strictly adhering to the `metrics` agent as a template, the testing phase should be significantly smoother. 