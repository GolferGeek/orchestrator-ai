# External Agent (A2A) — Authoring Guide

Status: Living spec (v0). Use this to define and validate External A2A agents (JSON-RPC over HTTP).

## Purpose
External agents are remote A2A services. The runtime sends JSON-RPC requests (`converse`, `plan`, `build`) to your endpoint and unwraps results.

## Agent Row → YAML Mapping
- id, organization_slug, slug, display_name, description, agent_type = "external", mode_profile, status
- yaml (descriptor)
- config (typed JSON)

## Minimal YAML
```yaml
metadata:
  name: "Orchestrator Proxy"
  type: "external"
description: "Proxy to remote A2A orchestrator"
input_modes: [application/json, text/markdown]
output_modes: [application/json, text/markdown]

external_a2a_configuration:
  endpoint: "https://external.agent/jsonrpc"
  protocol: "A2A"
  timeout: 60000
  authentication:
    headers:
      Authorization: "Bearer {{secret}}" # Builder-provided
```

## Full YAML (annotated)
```yaml
metadata:
  name: "External Planner"
  type: "external"
  category: "planning"
  version: "1.0.0"
description: "Uses a remote A2A service to return planning JSON"
input_modes: [application/json]
output_modes: [application/json]

external_a2a_configuration:
  endpoint: "https://api.partner.com/a2a"
  protocol: "A2A"
  timeout: 45000
  authentication:
    headers:
      X-Api-Key: "{{partner_key}}"

configuration:
  execution_capabilities:
    can_plan: true
    can_build: false
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: application/json, strict: true }
      output: { content_type: application/json }

deliverables:
  title_template: "Plan by {agent} on {date}"
  type: plan
  format: json
```

## IO Contract
- Declare input/output modes with MIME types.
- The runtime maps `mode` to JSON-RPC methods: `converse|plan|build`.
- Request params include conversationId/sessionId, messages, metadata, payload, and options.
- Response uses JSON-RPC result; errors are mapped to a safe failure result.

## Transport & Security
- Header allowlist enforced; add custom headers via Builder.
- Logs carry only host, path, status, duration; no payloads.
- Timeouts via YAML or env default.

## Deliverables
- On build success, can auto-create deliverables or version existing deliverables if `deliverableId` is supplied.

## Validation & Defaults
- If remote returns JSON-RPC error, runtime returns a standardized failure with redacted message.

## Testing
- Provide a stub remote that echoes JSON-RPC requests; validate mapping for each mode.

## A2A Alignment
- Card endpoints: tasks, health, card.
- Private metadata disabled by default; flag-gated if needed.
