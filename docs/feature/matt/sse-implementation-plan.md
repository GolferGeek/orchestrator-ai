# SSE Implementation Plan

**Last Updated:** 2025-02-09  
**Owner:** Platform Engineering / SSE Working Group  
**Scope:** Replace Socket.IO-based streaming with A2A-compliant Server-Sent Events across transport-types, API, and web applications.

---

## Status Legend

- [ ] Pending  
- [~] In Progress  
- [x] Complete  
- [!] Blocked / Needs Attention  

Use the adjacent **Notes** sections to log context, decisions, blockers, or follow-up items. Update timestamps whenever status changes materially.

---

## Milestones

| Milestone | Target Date | Owner(s) | Status | Notes |
|-----------|-------------|----------|--------|-------|
| Plan approved & team aligned | 2025-02-10 | Matt / Core Eng | [ ] |  |
| Transport-types package published with SSE contracts | 2025-02-10 | Platform Eng | [ ] |  |
| Backend SSE endpoint live (staging) | 2025-02-12 | API Team | [ ] |  |
| Frontend consuming SSE in staging | 2025-02-13 | Web Team | [ ] |  |
| Regression + load testing complete | 2025-02-14 | QA / Eng | [ ] |  |
| Production deploy | 2025-02-17 | Release Eng | [ ] |  |

---

## Phase 0 – Preparation & Alignment

- [ ] Confirm versioning + publishing flow for `@orchestrator-ai/transport-types`
- [ ] Decide on SSE authentication mechanism (query param vs. cookie) and document
- [ ] Verify Supabase migrations ordering (task messages table precedes TTL update)
- [ ] Communicate downtime expectations & change window to stakeholders

**Notes:**  
- _2025-02-09:_ Need confirmation from security on auth token transport.  
- _2025-02-09:_ `@orchestrator-ai/transport-types` is consumed via `file:../transport-types` links from API/Web workspaces; run `npm install` (workspace) after updates to refresh symlink and `npm run build` inside package to emit `dist`.  
- _2025-02-09:_ Existing SSE (`GET /tasks/:id/progress`) still relies on Bearer headers; EventSource adoption will require JwtAuthGuard to accept a `token` query param (or cookie). Proposal: issue short-lived access tokens via query string until session-cookie approach is vetted.

---

## Phase 1 – Shared Types & Dependency Cleanup (Day 1)

### Tasks

- [ ] Add SSE event interfaces under `apps/transport-types/streaming/sse-events.types.ts`
- [ ] Export new SSE types from `apps/transport-types/index.ts`
- [ ] Bump workspace consumers and run `npm run build` (root) to validate
- [ ] Remove Socket.IO dependencies  
  - [ ] API: remove `@nestjs/websockets`, `socket.io` from `apps/api/package.json`  
  - [ ] Web: remove `socket.io-client` from `apps/web/package.json`
- [ ] Regenerate lockfiles (`npm install` or workspace equivalent)
- [ ] Ensure type generation / lint pipelines succeed post-removal

**Notes:**  
-  |

---

## Phase 2 – Backend SSE Implementation (Day 2)

### 2.1 Morning: SSE Endpoint & Event Flow

- [ ] Implement `GET /agent-to-agent/:org/:agent/tasks/:taskId/stream` SSE endpoint
- [ ] Add helper to format typed SSE payloads (`formatSSEEvent`)
- [ ] Attach SSE stream URL to task response metadata (`streamEndpoint`)
- [ ] Wire EventEmitter2 events to SSE writer (chunk/complete/error)
- [ ] Introduce keep-alive ping + disconnect cleanup

### 2.2 Storage & Persistence Updates

- [ ] Implement in-memory active task cache updates for live streams
- [ ] Ensure TaskMessageService stores messages with TTL metadata
- [x] Create migration adding `expires_at` to `task_messages` (file: `202502090001_task_messages_ttl.sql`)
- [x] Create migrations for orchestrations persistence (`orchestration_steps`, `orchestration_checkpoints`) (file: `202502090002_orchestration_persistence.sql`)
- [ ] Run new migrations in staging / dev environments
- [ ] Update task message creation flow to set default expiry (1 hour, adjustable)
- [ ] Add cron/worker job to prune expired `task_messages`

### 2.3 Testing & Verification

- [ ] Test SSE endpoint manually (curl/Postman)
- [ ] Validate webhook → in-memory → DB → SSE pipeline
- [ ] Confirm polling endpoint still returns recent messages
- [ ] Execute regression suite (`npm test`, targeted integration tests)

**Notes:**  
- _2025-02-09:_ Migrations created; awaiting execution and review.  
- Pending decision on configurable TTL (ENV vs. constant).
- _2025-02-09:_ `202502090001_task_messages_ttl.sql` now seeds schema to match `TaskMessageService` (content/message_type/progress_percentage) and sets default expiry.

---

## Phase 3 – Frontend SSE Client & Store Integration (Day 3)

### 3.1 SSE Client & Handler

- [ ] Implement `SSEClient` wrapper (EventSource + reconnection/backoff)
- [ ] Implement `A2AStreamHandler` bridging SSE events to store callbacks
- [ ] Add typed unit tests for handler (mock EventSource scenarios)
- [ ] Expose connection state changes for UI feedback

### 3.2 Pinia Store Updates

- [ ] Remove Socket.IO-specific state/actions from `agentChatStore`
- [ ] Inject `A2AStreamHandler` via factory/composable
- [ ] Reuse existing mutations (`handleStreamChunk`, etc.) through handler callbacks
- [ ] Validate Vue reactivity (multiple concurrent streams, reconnection)
- [ ] Update associated components/composables as needed (cleanup utilities)

**Notes:**  
-  |

---

## Phase 4 – Testing, Documentation, Launch Readiness (Day 4+)

### 4.1 End-to-End & Load Testing

- [ ] Full task lifecycle test (create → stream → complete)
- [ ] High-frequency update test (~5s cadence)
- [ ] Long-running orchestration test (>1 hour simulated)
- [ ] Reconnection scenarios (network drop, tab sleep/wake)
- [ ] Parallel stream test (multiple conversations)
- [ ] SSE → polling fallback validation mid-stream
- [ ] Load/perf test (target concurrency thresholds)

### 4.2 Documentation & Operational Readiness

- [ ] Update API docs with SSE endpoint & examples
- [ ] Update frontend developer docs (A2A streaming usage)
- [ ] Publish troubleshooting/FAQ (auth issues, reconnection limits)
- [ ] Ensure monitoring/alerting covers SSE failures
- [ ] Prepare release notes + customer comms
- [ ] Schedule production deployment window & rollback plan

**Notes:**  
-  |

---

## Ongoing Tracking

- [ ] Maintain changelog of decisions and deviations from PRD
- [ ] Capture follow-up items for post-launch improvements (e.g., configurable TTL, multiplexing)
- [ ] Review success metrics post-deployment (latency, error rate, adoption)

**Active Follow-Ups:**  
-  |
