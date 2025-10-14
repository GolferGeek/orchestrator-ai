# PRD: Agent Stack Progressive Testing

**Effort Type**: front-end-testing
**Branch**: test-agent-stack
**Started**: 2025-10-14
**Owner**: Matt (GolferGeek)

---

## Problem Statement

The Orchestrator AI system has a complex agent stack (Context Agent, Deliverables, API Agents, Function Agents, Orchestrator) that needs comprehensive front-end and API testing to validate end-to-end functionality.

**Current Challenge**:
- Multiple components interact in complex ways
- Need to verify each layer works independently before testing integration
- Must validate UI, API, and database interactions
- Testing requires monitoring multiple consoles (web, API, browser)

---

## Solution Overview

Progressive testing approach where each phase builds on previous phases:

1. **Phase 1**: Context Agent (Blog Post Writer) - Base plan CRUD operations
2. **Phase 2**: Deliverables System - Deliverable creation and management
3. **Phase 3**: Plan + Deliverables Integration - Combined functionality
4. **Phase 4**: API Agents (Real-Time) - SSE, webhooks, polling, invocation
5. **Phase 5**: API Agents + Plan + Deliverables - Full build workflow
6. **Phase 6**: Function Agents - Global pool image writers
7. **Phase 7**: Orchestrator - Multi-agent coordination with real-time updates

**Testing Method**: Front-end testing with live console monitoring and browser automation

---

## Testing Environment

**Web Server**: http://localhost:7102 (Vite dev server with hot reload)
**API Server**: http://localhost:7100 (NestJS with hot reload)
**Browser**: Playwright @ localhost:7102
**Database**: PostgreSQL (localhost:7012)

**Console Monitoring**:
- Web server console (HMR updates, build warnings)
- API server console (requests, queries, errors, SSE events, webhooks)
- Browser console (JavaScript errors, network issues, SSE connections)

**Real-Time Infrastructure**:
- SSE endpoint for streaming agent progress events
- Webhook endpoints for agent callbacks
- Polling fallback for environments without SSE support

---

## Success Criteria

### Per Phase
- All tests in phase pass completely
- No errors in any console (web, API, browser)
- UI correctly reflects backend state
- Data persists correctly in database

### Overall
- All 7 phases complete with passing tests
- System demonstrates full agent stack functionality with real-time updates
- SSE, webhooks, and polling mechanisms validated
- Test tracking document fully updated
- Any bugs found during testing are fixed

---

## Test Phases

### Phase 1: Context Agent (Blog Post Writer)
**Focus**: Base plan operations

**Tests** (5 total):
1. Create Plan - Can agent create a new plan?
2. Update Plan - Can agent update existing plan?
3. Merge Plan - Can agent merge plan changes?
4. View Plan - Can user see plan in UI?
5. Delete Plan - Can agent/user delete plan?

**Dependencies**: None
**Deliverable**: Phase 1 test results

---

### Phase 2: Deliverables System
**Focus**: Deliverable CRUD operations

**Tests** (5 total):
1. Create Deliverable - Can agent create deliverable?
2. Update Deliverable - Can agent update content?
3. Link to Plan - Is deliverable linked to correct plan?
4. View Deliverables - Can user see deliverables in UI?
5. Delete Deliverable - Can agent/user delete?

**Dependencies**: Phase 1 complete
**Deliverable**: Phase 2 test results

---

### Phase 3: Plan + Deliverables Integration
**Focus**: Combined plan and deliverable workflows

**Tests** (5 total):
1. Create Plan with Deliverables - End-to-end flow
2. Update Plan Updates Deliverables - Cascading changes
3. Delete Plan Handles Deliverables - Cascade delete or orphan?
4. Deliverable Status Reflects Plan State
5. UI Shows Plan-Deliverable Relationship

**Dependencies**: Phases 1 & 2 complete
**Deliverable**: Phase 3 test results

---

### Phase 4: API Agents (Real-Time Communication)
**Focus**: External agent invocation, SSE, webhooks, and polling mechanisms

**Tests** (8 total):
1. Invoke API Agent - Can system call external API agent?
2. SSE Real-Time Updates - Does SSE stream agent progress events?
3. Webhook Callback Handling - Does webhook receive and process agent completion?
4. Polling Fallback - Does polling work when real-time fails?
5. Agent Response Handling - Does system process response correctly?
6. Agent Error Handling - What happens on agent failure?
7. Agent Timeout - Does system handle slow agents?
8. Agent Authentication - Are credentials passed correctly?

