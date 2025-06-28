- sop
- internal_rag
- invoice
- metrics
- chat_support
- email_triage
- voice_receptionist
- voice_summary
- competitors
- external_rag
- market_research
- onboarding
- policy_rag
- leads
- calendar
- content
- meetings
- launcher 

---

## Instructions for Creating Context-Based Specialist Agents

### Objective
The goal is to create a new context-based specialist agent within the NestJS API for each of the agents listed above. These agents will be simple implementations that rely on a well-structured `agent-context.md` file for their knowledge and behavior.

### Process for Each Agent

For each agent name in the list above (e.g., `sop`, `internal_rag`, etc.), follow these steps:

**1. Create the Agent Directory**

Create a new directory inside `apps/api/nestjs/src/agents/actual/specialists/`. The directory name should match the agent name.

*   **Example (for `sop` agent):**
    ```bash
    mkdir -p apps/api/nestjs/src/agents/actual/specialists/sop
    ```

**2. Create the `agent.yaml` Configuration File**

Inside the new agent directory, create a file named `agent.yaml`. This file defines the agent's core metadata.

*   **Structure:**
    ```yaml
    name: "[AgentName]" # e.g., SOP Agent
    description: "A clear, one-sentence description of what this agent does."
    type: "context" # This is a context-based agent
    author: "Your Name/Team"
    class: "[AgentName]AgentService" # e.g., SopAgentService
    path: "specialists/[agent-name]" # e.g., specialists/sop
    ```

*   **Action:** Create a well-defined `agent.yaml` for each agent. The `name`, `description`, `class`, and `path` should be specific to each agent's function.

**3. Create the `context.md` Knowledge File**

This is the most critical file. Create a `context.md` file in the agent's directory. This file will serve as the agent's brain.

*   **Content Guidelines:**
    *   **Persona/Role**: Define the agent's personality, tone, and area of expertise.
    *   **Capabilities**: Clearly list what the agent can and cannot do. Be specific.
    *   **Key Information**: Provide the core knowledge the agent needs. For example, an `invoice` agent's context should include details about invoice fields, status types (paid, pending, overdue), and common queries.
    *   **Data Section**: Include a section with sample/simulated data that the agent can reference to provide realistic responses. This simulates the real data that would be available in production.
    *   **Example Interactions**: Give 2-3 examples of user prompts and the ideal agent response based *only* on the context provided, including references to the data section.

*   **Action:** For each agent, create a high-quality, detailed `context.md` file that gives it a clear purpose and knowledge base. The quality of this file will directly determine the agent's performance.

**4. Create the Agent Service File**

Create the TypeScript service file, named `agent-service.ts`. This class will be very simple and will inherit all its logic from `ContextAgentBaseService`.

*   **File Naming Convention:** `agent-service.ts` (same name for all agents)

*   **Structure:**
    ```typescript
    import { Injectable } from '@nestjs/common';
    import { HttpService } from '@nestjs/axios';
    import { LLMService } from '@/llms/llm.service';
    import { ContextAgentBaseService } from '@agents/base/implementations/base-services/context/context-agent-base.service';

    @Injectable()
    export class [AgentName]AgentService extends ContextAgentBaseService {
      constructor(httpService: HttpService, llmService: LLMService) {
        super(httpService, llmService);
      }
    }
    ```

*   **Action:** Create this file for each agent, replacing `[AgentName]` with the PascalCase version of the agent's name (e.g., `SopAgentService`).

**Example Data Section Structure:**
```markdown
## Sample Data Section

*This section contains simulated [domain] data for realistic responses. In production, this would be replaced by live data connections.*

### [Data Category 1] (Simulated)
- **Item 1**: Relevant details, metrics, dates
- **Item 2**: Specific values, percentages, status info

### [Data Category 2] (Simulated)
- **Metric A**: Current values, trends, benchmarks
- **Metric B**: Performance data, targets, variance

### [Data Category 3] (Simulated)
- **Process X**: Status, timeline, ownership, dependencies
- **Process Y**: Current state, bottlenecks, improvements needed
```

**5. Verification (Important)**

*   **No Module File:** You do **not** need to create a `[agent-name].agent.module.ts` file. The `AgentDiscoveryService` will automatically find and register the agent based on the `agent-service.ts` file.
*   **Final Structure:** After completing the steps for an agent, its directory should look like this:
    ```
    specialists/
    └── [agent-name]/
        ├── agent.yaml
        ├── context.md
        └── agent-service.ts
    ```

Complete these steps for every agent listed at the top of this document.

---

## End-to-End Testing Requirements

After creating all the specialist agents, you must update the primary end-to-end test suite to include them.

**1. Locate the E2E Test File**

The test file you need to modify is:
`apps/api/nestjs/test/e2e-auth-agents.e2e-spec.ts`

**2. Add New Agents to the Test Suite**

*   At the top of the file, find the `specialistAgents` array.
*   Add all the new agent names (e.g., `sop`, `internal_rag`, `invoice`, etc.) to this array.

**3. Add Test Cases**

You must add new test cases for each new agent in two places:

*   **Orchestrator Delegation Tests**: In the `describe('Orchestrator Delegation Tests (E2E)')` block, add new objects to the `orchestratorTestCases` array. Each object should include the `agentName`, a sample `prompt`, and an array of `expectedKeywords` to verify the response.
*   **Direct Specialist Tests**: In the `describe('Specialist Agent Direct Tests')` block, add new objects to the `specialistTestCases` array. Each object should include the `agentName`, a sample `prompt`, and `expectedKeywords`.

**4. Important Rule: Do Not Modify Base Services**

*   **Warning:** Under no circumstances should you modify the base agent services (e.g., `ContextAgentBaseService`, `A2AAgentBaseService`, etc.) to make a test pass.
*   **Reasoning:** The base services are considered stable and have been tested independently. If a test for a new agent fails, the problem is almost certainly within the agent's own files:
    *   The `agent.yaml` configuration.
    *   The quality or content of the `context.md` file.
    *   The test case itself (e.g., the prompt or expected keywords).
*   **Action:** If tests fail, debug the agent's configuration and context, or adjust the test case. Do not alter the framework's base classes. 