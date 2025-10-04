# Agent Rollout - Phased Implementation Plan

This directory contains the complete roadmap for rolling out the database-driven agent platform.

## High-Level Vision

**Read first:** [High-Level Vision PRD](./high-level-vision-prd.md) - Use this as your North Star for all decisions.

## Overview

The agent platform implementation is broken into sequential phases. **Phase 0 is CRITICAL** - it removes all file-based agent code to create a clean foundation for rapid development.

- **Low risk:** Each phase is independently testable
- **Clear progress:** Easy to track completion and celebrate wins
- **Focused work:** Team can concentrate on one phase at a time
- **Easy rollback:** Issues in one phase don't affect previous phases
- **Predictable timeline:** Each phase has clear scope and estimates

## Phase Summary

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| **0** | **Aggressive Cleanup** | 3 days | 🔜 **START HERE** |
| 1 | Context Agents (Deliverable Workflow) | 7 days | ⏳ Pending |
| 2 | Conversation-Only Agents | 3 days | ⏳ Pending |
| 3 | API Agents (n8n Integration) | 10 days | ⏳ Pending |
| 4 | Migrate File-Based Agents to Database | 10 days | ⏳ Pending |
| 5 | Image Generation & Deliverables | 7 days | ⏳ Pending |
| 6 | Orchestration System | 22 days | ⏳ Pending |
| **Total** | | **~62 days (~12.5 weeks)** | |

**🎯 1-Week Goal:** Complete Phases 0-1, ship to main, then iterate on Phases 2-5

## Phase Details

### Phase 0: Aggressive Cleanup ⚡ (REQUIRED FIRST)
**Focus:** Remove all file-based agent code NOW

- Delete DynamicAgentsController and YAML execution code
- Delete legacy frontend store (old agentChatStore)
- Rename agent2Agent services to simpler names
- **Keep demo directory intact** (for reference)
- Single, clean code path

**Why First:**
- Eliminates dual-system confusion forever
- Simplifies ALL future phases
- Faster development (one path, not two)
- Forces commitment to database-only
- Enables 1-week timeline

**Key Deliverable:** Clean codebase ready for rapid Phase 1-5 development

[📄 Full PRD](./phase-0-aggressive-cleanup-prd.md) ← **Read this tomorrow**

---

### Phase 1: Context Agents (Deliverable Workflow)
**Focus:** Get blog_post_writer working end-to-end

- Complete deliverable lifecycle: converse → plan → build → edit
- Deliverables panel with versions
- LLM rerun functionality
- Clean agentChatStore (no routing logic)

**Key Deliverable:** blog_post_writer produces deliverables

[📄 Full PRD](./phase-1-context-agents-prd.md)

---

### Phase 2: Conversation-Only Agents
**Focus:** Get HR agent working as conversation-only

- Support `execution_profile: 'conversation_only'`
- No deliverables panel for conversation-only agents
- UI adapts based on agent capabilities
- Execution capability validation

**Key Deliverable:** HR agent provides helpful conversation without deliverables

[📄 Full PRD](./phase-2-conversation-only-agents-prd.md)

---

### Phase 3: API Agents (n8n Integration)
**Focus:** Implement 3 API agents backed by n8n workflows

- API agent execution via webhooks
- Async execution with callbacks
- Three reference agents:
  - Metrics agent
  - Marketing swarm agent
  - Requirements writer agent
- n8n workflow versioning in git

**Key Deliverable:** Complex agents offloaded to n8n workflows

[📄 Full PRD](./phase-3-api-agents-prd.md)

---

### Phase 4: Migrate File-Based Agents to Database
**Focus:** Bulk migration of all demo agents

- YAML → database converter scripts
- Preserve hierarchy relationships
- Side-by-side validation
- 100% feature parity

**Key Deliverable:** All demo agents exist in database with identical behavior

[📄 Full PRD](./phase-4-migration-database-agents-prd.md)

---

### Phase 5: Image Generation & Deliverables
**Focus:** Complete image generation and deliverable system

- Image generation agents (OpenAI DALL-E, Gemini Imagen)
- Image storage and versioning
- Deliverable workflow completion (plan → build → edit)
- Deliverable versions and history
- Asset management integration

**Key Deliverable:** Image agents generate and store images, deliverables fully functional

[📄 Full PRD](./phase-5-image-generation-deliverables-prd.md)

---

### Phase 6: Orchestration System
**Focus:** Multi-agent workflow orchestration

- Orchestration plans (multi-step workflows)
- Orchestration runs (execution tracking)
- Recipes/capabilities (reusable workflows)
- Nested sub-orchestrations
- Rich orchestration UI panel

**Key Deliverable:** Orchestrators coordinate specialists through complex workflows

[📄 Full PRD](./phase-6-orchestration-prd.md)

---

## Working on a Phase