**Dependencies**: Phases 1-3 complete
**Deliverable**: Phase 4 test results (validates SSE, webhooks, polling infrastructure)

---

### Phase 5: API Agents + Plan + Deliverables (Build Step)
**Focus**: Full build workflow with agent execution

**Tests** (5 total):
1. Agent Executes Plan - API agent reads and follows plan
2. Agent Creates Deliverables - Output becomes deliverable
3. Agent Updates Plan Status - Plan reflects agent progress
4. Agent Failures Don't Break Plan - Graceful degradation
5. Complete Build Flow - End-to-end with all components

**Dependencies**: Phases 1-4 complete
**Deliverable**: Phase 5 test results

---

### Phase 6: Function Agents (Image Writers - Global Pool)
**Focus**: Global function agent discovery and invocation

**Tests** (5 total):
1. Discover Function Agents - System finds global agents
2. Invoke Image Writer - Can generate images
3. Image Deliverable Created - Output stored correctly
4. Function Agent Error Handling
5. Function Agent in Build Flow - Works with plan/deliverables

**Dependencies**: Phases 1-5 complete
**Deliverable**: Phase 6 test results

---

### Phase 7: Orchestrator
**Focus**: Multi-agent coordination with real-time updates and workflow management

**Tests** (8 total):
1. Orchestrator Starts Multi-Agent Flow
2. Orchestrator Real-Time Progress (SSE) - Live updates as agents execute
3. Orchestrator Webhook Coordination - Agents report back via webhooks
4. Orchestrator Coordinates Agent Sequence
5. Orchestrator Handles Agent Dependencies
6. Orchestrator Aggregates Results
7. Orchestrator Error Recovery
8. Complete Orchestration End-to-End with Real-Time Monitoring

**Dependencies**: Phases 1-6 complete (Phase 4 validates SSE/webhook foundation)
**Deliverable**: Phase 7 test results - **System fully validated with real-time orchestration**

---

## Testing Workflow

### Environment Setup
1. Verify web server running on 7102
2. Verify API server running on 7100
3. Verify browser accessible at localhost:7102
4. Verify Playwright configured
5. Create test tracking document

### Progressive Execution
1. Start with Phase 1, Test 1
2. Execute test, monitor all consoles
3. Verify results (UI, API logs, browser console)
4. Fix any issues found
5. Mark test as passed
6. Move to next test
7. After phase complete, move to next phase
8. Repeat until all phases complete

### Documentation
- Update test tracking document after each test
- Record issues found and fixes applied
- Note any deviations or blockers
- Keep context for future sessions

---

## Out of Scope

- Performance testing
- Load testing
- Security testing
- New feature development (only fix bugs found during testing)

---

## Key Assumptions

1. Testing agent has access to:
   - Web server console via BashOutput
   - API server console via BashOutput
   - Browser automation via Playwright
   - Code editor for fixing issues

2. Hot reload works for both web and API:
   - Code changes trigger automatic reload
   - No manual restart needed

3. Test environment is isolated:
   - Tests don't affect production
   - Database can be reset if needed

---

## Open Questions for GolferGeek

1. Should database be reset between phases or between tests?
2. Should we record test execution videos/screenshots?
3. What should happen to deliverables when plan is deleted?
4. Should failed tests block phase completion or just be noted?

---

## Effort Structure

```
obsidian/efforts/Matt/current/agent-stack-testing/
├── PRD.md (this file)
├── phase-1-context-agent.md
├── phase-1-plan.md
├── phase-2-deliverables.md
├── phase-2-plan.md
├── phase-3-integration.md
├── phase-3-plan.md
├── phase-4-api-agents.md
├── phase-4-plan.md
├── phase-5-build-flow.md
├── phase-5-plan.md
├── phase-6-function-agents.md
├── phase-6-plan.md
├── phase-7-orchestrator.md
├── phase-7-plan.md
├── test-progress.md (live tracking document)
└── progress.md (phase completion tracking)
```

---

**Next Step**: Review this PRD with GolferGeek for approval before creating phase files.
