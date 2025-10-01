# M3.2 — Deliverables Persistence & Versioning

Objective
- Persist concrete outputs from Build mode as deliverables with version history. Provide an “enhance/version” path to refine outputs without creating new deliverables.

Scope
- Runtime auto‑creates deliverables on Build success when `conversationId` and `userId` are available.
- If `payload.deliverableId` (or `payload.metadata.deliverableId`) is supplied, create a new version instead of a new deliverable.
- Gate creation to Build mode by default via `DELIVERABLES_REQUIRE_BUILD=true` (env).

Data Model
- Tables: `public.deliverables`, `public.deliverable_versions` (see golden master migration).
- `deliverables`: `id`, `user_id`, `conversation_id`, `title`, `type`, timestamps.
- `deliverable_versions`: `id`, `deliverable_id`, `version_number`, `content`, `format`, `is_current_version`, `task_id`, `metadata`, `file_attachments`, timestamps.
- Link task context to versions via `deliverable_versions.task_id`.

Runtime Behavior
- On task completion, extract content and evaluate deliverable gating:
  - If `DELIVERABLES_REQUIRE_BUILD=true` and mode != `build`, do not create.
  - If agent config sets `configuration.create_deliverables=false`, do not create.
- Create flow (no prior ID):
  - Insert `deliverables` with `user_id`, optional `conversation_id`, `title`.
  - Insert `deliverable_versions` with `content`, `format`, `is_current_version=true`, `task_id`, `metadata`.
- Enhance flow (with `deliverableId`):
  - Insert new version with incremented `version_number` and `is_current_version=true`; mark previous current as false.
- Optional agent hints:
  - `configuration.deliverables.title_template` tokens: `{agent}`, `{date}`, `{conversation}`, `{title}`.
  - `configuration.deliverables.type`: `document|analysis|report|plan|requirements|image`.
  - `configuration.deliverables.format`: `markdown|text|json|html|image/*`.

API Envelope
- On create:
```
{
  success: true,
  mode: "build",
  payload: {
    content: "...",
    deliverables: [{ id: "<deliverableId>", versionId: "<versionId>", title: "..." }],
    metadata: { provider: "...", model: "...", streamId: "..." }
  }
}
```
- On enhance:
```
{
  success: true,
  mode: "build",
  payload: {
    content: "...",
    metadata: { newVersionId: "<versionId>", deliverableId: "<deliverableId>" }
  }
}
```

Authoring Guidelines
- Prefer `output_modes` that match intended outputs (e.g., `text/markdown`, `application/json`).
- For API agents that indirectly create deliverables (via Build), keep their response concise and let the runtime persist.
- Legacy behavior can be restored by setting `DELIVERABLES_REQUIRE_BUILD=false` for demos.

Acceptance Tests
- Create on Build: returns `payload.deliverables[0]` and persists `deliverables` + `deliverable_versions` rows.
- Enhance path: passing `payload.deliverableId` creates a new version and updates `is_current_version` flags.
- Gating: with `DELIVERABLES_REQUIRE_BUILD=true`, no deliverable for Plan/Converse; toggling to false allows legacy behavior.
- Metadata: `deliverable_versions.task_id` populated; `format` reflects chosen output mode; optional hints applied.

Notes
- Error paths return standardized envelopes with redacted messages; no secrets in logs.

