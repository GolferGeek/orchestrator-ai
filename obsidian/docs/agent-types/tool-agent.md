# Tool Agent — Authoring Guide

Status: Living spec (v0). Use this to define Tool agents that execute local TypeScript/Python functions or MCP tools.

## Purpose
Tool agents produce outputs by running function code. They can be composed in pipelines (JSON in/out) or paired with context for human-facing results.

## Agent Row → YAML Mapping
- id, organization_slug, slug, display_name, description, agent_type = "tool", mode_profile, status
- yaml (descriptor)
- config (typed JSON)

## Minimal YAML (TypeScript function)
```yaml
metadata:
  name: "CSV → JSON"
  type: "tool"
description: "Converts CSV input to JSON array"
input_modes: [text/plain]
output_modes: [application/json]

function:
  language: typescript
  module: "src/tools/csv_to_json.ts"
  handler: "convert"

configuration:
  execution_capabilities:
    can_plan: false
    can_build: true
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: text/plain, strict: true }
      output: { content_type: application/json }
```

## Full YAML (Python or MCP)
```yaml
metadata:
  name: "Web Snapshotter"
  type: "tool"
  category: "data"
  version: "1.0.0"
description: "Fetches a web page, extracts title/body, returns JSON"
input_modes: [application/json]
output_modes: [application/json]

function:
  language: python
  module: "tools/web/snapshot.py"
  handler: "run"
  sandbox: "subprocess" # optional, or "inline"

# Alternative (MCP):
# mcp:
#   provider: "vendor/mcp-server"
#   tool: "search_web"
#   parameters_schema: {...}

configuration:
  execution_capabilities:
    can_plan: false
    can_build: true
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: application/json, strict: true }
      output: { content_type: application/json }

deliverables:
  title_template: "Snapshot by {agent} on {date}"
  type: report
  format: json
```

## IO Contract
- Use MIME types in `input_modes`/`output_modes`.
- Use strict mode for functions to ensure deterministic inputs.

## Execution Model
- `execution_capabilities`: function tools typically set `can_build: true`.
- `execution_profile`: conversation_only or autonomous_build depending on use.
- `timeout_seconds` as needed.

## Security & Redaction
- Avoid logging inputs; record only types/metadata.
- If subprocess is used, ensure sandboxing policy is explicit.

## Deliverables
- Build outputs can automatically create deliverables; use `deliverableId` to store enhancements as versions.

## Validation & Defaults
- If handler/module missing, Builder must block creation.
- For MCP tools, validate tool name and parameter schema.

## Testing
- Provide sample inputs; verify adapter converts CSV→JSON, etc.
- Validate strict failure on mismatched content types.

## A2A Alignment
- Card endpoints: tasks, health, card.
- Private metadata disabled by default.
