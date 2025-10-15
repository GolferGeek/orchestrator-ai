# Agent Stack Testing Context (Temporary)

**Extracted from**: role-tester.md
**Purpose**: Specific context for current agent stack testing effort
**To be used by**: role-planner to internalize current project state

---

## Current Testing Context

**Branch**: test-agent-stack
**Started**: 2025-10-14
**Tester**: Claude

**Servers**:
- Web Server: http://localhost:7101 (running in background bash 26738d)
- API Server: http://localhost:7100 (running in background bash f74bf0)
- Browser: Firefox at localhost:7101 (manually opened)

**Testing Environment**:
1. ✅ **Web Server Running** - localhost:7101 (Vite dev server)
2. ✅ **API Server Running** - localhost:7100 (NestJS with hot reload)
3. ✅ **Browser Open** - Firefox at localhost:7101
4. ✅ **Console Monitoring** - Real-time logs from web and API
5. ✅ **Browser Console** - Client-side JavaScript logs and errors
6. ✅ **Code Editor** - Can modify and hot-reload both front-end and API

---

## Progressive Test Phases (PRD Content)

### Phase 1: Context Agent (Blog Post Writer)

**Tests**:
1. ✅ Create Plan - Can agent create a new plan?
2. ✅ Update Plan - Can agent update existing plan?
3. ✅ Merge Plan - Can agent merge plan changes?
4. ✅ View Plan - Can user see plan in UI?
5. ✅ Delete Plan - Can agent/user delete plan?

**Success Criteria**: All 5 tests pass before moving to Phase 2

---

### Phase 2: Deliverables System

**Tests**:
1. ✅ Create Deliverable - Can agent create deliverable?
2. ✅ Update Deliverable - Can agent update content?
3. ✅ Link to Plan - Is deliverable linked to correct plan?
4. ✅ View Deliverables - Can user see deliverables in UI?
5. ✅ Delete Deliverable - Can agent/user delete?

**Success Criteria**: All 5 tests pass before moving to Phase 3

---

### Phase 3: Plan + Deliverables Integration

**Tests**:
1. ✅ Create Plan with Deliverables - End-to-end flow
2. ✅ Update Plan Updates Deliverables - Cascading changes
3. ✅ Delete Plan Handles Deliverables - Cascade delete or orphan?
4. ✅ Deliverable Status Reflects Plan State
5. ✅ UI Shows Plan-Deliverable Relationship

**Success Criteria**: All 5 tests pass before moving to Phase 4

---

### Phase 4: API Agents

**Tests**:
1. ✅ Invoke API Agent - Can system call external API agent?
2. ✅ Agent Response Handling - Does system process response?
3. ✅ Agent Error Handling - What happens on agent failure?
4. ✅ Agent Timeout - Does system handle slow agents?
5. ✅ Agent Authentication - Are credentials passed correctly?

**Success Criteria**: All 5 tests pass before moving to Phase 5

---

### Phase 5: API Agents + Plan + Deliverables (Build Step)

**Tests**:
1. ✅ Agent Executes Plan - API agent reads and follows plan
2. ✅ Agent Creates Deliverables - Output becomes deliverable
3. ✅ Agent Updates Plan Status - Plan reflects agent progress
4. ✅ Agent Failures Don't Break Plan - Graceful degradation
5. ✅ Complete Build Flow - End-to-end with all components

**Success Criteria**: All 5 tests pass before moving to Phase 6

---

### Phase 6: Function Agents (Image Writers - Global Pool)

**Tests**:
1. ✅ Discover Function Agents - System finds global agents
2. ✅ Invoke Image Writer - Can generate images
3. ✅ Image Deliverable Created - Output stored correctly
4. ✅ Function Agent Error Handling
5. ✅ Function Agent in Build Flow - Works with plan/deliverables

**Success Criteria**: All 5 tests pass before moving to Phase 7

---

### Phase 7: Orchestrator

**Tests**:
1. ✅ Orchestrator Starts Multi-Agent Flow
2. ✅ Orchestrator Coordinates Agent Sequence
3. ✅ Orchestrator Handles Agent Dependencies
4. ✅ Orchestrator Aggregates Results
5. ✅ Orchestrator Error Recovery
6. ✅ Complete Orchestration End-to-End

**Success Criteria**: All 6 tests pass - **System fully tested**

---

## Test Tracking Document

**File**: `docs/feature/matt/agent-stack-test-progress.md`

**Format**:
```markdown
# Agent Stack Progressive Test Progress

**Branch**: test-agent-stack
**Started**: 2025-10-14
**Tester**: Claude

---

## Phase 1: Context Agent (Blog Post Writer)

| # | Test | Status | Date | Notes |
|---|------|--------|------|-------|
| 1 | Create Plan | ✅ PASS | 2025-10-14 | Fixed PlanDTO type |
| 2 | Update Plan | 🟡 IN PROGRESS | - | - |
| 3 | Merge Plan | ⏳ PENDING | - | - |
| 4 | View Plan | ⏳ PENDING | - | - |
| 5 | Delete Plan | ⏳ PENDING | - | - |

**Phase Status**: 🟡 IN PROGRESS (1/5 complete)

---

## Phase 2: Deliverables System
[Not started yet]

...
```

---

## Quick Reference: Console Commands

### Check Web Server Logs
```bash
BashOutput(bash_id: "26738d")
```

### Check API Server Logs
```bash
BashOutput(bash_id: "f74bf0")
```

### Common Log Patterns

**API Success**:
```
[Nest] 86234 - POST /api/plans/create +2ms
[Nest] 86234 - Plan created successfully: plan-123
```

**API Error**:
```
[Nest] 86234 - ERROR [PlansService] Failed to create plan
[Nest] 86234 - Error: Invalid plan structure
    at PlansService.create (plans.service.ts:45)
```

**Web/Vite**:
```
12:00:00 [vite] page reload src/components/Plan.tsx
```

**Browser Console Error**:
```
Uncaught TypeError: Cannot read property 'id' of undefined
    at PlanComponent.tsx:23
```

---

## Quick Start Checklist for Tester Role

When you start a new session:

- [ ] Check branch: `git branch` (should be on test-agent-stack)
- [ ] Check servers: Are web (7101) and API (7100) running?
- [ ] Check browser: Is Firefox open at localhost:7101?
- [ ] Read test tracking doc: Where did I leave off?
- [ ] Check console output: Any errors or issues since last session?
- [ ] Resume testing: Continue with next pending test
