# Context Agent — Authoring Guide

Status: Living spec (v0). Use this to define and validate Context agents via the Agent Builder.

## Purpose
Context agents are LLM-backed specialists that use embedded markdown context and structured prompts to converse/plan/build. They do not call external transports directly (no API proxying here).

## Agent Row → YAML Mapping
- id (DB, UUID)
- organization_slug (DB, null for global)
- slug (DB; unique per org)
- display_name (DB)
- description (DB)
- agent_type = "context" (runtime categorization)
- mode_profile (DB; e.g., conversation_only | conversation_with_gate | autonomous_build)
- status (DB; active/draft/inactive)
- yaml (DB; full descriptor stored here)
- context (DB; optional additional context JSON)
- config (DB; optional typed configuration JSON)

## Minimal YAML
```yaml
metadata:
  name: "Requirements Specialist"
  type: "context"
description: "Generates concise requirement specs from structured or textual inputs."
input_modes: [application/json, text/markdown]
output_modes: [text/markdown]

execution_profile: "conversation_only"
configuration:
  execution_capabilities:
    can_plan: true
    can_build: false
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: application/json }
      output: { content_type: text/markdown }
```

## Full YAML (annotated)
```yaml
metadata:
  name: "Requirements Specialist"
  type: "context"
  category: "engineering"
  version: "1.0.0"
description: "Generates concise requirement specs from structured or textual inputs."
input_modes: [application/json, text/markdown, text/plain]
output_modes: [text/markdown]

llm:
  provider: openai
  model: gpt-4o-mini
  system_prompt: |
    You write crisp requirement specs using given inputs. Prefer JSON inputs when available.

prompts:
  system: |
    You are a senior requirements writer. Respond with clear sections and acceptance criteria.

execution_profile: "conversation_only"
configuration:
  execution_capabilities:
    can_plan: true
    can_build: false
    requires_human_gate: false
  transforms:
    expected:
      input: { content_type: application/json, strict: true }
      output: { content_type: text/markdown }
    by_mode:
      converse:
        input: { content_type: text/markdown }
      plan:
        input: { content_type: application/json, strict: true }
    adapters:
      json_to_markdown:
        template: |
          ### Structured Input
          ```json
          {{ json }}
          ```
      markdown_to_json:
        selector:
          type: fenced_json
          required: true

deliverables:
  title_template: "Spec by {agent} on {date}"
  type: document
  format: markdown
```

## IO Contract
- Declare `input_modes` and `output_modes` using MIME types.
- Prefer `application/json` for machine steps; `text/markdown` for human surfaces.
- Optional strict normalization via `configuration.transforms`.

### Dual‑Mode Output Example (Summary + Fenced JSON)
Add both `text/markdown` and `application/json` to `output_modes` and instruct the agent to return a brief summary followed by a fenced JSON block. The runtime will pass this through; downstream agents expecting JSON can extract it.

```yaml
output_modes: [text/markdown, application/json]
llm:
  system_prompt: |
    Provide a concise summary first. Then include a fenced JSON block with `data` that tools can parse, e.g.:
    ```json
    { "data": { ... } }
    ```
configuration:
  transforms:
    expected:
      output: { content_type: text/markdown }
    adapters:
      markdown_to_json:
        selector: { type: fenced_json, required: false }
```

## Execution Model
- `execution_capabilities`: can_converse/can_plan/can_build/requires_human_gate
- `execution_profile`: conversation_only | conversation_with_gate | autonomous_build
- `timeout_seconds` (optional; use card-level or env fallback)

## Security & Redaction
- Logs never include request bodies; metadata only.
- PII policy checks run prior to dispatch; see Phase 2 notes for block behavior.

## Validation & Defaults
- If `strict: true` and input type mismatches, runtime returns `invalid_input_format` (no guessing).
- Without strict, runtime attempts JSON↔Markdown adaptation using adapters.

## Testing
- Provide a sample JSON payload and a markdown prompt; verify normalization and output.
- Confirm `includePrivate=true` card responses (if enabled) show safe metrics only.

## A2A Alignment
- Card endpoints: tasks, health, card.
- Private metadata extensions are feature‑flagged and excluded by default.
