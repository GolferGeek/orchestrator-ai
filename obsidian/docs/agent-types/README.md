# Agent Types — Authoring Guides

This folder contains living specs for each agent type. They are designed for the Agent Builder and the runtime to share one contract. Expect these to evolve — we’ll refine as we build, and prune when something better replaces it.

- Context Agent: `context-agent.md`
- API Agent: `api-agent.md`
- External Agent (A2A): `external-agent.md`
- Tool Agent: `tool-agent.md`

Each guide includes:
- Purpose & capabilities
- Agent row → YAML mapping (fields the Builder must supply)
- IO contract (input/output modes, normalization expectations)
- Execution model (capabilities/profile/timeouts)
- Transport specifics (per type)
- Deliverables options
- Security & redaction
- Validation & defaults
- Testing guidance
- A2A alignment & card details

Notes
- Use MIME types for IO (e.g., `application/json`, `text/markdown`).
- Keep minimal + full examples copy‑pasta ready for Builder forms.
- When strict mode is on, the runtime fails on mismatched content types instead of guessing.
