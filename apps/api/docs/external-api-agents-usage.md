# External/API Agents — Minimal Request/Response Usage

This guide shows how to call API and External (A2A) agents using the new database-driven runtime. For these agents, we do not invoke our LLM service. We simply forward the prompt to the configured endpoint and return the response.

## Endpoints

- Agent-to-Agent REST: `POST /agent-to-agent/:orgSlug/:agentSlug/tasks`
  - Use `global` for `:orgSlug` to target global agents.
  - Body is a simple JSON payload (see examples below).

## Minimal Call Pattern (API Agent)

Example: call the jokes agent using only a prompt and optional per-request headers.

Request
```
POST /agent-to-agent/global/jokes_agent/tasks
Content-Type: application/json
X-Agent-Api-Key: <your-api-key>

{
  "mode": "converse",
  "userMessage": "Tell me a quick productivity joke",
  "payload": {
    "options": {
      "headers": {
        "X-User-Key": "<user-billing-key>"
      }
    }
  }
}
```

What reaches your n8n webhook
- If the agent YAML has `request_transform` with `template: '{"sessionId": "{{sessionId}}", "prompt": "{{userMessage}}"}'`, we render that exactly and send it.
- Template variables available: `{{userMessage}}`, `{{prompt}}`, `{{sessionId}}`, `{{conversationId}}`, `{{agentSlug}}`, `{{organizationSlug}}`.
- Otherwise, we send the minimal default body: `{ "prompt": "Tell me a quick productivity joke" }`.

Response handling
- If the agent YAML has `response_transform` with `format: field_extraction` and `field: output`, we return just that field as `payload.content`.
- Supports dotted/bracket paths (e.g., `data.items[0].text`). If the value isn’t a string, we JSON-stringify it.
- Otherwise, we stringify the response payload.

Response envelope (from our API)
```
{
  "success": true,
  "mode": "converse",
  "payload": {
    "content": "<final text from your API/field extraction>",
    "metadata": {
      "provider": "external_api",
      "model": "api_endpoint",
      "tier": "external",
      "status": "completed"
    }
  }
}
```

## Minimal Call Pattern (External A2A Agent)

You call our gateway the same way; we will forward a JSON-RPC 2.0 request to the external agent.

Request (same shape)
```
POST /agent-to-agent/global/<external_agent_slug>/tasks
Content-Type: application/json

{
  "mode": "converse",
  "userMessage": "Briefly explain the workflow",
  "payload": {
    "options": {
      "headers": {
        "X-User-Key": "<user-billing-key>"
      }
    }
  }
}
```

What we send to the external A2A endpoint
```
{
  "jsonrpc": "2.0",
  "id": 1735689600000,
  "method": "converse",
  "params": {
    "conversationId": "<your-conversation-id>",
    "sessionId": "<your-session-id>",
    "userMessage": "Briefly explain the workflow",
    "messages": [],
    "metadata": { /* merged metadata */ },
    "payload": { /* original payload */ },
    "options": { /* payload.options */ }
  }
}
```

We return the external result as text in `payload.content` with light metadata.

## Health Check (A2A)

- Liveness route per agent: `GET /agent-to-agent/:orgSlug/:agentSlug/health`
- Returns `{ ok: true, service: 'agent-to-agent', organization, agent, timestamp }`
- No secrets or dynamic data; useful for basic health probes

## Passing User-Billed Keys

- Put static headers in the agent definition under `api_configuration.headers` (API agents) or `external_a2a_configuration.authentication.headers` (external agents).
- Add per-request keys in `payload.options.headers` to pass user keys (useful for user-billed usage). We forward these headers as-is.

Header allowlist (env)
- Default forwarded headers: `authorization`, `x-user-key`, `x-api-key`, `x-agent-api-key`, `content-type`.
- Extend via `.env` or `.env.production`:
  - `AGENT_EXTERNAL_HEADER_ALLOWLIST="x-custom-one,x-custom-two"`

Timeouts (env)
- Default 30s if not specified per agent in YAML.
- Override via `.env` or `.env.production`:
  - `AGENT_API_DEFAULT_TIMEOUT_MS=45000`
  - `AGENT_EXTERNAL_DEFAULT_TIMEOUT_MS=45000`

## YAML Transforms (Quick Reference)

- Request transform (API agent):
```
api_configuration:
  request_transform:
    format: "custom"
    template: '{"sessionId": "{{sessionId}}", "prompt": "{{userMessage}}"}'
```
- Response transform (API agent):
```
api_configuration:
  response_transform:
    format: "field_extraction"
    field: "output"
```

These are already present in the demo `jokes_agent` and `golf_rules_agent` configurations.

## Build → Deliverables (Phase 3)

- On successful build tasks, the runtime attempts to auto-create a deliverable when `conversationId` and `userId` are available.
- If you pass a `deliverableId` in `payload.deliverableId` (or `payload.metadata.deliverableId`), the runtime creates a new version of that deliverable instead of creating a new one.
- The response includes `payload.deliverables` when a new deliverable was created.
- Agent config can influence deliverables (optional):
  - `configuration.deliverables.title_template` — e.g., `"Report by {agent} on {date}"` (tokens: `{agent}`, `{date}`, `{conversation}`, `{title}`)
  - `configuration.deliverables.type` — one of `document|analysis|report|plan|requirements`
  - `configuration.deliverables.format` — one of `markdown|text|json|html`

## Human Approvals (Phase 3)

Some agents require a human gate before Build. When triggered, the tasks API returns a human response with an `approvalId` you can act on.

Example human-gated response
```
{
  "success": false,
  "mode": "human_response",
  "humanResponse": {
    "message": "Manual confirmation required before build"
  },
  "payload": {
    "metadata": {
      "humanRequired": true,
      "approvalStatus": "pending",
      "approvalId": "8f1e5f7e-...",
      "mode": "build",
      "agentSlug": "demo_orchestrator",
      "organizationSlug": "global",
      "conversationId": "b2d6a..."
    }
  }
}
```

Approve and continue (single call)
- Endpoint: `POST /agent-to-agent/:orgSlug/:agentSlug/approvals/:id/continue`
- Body (optional): `{ "options": { "stream": true }, "payload": { /* overrides */ } }`
- Uses the stored, gated Build request; returns the normal Build response (with streaming metadata when requested).

Approve only (two-step)
- Endpoint: `POST /api/agent-approvals/:id/approve`
- After approval, re-issue your original Build task call.

List/Reject
- List: `GET /api/agent-approvals?status=pending&conversationId=<id>&agentSlug=<slug>`
- Reject: `POST /api/agent-approvals/:id/reject`
## Error Responses (Legacy Dynamic Agents)

For legacy routes that pass through DynamicAgentsController, failures return HTTP 200 with a standardized payload:

```
{
  "taskId": "...",
  "conversationId": "...",
  "status": "failed",
  "error": {
    "code": "agent_execution_error",
    "message": "<redacted message>"
  },
  "metadata": {
    "agentType": "...",
    "agentName": "...",
    "namespace": "...",
    "timestamp": "2025-01-20T12:34:56.000Z"
  }
}
```

Notes:
- Messages are redacted to avoid leaking secrets (API keys, bearer tokens, etc.).
- PII policy blocks return a `blocked: true` structure with a human‑safe reason.
