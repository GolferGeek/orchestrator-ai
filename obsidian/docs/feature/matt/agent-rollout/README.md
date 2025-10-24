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
| **0** | **Aggressive Cleanup** | 3 days | ✅ **COMPLETE** |
| 1 | Context Agents (Plans & Deliverables) | 7 days | 🔄 In Progress |
| 2 | Conversation-Only Agents | 3 days | ⏳ Pending |
| 3 | API Agents (n8n Integration) | 10 days | ⏳ Pending |
| 4 | Tool Agents (MCP Integration) | 5 days | ⏳ Pending |
| 5 | Agent Builder UI | 10 days | ⏳ Pending |
| 6 | Orchestration Examples (Finance Manager) | 7 days | ⏳ Pending |
| 7 | Enhanced Orchestration | 15 days | ⏳ Pending |
| 8 | Image Generation & Deliverables | 7 days | ⏳ Future |
| 9 | Migrate File-Based Agents to Database | 10 days | ⏳ Future |
| **Total** | | **~77 days (~15 weeks)** | |

**🎯 Current Focus:** Phase 1 - Context Agents with Plans & Deliverables workflow

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
**Focus:** Support agents that only converse (no deliverables)

- `execution_profile: 'conversation_only'` support
- UI adapts based on agent capabilities
- No deliverables panel for conversation-only agents
- Execution capability validation

**Key Deliverable:** HR agent provides helpful conversation without deliverables

[📄 Full PRD](./phase-2-conversation-only-agents-prd.md)

---

### Phase 3: API Agents (n8n Integration)
**Focus:** Complex agents backed by n8n workflows

- API agent execution via webhooks
- Async execution with callbacks
- n8n workflow versioning
- Three reference agents: Metrics, Marketing Swarm, Requirements Writer

**Key Deliverable:** Complex agents offloaded to n8n workflows

[📄 Full PRD](./phase-3-api-agents-prd.md)

---

### Phase 4: Tool Agents (MCP Integration)
**Focus:** Build agents using MCP tools

- Supabase MCP agent for database queries
- Investigate Obsidian MCP for /obsidian folder management
- MCPToolAdapter pattern established
- Tool execution logging and metrics

**Key Deliverable:** Working tool agents that wrap MCP tools

[📄 Full PRD](./phase-4-tool-agents-prd.md)

---

### Phase 5: Agent Builder UI
**Focus:** Visual interface for creating agents

- Template selector with pre-built agents
- Config editor for all agent types
- Live test studio with instant feedback
- Version control and deployment pipeline
- Monitor dashboard for agent analytics

**Key Deliverable:** Non-technical users can create agents through UI

[📄 Full PRD](./phase-5-agent-builder-prd.md)

---

### Phase 6: Orchestration Examples (Finance Manager)
**Focus:** Real-world orchestration with Finance Manager

- Finance Manager orchestrator using tool agents
- Plans → Build workflow with orchestration mode
- Supabase agent for metrics retrieval
- Chart generation and report compilation
- Template for building similar orchestrators

**Key Deliverable:** Working Finance Manager that generates financial reports

[📄 Full PRD](./phase-6-orchestration-examples-prd.md)

---

### Phase 7: Enhanced Orchestration
**Focus:** Advanced multi-agent workflows

- Complex orchestration workflows
- Conditional branching and error handling
- Parallel agent execution
- Human-in-the-loop capabilities
- Visual workflow editor

**Key Deliverable:** Platform supports sophisticated orchestration patterns

[📄 Full PRD](./phase-7-enhanced-orchestration-prd.md)

---

### Phase 8: Image Generation & Deliverables (Future)
**Focus:** Complete image generation and deliverable system

- Image generation agents (OpenAI DALL-E, Gemini Imagen)
- Image storage and versioning
- Asset management integration
- Image deliverables workflow

**Key Deliverable:** Image agents generate and store images

[📄 Full PRD](./phase-8-image-generation-deliverables-prd.md)

---

### Phase 9: Migrate File-Based Agents to Database (Future)
**Focus:** Bulk migration of all demo agents

- YAML → database converter scripts
- Preserve hierarchy relationships
- Side-by-side validation
- 100% feature parity

**Key Deliverable:** All demo agents exist in database with identical behavior

[📄 Full PRD](./phase-9-migration-database-agents-prd.md)

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
Phase 0 (Aggressive Cleanup) ← ✅ COMPLETE
  ↓
Phase 1 (Context Agents - Plans & Deliverables) ← 🔄 IN PROGRESS
  ↓
  ├→ Phase 2 (Conversation-Only Agents)
  │
  ├→ Phase 3 (API Agents - n8n)
  │
  └→ Phase 4 (Tool Agents - MCP)
      ↓
      Phase 5 (Agent Builder UI)
      ↓
      Phase 6 (Orchestration Examples - Finance Manager)
      ↓
      Phase 7 (Enhanced Orchestration)
      ↓
      Phase 8 (Image Generation) - Future
      ↓
      Phase 9 (File-Based Migration) - Future
```

**CRITICAL:** Phase 0 is complete ✅. Phase 1 establishes Plans & Deliverables foundation.

## Success Criteria for Phase Completion

A phase is considered complete when:

- ✅ All implementation tasks done
- ✅ Manual testing checklist complete
- ✅ Automated tests passing
- ✅ Code reviewed and merged
- ✅ Deployed to production (or feature branch for Phase 0-1)
- ✅ Monitored for stability
- ✅ Documentation updated

## Implementation Roadmap

### ✅ Phase 0: Complete (3 days)
- Aggressive cleanup completed
- Legacy code removed
- Clean foundation established

### 🎯 Phase 1: In Progress (7 days)
- Plans & Deliverables workflow
- Mode-based routing (plan, build, tool, orchestrate, converse)
- Version control for plans and deliverables
- Manual edit + LLM refinement workflows

### 📋 Phase 2-3: Agent Capabilities (13 days)
- Conversation-only agents (no deliverables)
- n8n API agents (complex workflows)
- UI adapts to agent capabilities

### 🔧 Phase 4: Tool Foundation (5 days)
- Supabase MCP agent
- Obsidian MCP investigation
- Tool agent adapter pattern

### 🎨 Phase 5: Agent Builder (10 days)
- Visual agent creation UI
- Template library
- Test studio
- Deployment pipeline

### 📊 Phase 6-7: Orchestration (22 days)
- Finance Manager example (using Supabase agent)
- Enhanced workflow capabilities
- Visual workflow editor

### 🔮 Phase 8-9: Future Enhancements
- Image generation & deliverables
- File-based agent migration

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
| 0 | ✅ Complete | 2025-10-03 | 2025-10-04 | Aggressive cleanup done |
| 1 | 🔄 In Progress | 2025-10-04 | - | Plans & Deliverables |
| 2 | ⏳ Pending | - | - | Conversation-Only Agents |
| 3 | ⏳ Pending | - | - | API Agents (n8n) |
| 4 | ⏳ Pending | - | - | Tool Agents (MCP) |
| 5 | ⏳ Pending | - | - | Agent Builder UI |
| 6 | ⏳ Pending | - | - | Finance Manager Orchestrator |
| 7 | ⏳ Pending | - | - | Enhanced Orchestration |
| 8 | ⏳ Future | - | - | Image Generation |
| 9 | ⏳ Future | - | - | File-Based Migration |

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

**Last Updated:** 2025-10-04
**Current Phase:** Phase 1 (Context Agents - Plans & Deliverables)
**Next Milestone:** Complete Plans & Deliverables workflow
**Architecture:** Mode-based routing (plan | build | tool | orchestrate | converse)
