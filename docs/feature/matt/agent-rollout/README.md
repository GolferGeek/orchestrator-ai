# Agent Rollout - Phased Implementation Plan

This directory contains the 6-phase roadmap for rolling out the database-driven agent platform, replacing the file-based agent system.

## Overview

The agent platform implementation is broken into 6 sequential phases, each building on the previous phase's foundation. This phased approach ensures:

- **Low risk:** Each phase is independently testable
- **Clear progress:** Easy to track completion and celebrate wins
- **Focused work:** Team can concentrate on one phase at a time
- **Easy rollback:** Issues in one phase don't affect previous phases
- **Predictable timeline:** Each phase has clear scope and estimates

## Phase Summary

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Context Agents (Deliverable Workflow) | 7 days | 🔜 Next |
| 2 | Conversation-Only Agents | 3 days | ⏳ Pending |
| 3 | API Agents (n8n Integration) | 10 days | ⏳ Pending |
| 4 | Migrate File-Based Agents to Database | 10 days | ⏳ Pending |
| 5 | Remove File-Based Agent System | 9 days | ⏳ Pending |
| 6 | Orchestration System | 22 days | ⏳ Pending |
| **Total** | | **~61 days (~3 months)** | |

## Phase Details

### Phase 1: Context Agents (Deliverable Workflow)
**Focus:** Get blog_post_writer working end-to-end

- Complete deliverable lifecycle: converse → plan → build → edit
- Deliverables panel with versions
- LLM rerun functionality
- Separate agent2AgentChatStore for database agents

**Key Deliverable:** blog_post_writer produces deliverables like file-based agents

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

### Phase 5: Remove File-Based Agent System
**Focus:** Clean up legacy code

- Delete DynamicAgentsController
- Remove YAML agent files
- Simplify frontend to single code path
- Reduce codebase by 30-40%

**Key Deliverable:** Clean, maintainable codebase with database-only agents

[📄 Full PRD](./phase-5-remove-file-agents-prd.md)

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
   - Reference PRD in commits: `Phase 1: Implement agent2AgentTasksService`

4. **Testing**
   - Follow testing plan in PRD
   - Complete manual testing checklist
   - Run automated tests

5. **Review and merge**
   - Code review with team
   - QA approval
   - Merge to main

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
Phase 1 (Context Agents)
  ↓
Phase 2 (Conversation-Only)
  ↓
Phase 3 (API Agents)
  ↓
Phase 4 (Migration)
  ↓
Phase 5 (Cleanup)
  ↓
Phase 6 (Orchestration)
```

**Important:** Each phase MUST be complete and stable before starting the next phase.

## Success Criteria for Phase Completion

A phase is considered complete when:

- ✅ All implementation tasks done
- ✅ Manual testing checklist complete
- ✅ Automated tests passing
- ✅ Code reviewed and merged
- ✅ Deployed to production
- ✅ Monitored for 48+ hours with no critical issues
- ✅ Documentation updated

## Risk Management

### General Risks
- **Scope creep:** Stick to PRD scope, defer new ideas to future phases
- **Timeline slippage:** Daily standup to track progress, adjust estimates early
- **Technical debt:** Refactor as you go, don't defer cleanup
- **Breaking changes:** Maintain backward compatibility through Phase 4

### Mitigation Strategies
- **Clear scope:** Each PRD defines in-scope and out-of-scope explicitly
- **Incremental delivery:** Each phase delivers working functionality
- **Backward compatibility:** Phases 1-4 support both systems
- **Rollback plans:** Each PRD includes rollback procedures

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

```markdown
| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1 | ✅ Done | 2025-10-04 | 2025-10-15 | Blog post writer working perfectly |
| 2 | 🔄 In Progress | 2025-10-16 | - | HR agent in QA |
| 3 | ⏳ Pending | - | - | - |
```

## Architecture Evolution

### Phase 1-3: Dual System
- File-based agents ✅ (legacy, working)
- Database agents ✅ (new, in development)
- Routing logic based on agent source

### Phase 4: Migration
- File-based agents ✅ (still working)
- Database agents ✅ (all migrated, validated)
- Both systems fully functional

### Phase 5: Cleanup
- File-based agents ❌ (removed)
- Database agents ✅ (only system)
- Clean, simple codebase

### Phase 6: Orchestration
- Database agents ✅ (mature)
- Orchestration ✅ (new capability)
- Platform feature-complete

## Questions?

If you have questions about any phase:
1. Read the full PRD first
2. Check architecture docs
3. Ask in team channel
4. Update PRD with clarifications

## Related Documentation

- [Agent Platform Unified PRD](../agent-platform-unified-prd.md) - Original vision
- [Database-Driven Agent Architecture](../database-driven-agent-architecture-prd.md) - Architecture details
- [n8n Workflow Sync](../n8n/prd-bidirectional-workflow-sync.md) - n8n integration

---

**Last Updated:** 2025-10-03
**Current Phase:** Phase 1 (Context Agents)
**Next Milestone:** blog_post_writer deliverable workflow working
