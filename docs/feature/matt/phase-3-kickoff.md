# Phase 3 — Agent Feature Parity Kickoff

Status: Ready to start
Owner: Codex with Matt

## Objectives
- Rebuild task lifecycle on the new runtime: creation → progress → completion/failure
- Deliverables: persistence, versioning, enhancement workflow
- Logging/PII: structured logs + pseudonymization/redaction integration
- Human-in-the-loop: gates, approvals, and run controls where applicable

## Workstreams
1) Task Lifecycle
- Normalize task model across A2A flows
- Progress updates via stream events (reuse AgentRuntimeStreamService)
- Failure codes and structured error envelopes

2) Deliverables
- Create/attach deliverables on build success
- Versioning API (promote/copy/enhance)
- Minimal UI hooks preserved via existing endpoints

3) PII/Pseudonymization
- Plug Dictionary/LLM redaction at dispatch boundaries where needed
- Preserve policy metadata on responses

4) Human-in-the-loop
- Gate build operations when `requiresHumanGate` is true
- Approval/continue hooks via gateway (no custom endpoints)

## Milestones
- M3.1: Task lifecycle parity (A2A)
- M3.2: Deliverables persistence + versioning
- M3.3: PII/pseudonymization integrated in dispatch + logs
- M3.4: Human-in-the-loop gates + approvals

## Success Criteria
- End-to-end parity scenarios pass on DB runtime without legacy base services
- Deliverables create + version reliably; errors are structured and discoverable
- No secrets in logs; PII policy metadata preserved

---

Dependencies
- Phase 2 summary: `docs/feature/matt/phase-2-runtime-summary.md`
- Usage details: `apps/api/docs/external-api-agents-usage.md`
