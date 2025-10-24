# API Agent — Authoring Guide

Status: Living spec (v0). Use this to define and validate API agents that deliver or transform content via HTTP endpoints.

## Purpose
API agents wrap external HTTP services (including n8n flows). They don’t use our LLM directly; the runtime forwards a normalized prompt/payload and unwraps the response according to YAML transforms.

## Agent Row → YAML Mapping
- id, organization_slug, slug, display_name, description, agent_type = "api", mode_profile, status
- yaml (descriptor)
- config (typed JSON)

## Minimal YAML
```yaml
metadata:
  name: "Jokes Agent"
  type: "api"
description: "Returns a short, workplace-safe joke"
input_modes: [text/plain]
output_modes: [text/plain]

api_configuration:
  endpoint: "https://example.com/webhook/abc123"
  method: "POST"
  headers: { Content-Type: "application/json" }
  request_transform:
    format: "custom"
    template: '{"sessionId":"{{sessionId}}","prompt":"{{userMessage}}"}'
  response_transform:
    format: "field_extraction"
    field: "output"
```

## Full YAML (annotated)
```yaml
metadata:
  name: "Rules of Golf Expert"
  type: "api"
  category: "golf_knowledge"
  version: "1.0.0"
description: "Authoritative answers via n8n/Rules of Golf workflow"
input_modes: [application/json, text/plain]
output_modes: [text/plain]

api_configuration:
  endpoint: "https://example.com/webhook/8218..."
  method: "POST"
  timeout: 60000
  headers:
    Content-Type: "application/json"
  authentication: null # or { headers: { Authorization: "Bearer ..." } }
  request_transform:
    format: "custom"
    template: '{"sessionId":"{{sessionId}}","conversationId":"{{conversationId}}","prompt":"{{userMessage}}","agent":"{{agentSlug}}","org":"{{organizationSlug}}"}'
  response_transform:
    format: "field_extraction"
    field: "data.answer.text" # dotted/bracket paths supported (e.g., data.items[0].text)

configuration:
  execution_capabilities:
    can_plan: false
    can_build: false
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: text/plain }
      output: { content_type: text/plain }

deliverables:
  title_template: "Answer by {agent} on {date}"
  type: report
  format: text
```

## IO Contract
- input/output modes define MIME types (e.g., text/plain, application/json).
- Request/response transforms control the HTTP body and unwrapping.
- Template variables available: `{{userMessage}}`, `{{prompt}}`, `{{sessionId}}`, `{{conversationId}}`, `{{agentSlug}}`, `{{organizationSlug}}`.
- Response extraction supports dotted/bracket paths.

## Execution Model
- `execution_capabilities` per agent; typically can_converse only for simple API agents.
- Timeouts via `api_configuration.timeout` or env default.

## Transport & Security
- Header allowlist: only `authorization`, `x-user-key`, `x-api-key`, `x-agent-api-key`, `content-type` (extend via env).
- Logs contain host, path, status, duration; never bodies or headers.

## Deliverables
- On build success, if conversationId/userId are present, runtime can auto-create a deliverable; if `payload.deliverableId` is provided, it will create a version instead.

## Validation & Defaults
- If `response_transform.field` is missing or invalid, payload is stringified safely.
- If request template is invalid JSON, runtime falls back to minimal prompt body.

## Testing
- Provide a sample prompt and verify API receives expected body.
- Simulate non-2xx and JSON-RPC‑style error payloads; ensure safe error text.

## A2A Alignment
- Card endpoints: tasks, health, card.
- private metadata disabled by default; feature-flag gated.