When starting a new phase:

1. **Read the PRD thoroughly**
   - Understand scope and success criteria
   - Review data models and architecture
   - Check prerequisites

2. **Set up tracking**
   - Create GitHub project or task board
   - Track implementation tasks from PRD
   - Daily progress updates

3. **Development workflow**
   - Work on feature branch: `feature/phase-N-description`
   - Commit frequently with clear messages
   - Reference PRD in commits: `Phase 0: Delete DynamicAgentsController`

4. **Testing**
   - Follow testing plan in PRD
   - Complete manual testing checklist
   - Run automated tests

5. **Review and merge**
   - Code review with team
   - QA approval
   - Merge to feature branch (or main for Phase 0-1)

6. **Deployment**
   - Deploy to staging
   - Smoke testing
   - Deploy to production
   - Monitor for 48 hours

7. **Phase completion**
   - Update status in this README
   - Document lessons learned
   - Celebrate! 🎉

## Dependencies Between Phases

```
Phase 0 (Aggressive Cleanup) ← START HERE
  ↓
Phase 1 (Context Agents)
  ↓
Phase 2 (Conversation-Only)
  ↓
Phase 3 (API Agents)
  ↓
Phase 4 (Migration)
  ↓
Phase 5 (Orchestration)
```

**CRITICAL:** Phase 0 MUST be done first. It creates clean foundation for all other phases.

## Success Criteria for Phase Completion

A phase is considered complete when:

- ✅ All implementation tasks done
- ✅ Manual testing checklist complete
- ✅ Automated tests passing
- ✅ Code reviewed and merged
- ✅ Deployed to production (or feature branch for Phase 0-1)
- ✅ Monitored for stability
- ✅ Documentation updated

## The 1-Week Plan

**Goal:** Ship Phases 0-1 to main in 1 week, then iterate

**Day 1-3: Phase 0 (Aggressive Cleanup)**
- Delete all file-based execution code
- Rename frontend services
- Test existing database agents still work
- Merge to feature branch

**Day 4-7: Phase 1 (Context Agents)**
- Create missing frontend services
- Build deliverables workflow
- Test blog_post_writer end-to-end
- Merge to main

**Week 2+: Iterate on Phases 2-5**
- Ship incrementally
- Get user feedback
- Prioritize based on usage

## Architecture Evolution

### After Phase 0: Clean Slate
- File-based agents ❌ (execution removed, demo/ kept as reference)
- Database agents ✅ (only system)
- Single, clean code path

### After Phase 1: Basic Platform
- Context agents ✅ (deliverable workflow)
- Clean architecture ✅
- Production-ready ✅

### After Phase 5: Full Platform
- All agent types ✅
- Orchestration ✅ (new capability)
- Platform feature-complete ✅

## Risk Management

### General Risks
- **Scope creep:** Stick to PRD scope, defer new ideas to future phases
- **Timeline slippage:** Daily standup to track progress, adjust estimates early
- **Breaking changes:** Phase 0 is big change, test thoroughly

### Mitigation Strategies
- **Clear scope:** Each PRD defines in-scope and out-of-scope explicitly
- **Incremental delivery:** Each phase delivers working functionality
- **Rollback plans:** Each PRD includes rollback procedures
- **Phase 0 first:** Creates clean foundation for everything else

## Communication

### Daily Updates
Share progress in team channel:
- What was completed
- What's in progress
- Any blockers

### Phase Kickoff
- Review PRD with team
- Align on timeline
- Assign tasks

### Phase Completion
- Demo to stakeholders
- Share metrics (before/after)
- Retrospective

## Tracking Progress

Update this README as phases complete:

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 0 | ⏳ Pending | - | - | - |
| 1 | ⏳ Pending | - | - | - |
| 2 | ⏳ Pending | - | - | - |
| 3 | ⏳ Pending | - | - | - |
| 4 | ⏳ Pending | - | - | - |
| 5 | ⏳ Pending | - | - | - |

## Questions?

If you have questions about any phase:
1. Read the [High-Level Vision PRD](./high-level-vision-prd.md) first
2. Read the specific phase PRD
3. Check architecture docs
4. Ask in team channel
5. Update PRD with clarifications

## Related Documentation

- **[High-Level Vision PRD](./high-level-vision-prd.md)** - North Star for all decisions
- [Agent Platform Unified PRD](../agent-platform-unified-prd.md) - Original vision
- [Database-Driven Agent Architecture](../database-driven-agent-architecture-prd.md) - Architecture details
- [n8n Workflow Sync](../n8n/prd-bidirectional-workflow-sync.md) - n8n integration

---

**Last Updated:** 2025-10-03
**Current Phase:** Phase 0 (Aggressive Cleanup)
**Next Milestone:** Clean codebase, ready for Phase 1
**Target:** Ship Phases 0-1 to main in 1 week
