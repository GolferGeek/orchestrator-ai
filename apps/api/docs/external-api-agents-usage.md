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
- Otherwise, we send the minimal default body: `{ "prompt": "Tell me a quick productivity joke" }`.

Response handling
- If the agent YAML has `response_transform` with `format: field_extraction` and `field: output`, we return just that field as `payload.content`.
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
