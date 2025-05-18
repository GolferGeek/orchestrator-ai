# System Architecture - Orchestrator AI v0.1.0

## 1. Overview

This document details the architecture of the Orchestrator AI system (version 0.1.0). The system is designed as a conversational AI platform that utilizes a central orchestrator agent to manage and delegate tasks to various specialized sub-agents. User interaction is facilitated through a web-based interface built with Ionic Vue.

The primary goals of this architecture are modularity, enabling easy addition of new specialized agents, and contextual conversation management, allowing for more natural and extended interactions.

## 2. Components

The system comprises three main high-level components: Frontend, Backend (API), and Shared Utilities (though minimal in v0.1).

### 2.1. Frontend (`apps/web`)

*   **Technology**: Ionic Framework with Vue.js.
*   **Purpose**: Provides a responsive, user-friendly chat interface for users to interact with the backend orchestrator agent.
*   **Key Features**:
    *   Sends user messages to the orchestrator's `/tasks` endpoint.
    *   Receives and displays agent responses in real-time (or asynchronously for long tasks).
    *   Manages a `session_id` in its local state (e.g., via Pinia store `sessionStore.ts`). This `session_id` is included in requests to the backend to maintain conversational context.
    *   Updates its `currentSessionId` based on the `session_id` field received in the `TaskResponse` from the backend.

### 2.2. Backend (`apps/api`)

*   **Technology**: FastAPI (Python framework).
*   **Purpose**: Hosts the orchestrator agent, specialized sub-agents, and defines the communication protocols between them.

    #### 2.2.1. Orchestrator Agent (`apps/api/agents/orchestrator/main.py`)
    *   **Role**: The central nervous system of the multi-agent setup.
    *   **Functionality**:
        *   Receives user messages (via `TaskSendParams`) from the frontend through its `/tasks` endpoint.
        *   Manages chat history for each session using Langchain's `FileChatMessageHistory`, storing session logs in `apps/api/agents/orchestrator/chat_sessions/`.
        *   Utilizes the `OpenAIService` to make decisions based on the user's query, the ongoing chat history, and a list of available sub-agents.
        *   Decision outcomes include:
            *   **Respond Directly**: If the query is simple or can be answered using its own knowledge and the chat history.
            *   **Delegate**: If the query requires specialized knowledge/action, it forwards the task (or a reformulated query) to an appropriate sub-agent.
            *   **Clarify**: If the query is ambiguous, it asks the user for more details.
            *   **Cannot Handle**: If the request is out of scope.
        *   Communicates with sub-agents by making HTTP POST requests to their respective `/tasks` endpoints, adhering to the A2A protocol.

    #### 2.2.2. Specialized Sub-Agents (e.g., `apps/api/agents/marketing/blog_post/main.py`, `apps/api/agents/business/metrics/main.py`)
    *   **Role**: Each sub-agent is an expert in a specific domain or task.
    *   **Structure**: Typically, each agent resides in its own directory (e.g., `apps/api/agents/[category]/[agent_name]/main.py`).
    *   **Functionality**: Implements the `A2AAgentBaseService` and exposes a `/tasks` endpoint to receive tasks from the orchestrator (or other agents).
    *   They process the task and return a result according to the A2A protocol.

    #### 2.2.3. Agent-to-Agent (A2A) Protocol (`apps/api/a2a_protocol/`)
    *   **Purpose**: Defines a standardized way for agents to communicate.
    *   **Components**:
        *   `A2AAgentBaseService`: An abstract base class that agents can implement to handle common A2A interactions like task sending, getting, and canceling.
        *   Pydantic Models (`types.py`): Defines structures like `Task`, `Message`, `TextPart`, `TaskSendParams`, `AgentCard` for consistent data exchange.
        *   `TaskStoreService`: Manages the persistence and retrieval of task state and history (in-memory for v0.1, but extensible).

    #### 2.2.4. LLM Service (`apps/api/llm/openai_service.py`)
    *   **Purpose**: Abstracts interactions with Large Language Models, specifically OpenAI's Chat Completions API in v0.1.
    *   **Key Methods**:
        *   `get_chat_completion()`: Generic method to get completions from OpenAI.
        *   `decide_orchestration_action()`: A specialized method used by the Orchestrator. It takes the user query, available agents (with descriptions), and chat history as input, and prompts the LLM to return a structured JSON decision (e.g., delegate, respond directly).

    #### 2.2.5. Configuration (`apps/api/core/config.py`)
    *   **Purpose**: Manages application settings and environment variables.
    *   **Implementation**: Uses Pydantic's `BaseSettings` to load configuration from an `.env` file located at the project root (e.g., `OPENAI_API_KEY`).
    *   The `model_config` is set to `extra='ignore'` to allow other tools in the monorepo to use the same `.env` file without causing validation errors for API-specific settings.

### 2.3. Shared Code (`shared/`)

