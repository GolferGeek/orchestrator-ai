# Agent-to-Agent (A2A) Protocols — Planner & Developer Guide

## What A2A Protocols We Use

- **JSON-RPC 2.0 over HTTP**
  - Requests: `jsonrpc: "2.0"`, `method`, `params`, `id`
  - Success: `{ jsonrpc: '2.0', id, result }`
  - Error: `{ jsonrpc: '2.0', id, error: { code, message, data? } }`
  - Shared types: `apps/transport-types/request/json-rpc.types.ts`

- **A2A Task Protocol (Extension on JSON-RPC)**
  - Request `params` structure (TaskRequestParams): mode, conversationId, payload, userMessage, messages[], metadata, etc.
  - Response `result` structure (TaskResponse): `success`, `mode`, `payload { content, metadata }`, optional `humanResponse`, `error`.
  - Shared types:
    - Request: `apps/transport-types/request/task-request.types.ts`
    - Response: `apps/transport-types/response/task-response.types.ts`

- **Modes (Task Modes)**
  - Enumerated in transport types: `plan`, `build`, `converse`, `orchestrate` (and internal orchestration sub-modes).
  - API mapping in controller: JSON-RPC `method` → `AgentTaskMode`.

## Transport Types — Why and How

- **Purpose**: Guarantee that all A2A communications adhere to a stable, versioned interface shared by API and Web.
- **Packages**: `apps/transport-types` exports request/response JSON-RPC contracts, task request/response shapes, enums, JSON types, and SSE event types.
- **Usage Rules**:
  - Always import from `@orchestrator-ai/transport-types` in API and Web for protocol objects.
  - Do not shape-hop; keep A2A envelopes intact through the stack.
  - Validate early (controller) and normalize payloads once; downstream uses normalized DTOs.

## SSE (Server-Sent Events) — Frontend and Backend

- **Why SSE**: Live streaming of agent chunks, completion, errors, and task progress in a push (server→client) channel over HTTP.

- **Backend Emission Path** (API):
  - Controller: `apps/api/src/agent2agent/agent2agent.controller.ts`
    - Endpoint: `GET /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream`
    - Streams with headers: `Content-Type: text/event-stream`, keep-alive, no-cache
    - Emits events: `agent_stream_chunk`, `agent_stream_complete`, `agent_stream_error`
    - Uses typed SSE events from transport types
  - Stream token issuance: `POST /agent-to-agent/:orgSlug/:agentSlug/tasks/:taskId/stream-token` (JWT-protected) for scoped SSE

- **Event Contracts** (Shared):
  - `apps/transport-types/streaming/sse-events.types.ts`
  - Base: `BaseSSEEvent { event, data, id?, retry? }`
  - Context: `AgentStreamContext { streamId, conversationId?, orchestrationRunId?, organizationSlug, agentSlug, mode, timestamp }`
  - Events:
    - `AgentStreamChunkSSEEvent` → event: `agent_stream_chunk`, data: `{ chunk: { type: 'partial'|'final', content, metadata? } }`
    - `AgentStreamCompleteSSEEvent` → event: `agent_stream_complete`, data: `{ type: 'complete' }`
    - `AgentStreamErrorSSEEvent` → event: `agent_stream_error`, data: `{ type: 'error', error }`
    - `TaskProgressSSEEvent` → event: `task_progress`, data: `{ taskId, progress, message?, status, timestamp }`

- **Frontend Consumption**:
  - Client: `apps/web/src/services/agent2agent/sse/sseClient.ts`
  - Provides connection state, reconnection policy, event subscription, and debug logging
  - Always bind handlers for the specific event names above; payloads are JSON-parsed

## A2A Endpoints and URL Structure

- Base path: `/agent-to-agent`
- Organization slug (namespace): `:orgSlug` — use `global` for shared agents
- Agent slug: `:agentSlug`

Key endpoints (Agent2AgentController):
- Create conversation (DB agents):
  - `POST /agent-to-agent/conversations`
- Agent card (public):
  - `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`
  - Also aliased at `GET /agents/:orgSlug/:agentSlug/.well-known/agent.json`
- Execute task (JSON-RPC or direct DTO):
  - `POST /agent-to-agent/:orgSlug/:agentSlug/tasks`
  - Body: JSON-RPC 2.0 with A2A params, or normalized TaskRequestDto
- Stream token (JWT required):
  - `POST /agent-to-agent/:orgSlug/:agentSlug/:taskId/stream-token`
- SSE stream (JWT required, or token claims):
  - `GET /agent-to-agent/:orgSlug/:agentSlug/:taskId/stream`
- Health check (public):
  - `GET /agent-to-agent/:orgSlug/:agentSlug/health`

Notes:
- Controllers normalize organization slug: `global` remains explicit.
- Task creation persists conversation/task before execution; IDs are returned and used for SSE metadata.

## .well-known Agent Metadata (Agent Card)

- Builder: `apps/api/src/agent2agent/services/agent-card-builder.service.ts`
- Public endpoint: `GET /agent-to-agent/:orgSlug/:agentSlug/.well-known/agent.json`
- Purpose: machine-readable metadata describing agent capabilities, modes, IO schemas, and visibility.
- Should be consistent with DB agent record (`agents` table) and YAML config.

## Planner Guidance

- Always specify the mode (`plan`, `build`, `converse`, `orchestrate`) explicitly in JSON-RPC `method`.
- Use transport types for all A2A payloads; do not invent new shapes.
- For streaming tasks, immediately request a stream token, then connect SSE to the `stream` endpoint; handle `chunk`, `complete`, and `error`.
- Namespace handling: prefer `global` when org context isn’t required; keep conversation-bound org consistent to avoid mismatches.
- For tool agents, ensure `configuration.tools` are fully namespaced (e.g., `supabase/execute-sql`).

## Developer Guidance

- Validation: Fail fast with clear messages (missing mode, missing params, unknown agent, namespace mismatch).
- Security: enforce JWT on write/execute endpoints; stream tokens must match task and namespace.
- SSE: set correct headers, keepalive comments, and structured events per shared types; unsubscribe listeners on cleanup.
- Logging: include org, agent, mode, conversationId, jsonrpc id in logs; map HTTP to JSON-RPC error codes consistently.
- Consistency: avoid any fallbacks for providers/models/endpoints; configuration must be explicit and validated.

## References (Code)

- Agent2Agent Controller (endpoints, normalization, SSE):
```129:1641:apps/api/src/agent2agent/agent2agent.controller.ts
// see endpoints, SSE stream implementation, JSON-RPC mapping
```

- Transport Types (protocol contracts):
```1:168:apps/transport-types/streaming/sse-events.types.ts
// SSE event contracts
```
```1:116:apps/transport-types/request/json-rpc.types.ts
// JSON-RPC base types
```
```1:116:apps/transport-types/request/task-request.types.ts
// A2A TaskRequestParams and A2ATaskRequest
```
```1:107:apps/transport-types/response/task-response.types.ts
// TaskResponse and JSON-RPC success/error envelopes
```

- Frontend SSE Client:
```1:288:apps/web/src/services/agent2agent/sse/sseClient.ts
// Typed client for EventSource with reconnection
```
