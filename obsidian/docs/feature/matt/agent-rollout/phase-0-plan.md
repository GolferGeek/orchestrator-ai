# Phase 0: Aggressive Cleanup - Execution Plan

## Overview
This document tracks the execution of Phase 0 cleanup work as defined in `phase-0-aggressive-cleanup-prd.md` and `PHASE-0-TESTING-STRATEGY.md`.

---

## Phase 0.0: Write Smoke Tests (2 hours)

### Tasks
- [ ] Create smoke test suite covering critical user flows
  - [ ] Agent creation
  - [ ] Conversation initiation
  - [ ] Message sending/receiving
  - [ ] Deliverable creation
  - [ ] Agent-to-agent interactions
- [ ] Document test setup and execution in testing strategy
- [ ] Verify all smoke tests pass before proceeding to Phase 0.1

### Notes
- Tests should be simple, fast, and cover the happy path
- Focus on ensuring nothing breaks during aggressive cleanup

---

## Phase 0.1: Backend Triage & Consolidation (3 days)

### Phase 0.1.1: Setup Archive Structure
- [ ] Create `_archive-phase-0/` directory at project root
- [ ] Create `_archive-phase-0/ARCHIVE-DECISIONS.md` with template structure

### Phase 0.1.2: Archive Legacy File-Based Agent Code
- [ ] Identify all file-based agent implementation files
- [ ] Move to `_archive-phase-0/file-based-agents/`
- [ ] Document reasoning in `ARCHIVE-DECISIONS.md`
- [ ] Remove imports from active codebase

### Phase 0.1.3: Consolidate Deliverables into Agent2Agent
- [ ] Audit `deliverables/` directory contents
- [ ] Merge functionality into `agent2agent/`
- [ ] Move remaining files to `_archive-phase-0/deliverables/`
- [ ] Update all import paths
- [ ] Document consolidation decisions

### Phase 0.1.4: Fix Build Errors - Evaluation Phase
- [ ] Run build and collect all errors
- [ ] For each error, evaluate:
  - [ ] Is this function/code still needed?
  - [ ] Is it good quality code?
  - [ ] Is it in the right place?
- [ ] Document all decisions in `ARCHIVE-DECISIONS.md`

### Phase 0.1.5: Fix Build Errors - Integration Phase
- [ ] Implement fixes based on evaluation decisions
- [ ] Move unnecessary code to archive
- [ ] Refactor and relocate code as needed
- [ ] Verify build passes

### Phase 0.1.6: Run Smoke Tests
- [ ] Execute all Phase 0.0 smoke tests
- [ ] Fix any regressions
- [ ] Document any issues found

---

## Phase 0.2: Frontend Cleanup (1 day)

### Phase 0.2.1: Delete Legacy Stores/Services
- [ ] Identify legacy agent stores
- [ ] Remove legacy agent services
- [ ] Update components to use new services only
- [ ] Fix any broken imports

### Phase 0.2.2: Rename Agent2Agent Services
- [ ] Rename `agent2agentService` to simpler name
- [ ] Rename `agent2agentStore` to simpler name
- [ ] Update all references across codebase
- [ ] Document naming decisions

### Phase 0.2.3: Remove agent.source Routing Logic
- [ ] Find all instances of `agent.source` checks
- [ ] Remove conditional routing based on source
- [ ] Simplify code paths
- [ ] Verify no regressions

### Phase 0.2.4: Run Smoke Tests
- [ ] Execute all Phase 0.0 smoke tests
- [ ] Fix any regressions
- [ ] Document any issues found

---

## Phase 0.3: Verification & Testing (0.5 days)

### Tasks
- [ ] Run full test suite
- [ ] Run all smoke tests
- [ ] Manual QA of critical flows
- [ ] Verify build is clean (no errors/warnings)
- [ ] Review `ARCHIVE-DECISIONS.md` for completeness

---

## Phase 0.4: Configure CI/CD (0.5 days)

### Tasks
- [ ] Set up automated test execution in CI pipeline
- [ ] Configure build verification
- [ ] Set up smoke test execution on PRs
- [ ] Document CI/CD setup

---

## Completion Criteria

- [ ] All smoke tests passing
- [ ] Build is clean with no errors
- [ ] Legacy code moved to `_archive-phase-0/`
- [ ] `deliverables/` consolidated into `agent2agent/`
- [ ] Frontend using only new agent services
- [ ] All decisions documented in `ARCHIVE-DECISIONS.md`
- [ ] CI/CD pipeline configured and running

---

## Notes & Decisions Log

### Session Log
*Add timestamped notes here as work progresses*

- **2025-10-04**: Created phase-0-plan.md to track execution progress

---

## Current Status

**Current Phase:** Not Started
**Last Updated:** 2025-10-04
**Next Task:** Phase 0.0 - Create smoke test suite