*   **Purpose**: Intended for code, utilities, or Pydantic models that might be used by multiple applications within the monorepo (e.g., both `apps/api` and potentially other backend services or tools).
*   **v0.1 Status**: Contains minimal shared code, primarily demonstrated by `shared/mcp/mcp_routes.py` (if applicable to this project version's active features).

## 3. Data Flow for a Conversational Interaction

Let's trace an example flow: User asks a question requiring recall, then a question requiring delegation.

**Scenario**: 
1. User: "Hi, my name is Matt."
2. User: "Do you remember my name?"
3. User: "Can you write me a blog post about AI ethics?"

**Flow**:

1.  **Initial Message ("Hi, my name is Matt.")**:
    *   **Frontend**: User types "Hi, my name is Matt." Sends a `TaskCreationRequest` (containing the message and current `session_id`, or `null` if new session) to `POST /agents/orchestrator/tasks`.
    *   **Backend (`A2AAgentBaseService.handle_task_send`)**: Receives request. Creates/retrieves task. Determines `effective_session_id`.
    *   Calls `OrchestratorService.process_message` with the message and `effective_session_id`.
    *   **`OrchestratorService.process_message`**: 
        *   Appends "Hi, my name is Matt." to `FileChatMessageHistory` for the session.
        *   Calls `OpenAIService.decide_orchestration_action` with the query, history, and agent list.
    *   **`OpenAIService.decide_orchestration_action`**: Prompts OpenAI LLM. LLM sees the greeting and decides `{"action": "respond_directly", "response_text": "Hello Matt! How can I assist you today?"}`.
    *   **`OrchestratorService.process_message`**: Receives LLM decision. Appends agent's response to chat history.
    *   Returns the response message to `A2AAgentBaseService`.
    *   **Backend (`A2AAgentBaseService.handle_task_send`)**: Updates task as completed. Returns `Task` object (including `session_id` and response) to frontend.
    *   **Frontend**: Displays "Hello Matt! How can I assist you today?". Updates `currentSessionId` from the response if it was newly generated.

2.  **Follow-up Message ("Do you remember my name?")**:
    *   **Frontend**: User types "Do you remember my name?". Sends request with the *same* `session_id`.
    *   **Backend (`A2AAgentBaseService.handle_task_send`)**: Receives request.
    *   Calls `OrchestratorService.process_message`.
    *   **`OrchestratorService.process_message`**: 
        *   Appends "Do you remember my name?" to history.
        *   Calls `OpenAIService.decide_orchestration_action`. History now includes "User: Hi, my name is Matt.", "AI: Hello Matt!...", "User: Do you remember my name?".
    *   **`OpenAIService.decide_orchestration_action`**: LLM analyzes query and history. Decides `{"action": "respond_directly", "response_text": "Yes, your name is Matt."}`.
    *   **`OrchestratorService.process_message`**: Processes decision, updates history.
    *   Returns response through `A2AAgentBaseService` to frontend.
    *   **Frontend**: Displays "Yes, your name is Matt.".

3.  **Delegation Message ("Can you write me a blog post about AI ethics?")**:
    *   **Frontend**: User types query. Sends request with the *same* `session_id`.
    *   **Backend (`A2AAgentBaseService.handle_task_send`)**: Receives request.
    *   Calls `OrchestratorService.process_message`.
    *   **`OrchestratorService.process_message`**: 
        *   Appends query to history.
        *   Calls `OpenAIService.decide_orchestration_action`.
    *   **`OpenAIService.decide_orchestration_action`**: LLM sees the request matches the blog post agent's capability. Decides `{"action": "delegate", "agent_name": "marketing/blog_post", "query_for_agent": "Write a blog post about AI ethics."}`.
    *   **`OrchestratorService.process_message`**: 
        *   Receives delegation decision.
        *   Constructs a *new* `TaskSendParams` for the `marketing/blog_post` agent, including the `query_for_agent` and the *current* `session_id` (to allow sub-agent to also have context if needed).
        *   Makes an HTTP POST request to `http://localhost:8000/agents/marketing/blog_post/tasks` using `httpx.AsyncClient`.
        *   Receives response from blog post agent.
        *   Formats this response as its own response text (e.g., "Okay, I've asked the blog post agent to write about AI ethics. Here's the result: [Blog post content or link/status]").
        *   Appends its own summary/response to chat history.
    *   Returns response through `A2AAgentBaseService` to frontend.
    *   **Frontend**: Displays the orchestrator's confirmation and/or the result from the blog post agent.

## 4. Key Design Principles (v0.1)

*   **Modularity**: Agents are designed as independent services, allowing for easier development, testing, and scaling of specific capabilities.
*   **Centralized Orchestration**: The orchestrator agent handles complex routing and decision-making, simplifying the logic required in specialized agents.
*   **Contextual Conversations**: Session management and chat history are crucial for providing coherent and intelligent interactions.
*   **Standardized Communication**: The A2A protocol ensures agents can interact reliably.

## 5. Future Considerations (Beyond v0.1)

*   More sophisticated task management (e.g., long-running background tasks, progress updates).
*   Persistent `TaskStoreService` (e.g., using a database).
*   Enhanced agent discovery and capability registration.
*   More complex multi-step orchestrations and agent collaboration.
*   Tool usage by agents. 