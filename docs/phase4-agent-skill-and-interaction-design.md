# Phase IV: Agent Skill & Interaction Design Details

This document elaborates on the design and implementation strategies for "Phase IV: Full Sub-Agent Implementation" as outlined in the main `agent-framework-build-guide.md`. It focuses on how agents define and expose their capabilities, how they interact within the A2A protocol, and how calling agents (like the Orchestrator) can robustly engage with them.

## 1. Agent API Structure: Generic Tasks vs. Specific Skills

As agents mature beyond context-based bootstrapping (Phase 2), they will develop specific, well-defined skills. To support this, agents should adopt a dual API structure:

*   **Generic `/tasks` Endpoint (Core A2A):**
    *   Handled by the agent's primary service class (e.g., `MetricsService` in `apps/api/agents/business/metrics/main.py`), typically inheriting from `A2AAgentBaseService`.
    *   This endpoint allows any A2A-compliant agent to send a general task or query. The agent uses its internal logic (which might initially be an LLM call via MCP, evolving to more direct logic or tool use) to process this.
    *   This is the fundamental interaction point and is listed in the `endpoints` section of the agent's `.well-known/agent.json`.

*   **Specific Skill Endpoints (Enhanced A2A Capabilities):**
    *   Defined in a dedicated `routes.py` file within the agent's directory (e.g., `apps/api/agents/business/metrics/routes.py`).
    *   Each route (e.g., `/year-to-end-sales`, `/calculate-churn-q2-q3`) represents a discrete, addressable skill.
    *   These routes can take structured input (e.g., Pydantic models) and return structured output, allowing for more precise and reliable operations than purely LLM-interpreted general queries.
    *   Route handlers for these skills would typically leverage the agent's core service logic (from its `main.py`) or its components (e.g., `MCPClient`, database connections, specific tools).

## 2. Advertising Capabilities via `agent.json`

To make specific skills discoverable and usable within the A2A framework:

*   Each specific skill endpoint (defined in the agent's `routes.py`) **must** be advertised in the `capabilities` array of the agent's `.well-known/agent.json` file.
*   A `capability` entry should include:
    *   `name`: A machine-readable name for the skill (e.g., "get_year_to_end_sales").
    *   `description`: A human-readable description of what the skill does.
    *   `endpoint`: The full path to the skill's HTTP endpoint (e.g., `/agents/business/metrics/year-to-end-sales`).
    *   `method`: The HTTP method (e.g., "POST", "GET").
    *   `input_schema` (Optional but Recommended for Phase IV): A JSON schema defining the expected request body or parameters. This would correspond to a Pydantic model.
    *   `output_schema` (Optional but Recommended for Phase IV): A JSON schema defining the expected response body. This would correspond to a Pydantic model.

This approach ensures that the agent is A2A compliant through its generic `/tasks` endpoint while also providing a richer, more structured interface for its specific functionalities.

## 3. Interaction Patterns & Fallback Strategies (Orchestrator Logic)

When a calling agent (e.g., the Orchestrator) needs a capability from another agent:

*   **Discovery:** It can consult the target agent's `agent.json`.
*   **Preferred Path (Specific Skill):** If a declared `capability` matches the required function, the Orchestrator should ideally try to call this specific skill endpoint first. This promotes efficiency, reliability, and structured data exchange.
*   **Handling Specific Skill Failures:**
    *   The Orchestrator should be prepared for failures when calling specific skills (e.g., network issues, `4xx` client errors, `5xx` server errors from the skill).
    *   **Retry Mechanisms:** For transient errors (network, temporary `5xx`), retries with backoff can be implemented.
    *   **Error Analysis:**
        *   `4xx` errors often indicate an issue with the request formulated by the Orchestrator; simply retrying the same way might not help. The Orchestrator might need to re-evaluate or log the error.
        *   Persistent `5xx` errors indicate the specific skill is unreliable.
*   **Fallback to Generic `/tasks` Endpoint (Intelligent Decision):**
    *   A blind, automatic fallback from a failed specific skill call to the generic `/tasks` endpoint is **not always recommended** as it can mask issues with the specific skill.
    *   Instead, if a specific skill call fails persistently, the Orchestrator (potentially using its own LLM or decision logic) should **re-evaluate the original goal**.
    *   It can then decide if it's appropriate to attempt fulfilling the goal by sending a new, possibly more general, request to the target agent's generic `/tasks` endpoint. This new request might need to be rephrased or restructured from the original attempt.
    *   This re-evaluation allows for more robust and intelligent error handling rather than simple retries.
*   **Logging:** All interaction attempts, successes, failures, and fallback decisions should be thoroughly logged for observability and debugging.

This layered approach (specific skills first, with intelligent fallback to generic tasking) allows the system to leverage the precision of defined skills while retaining the flexibility of general A2A communication.

## 4. Benefits of This Design

*   **Clarity & Explicitness:** Agent capabilities are clearly defined and machine-readable.
*   **Structured Data:** Enables the use of Pydantic models for input/output, improving data integrity and reducing reliance on LLM interpretation for everything.
*   **Scalability:** Easy to add new skills to an agent by adding new routes and `agent.json` entries.
*   **Testability:** Individual skills can be tested more directly and reliably.
*   **Performance & Cost:** Direct skill execution can be faster and cheaper than routing everything through a general-purpose LLM via MCP.
*   **Ecosystem Cohesion:** Promotes a richer A2A ecosystem where agents can more effectively leverage each other's specific strengths.

This detailed design will guide the refactoring of bootstrapped agents into fully functional, skill-based components as part of Phase IV. 