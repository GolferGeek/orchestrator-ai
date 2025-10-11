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

- [x] Confirm versioning + publishing flow for `@orchestrator-ai/transport-types`
- [x] Decide on SSE authentication mechanism (query param vs. cookie) and document
- [x] Verify Supabase migrations ordering (task messages table precedes TTL update)
- [x] Communicate downtime expectations & change window to stakeholders

**Notes:**  
- _2025-02-10:_ Draft stakeholder comms for SSE switchover: target maintenance window **2025-02-13 18:00–18:30 PT** (low-traffic). Notify platform users 24h prior via in-app banner + email; call out that live WebSocket streams will disconnect once, advise refresh, highlight new SSE benefits, and provide fallback instructions.
- _2025-02-10:_ Supabase migration order verified: `202502090001_task_messages_ttl.sql` (creates/augments `task_messages` with TTL + indexes) runs before `202502090002_orchestration_persistence.sql`; both executed successfully on dev Supabase instance.  
- _2025-02-10:_ Stream tokens chosen: short-lived (5–10 min) JWTs bound to `userId` + `taskId`, minted via new `StreamTokenService`, rate limited per user/task, sanitized from logs. Reconnection flow re-fetches a token before reopening EventSource.  
- _2025-02-09:_ `@orchestrator-ai/transport-types` is consumed via `file:../transport-types` links from API/Web workspaces; run `npm install` (workspace) after updates to refresh symlink and `npm run build` inside package to emit `dist`.  

---

### Downtime Communication Plan
- **Audience:** internal teams, beta customers using live task streaming.
- **Notice cadence:** 
  1. T-24h email + in-app banner announcing the upgrade window and SSE benefits.
  2. T-1h reminder in Slack `#launch` + status page update.
  3. Live status page update when deployment starts and completes.
- **Window:** 2025-02-13 18:00–18:30 PT (expected <10 min interruption; 30 min reserved).
- **Impact messaging:** Existing WebSocket streams will drop once; reconnect/refresh to resume. New SSE endpoint provides native browser support and automatic retries.
- **Fallback instructions:** Remind users they can poll task status via REST if SSE fails. Provide help link for reporting regressions.
- **Owner:** Matt (comms), Core Eng (status page), Support (monitor inbound tickets).

---

## Phase 1 – Shared Types & Dependency Cleanup (Day 1)

### Tasks

- [x] Add SSE event interfaces under `apps/transport-types/streaming/sse-events.types.ts`
- [x] Export new SSE types from `apps/transport-types/index.ts`
- [x] Bump workspace consumers and run `npm run build` (root) to validate
- [ ] Remove Socket.IO dependencies  
  - [ ] API: remove `@nestjs/websockets`, `socket.io` from `apps/api/package.json`  
  - [ ] Web: remove `socket.io-client` from `apps/web/package.json`
- [ ] Regenerate lockfiles (`npm install` or workspace equivalent)
- [ ] Ensure type generation / lint pipelines succeed post-removal

**Notes:**  
- _2025-02-10:_ Root `npm run build` succeeded (Turbo build for `apps/api` & `apps/web`) after introducing streaming types; no compile regressions detected.  
- _2025-02-10:_ Socket.IO removal deferred until SSE endpoint + client wiring (Phase 2/3) are ready; removing now would break TaskProgressGateway and websocketService dependencies.  

---

## Phase 2 – Backend SSE Implementation (Day 2)

### 2.1 Morning: SSE Endpoint & Event Flow

- [x] Implement `GET /agent-to-agent/:org/:agent/tasks/:taskId/stream` SSE endpoint
- [x] Add helper to format typed SSE payloads (`formatSSEEvent`)
- [x] Attach SSE stream URL to task response metadata (`streamEndpoint`)
- [x] Wire EventEmitter2 events to SSE writer (chunk/complete/error)
- [x] Introduce keep-alive ping + disconnect cleanup
- [x] Implement `StreamTokenService` + `POST /agent-to-agent/:org/:agent/tasks/:taskId/stream-token` (task-bound, 5–10 min TTL JWT)
- [x] Extend `JwtAuthGuard` to accept query-token fallback with task binding + TTL validation
- [x] Add rate limiting per user/task for stream-token issuance
- [x] Sanitize logs/metrics to strip `token` query params before emit

### 2.2 Storage & Persistence Updates

- [ ] Implement in-memory active task cache updates for live streams
- [x] Ensure TaskMessageService stores messages with TTL metadata
- [x] Create migration adding `expires_at` to `task_messages` (file: `202502090001_task_messages_ttl.sql`)
- [x] Create migrations for orchestrations persistence (`orchestration_steps`, `orchestration_checkpoints`) (file: `202502090002_orchestration_persistence.sql`)
- [ ] Run new migrations in staging / dev environments
- [x] Update task message creation flow to set default expiry (1 hour, adjustable)
- [x] Add cron/worker job to prune expired `task_messages`

### 2.3 Testing & Verification

- [ ] Test SSE endpoint manually (curl/Postman) *(or run Jest spec `apps/api/testing/test/sse-stream.e2e-spec.ts` with `SUPABASE_TEST_USER` / `SUPABASE_TEST_PASSWORD`)*
- [ ] Validate webhook → in-memory → DB → SSE pipeline
- [ ] Confirm polling endpoint still returns recent messages
- [ ] Execute regression suite (`npm test`, targeted integration tests)
- [ ] Force stream token expiration to verify reconnect flow obtains fresh token
- [ ] Document manual verification steps (token issuance curl, SSE stream check, log sanitization)

**Notes:**  
- _2025-02-09:_ Migrations created; awaiting execution and review.  
- Pending decision on configurable TTL (ENV vs. constant).
- _2025-02-09:_ `202502090001_task_messages_ttl.sql` now seeds schema to match `TaskMessageService` (content/message_type/progress_percentage) and sets default expiry.
- _2025-02-10:_ SSE streaming endpoint + stream-token guard flow implemented; keep-alive pings enabled and logging sanitizes query tokens. Task response still needs `streamEndpoint` attachment.
- _2025-02-10:_ TaskMessageService now sets per-message expiry (`TASK_MESSAGE_TTL_MINUTES`, default 60) and prunes expired rows every 15 minutes via cron.
- _2025-02-10:_ Manual verification checklist drafted (curl stream-token, curl SSE with `--header "Accept:text/event-stream"`, confirm `/logs` omit query tokens, POST webhook to ensure task_messages TTL + cron pruning).
- _2025-02-10:_ `agentChatStore` now prefers SSE-based stream subscriptions via `A2AStreamHandler`, falling back to Socket.IO only when metadata lacks endpoints.
- _2025-02-10:_ `blog-post-with-messages.e2e-spec.ts` currently fails to compile — imports still reference `src/tasks/*`; update to new `agent2agent/tasks/*` paths before re-running SSE message tests.

---

## Phase 3 – Frontend SSE Client & Store Integration (Day 3)

### 3.1 SSE Client & Handler

- [x] Implement `SSEClient` wrapper (EventSource + reconnection/backoff)
- [x] Add stream-token fetch/refresh helper that runs before initial connect and on reconnect attempts
- [x] Implement `A2AStreamHandler` bridging SSE events to store callbacks
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
