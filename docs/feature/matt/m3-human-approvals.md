# M3.4 — Human-in-the-Loop Approvals

Objective
- Pause gated executions until a human approves or rejects. Track decisions in the database and expose minimal API endpoints for actions.

Data Model
- Table: `public.human_approvals` (migration 202501210004).
  - Columns: `id`, `organization_slug`, `agent_slug`, `conversation_id`, `task_id`, `mode`, `status` (`pending|approved|rejected`), `approved_by`, `decision_at`, `metadata`, timestamps.
  - Indexes: by `conversation_id`, `status`.
  - Trigger: auto‑update `updated_at`.

Flow
1) Gate creation
   - When an agent/step requires approval (e.g., `execution.requiresHumanGate`), create a `human_approvals` row with `status=pending`.
   - Return `approvalId` in assistant message metadata; set task/run state to `pending_approval` or `paused_for_approval`.
2) Approve
   - On approval, update status to `approved`, set `approved_by` and `decision_at`, and resume execution.
3) Reject
   - On rejection, update status to `rejected` and short‑circuit execution with a structured failure envelope.

API
- List: `GET /api/agent-approvals?status=pending&conversationId=<id>&agentSlug=<slug>`
- Approve: `POST /api/agent-approvals/:id/approve`
- Reject: `POST /api/agent-approvals/:id/reject`
- Approve & Continue Build: `POST /agent-to-agent/:orgSlug/:agentSlug/approvals/:id/continue`

Response Shape
```
{ success: true, data: { id, status, approved_by, decision_at, ... } }
```

UI/Client
- Chat store auto‑approves when a prior assistant message carries `metadata.approvalId` and a direct user “yes/approve” intent is detected.
- Websocket subscribers continue to receive `agent.stream.*` events upon resume.

Acceptance Tests
- Pending: task/run enters paused state and returns `approvalId`.
- Approve: updates row and resumes execution; final result returned; stream completes.
- Reject: updates row and returns structured failure; no further dispatch.
- List: list endpoint filters by `status`, `conversation_id`, `agent_slug` and orders by `created_at` desc.

Notes
- Approvals are intentionally minimal and API‑first; orchestration‑specific UI/flows are deferred.
