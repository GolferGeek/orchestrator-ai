# Phase 5: Remove File-Based Agent System

## Overview
Remove all file-based agent infrastructure from the codebase after successful migration to database agents. Clean up legacy code, simplify architecture, and fully commit to database-driven agent platform.

## Goals
- Delete file-based agent code (controllers, services, loaders)
- Remove YAML agent files
- Clean up frontend file-based stores and services
- Simplify routing (no more file vs database checks)
- Update documentation to reflect database-only approach
- Reduce codebase complexity and maintenance burden

## Prerequisites
- ✅ Phase 4 complete (all agents migrated to database)
- ✅ Migration validated and stable for 1+ week
- ✅ Zero critical issues with database agents
- ✅ User acceptance testing passed
- ✅ Rollback plan tested and ready (just in case)

## Scope

### In Scope
1. **Backend Cleanup**
   - Delete `DynamicAgentsController`
   - Delete YAML agent loader services
   - Remove file-based agent execution logic
   - Delete demo agent YAML files
   - Remove legacy agent type definitions

2. **Frontend Cleanup**
   - Delete `agentChatStore` (file-based)
   - Delete legacy `agentConversationsService`
   - Remove agent source routing logic
   - Simplify to single code path (database only)

3. **Database Cleanup**
   - Archive migration metadata
   - Clean up any temporary migration tables

4. **Documentation Updates**
   - Update architecture diagrams
   - Remove file-based agent references
   - Update developer guides
   - Update API documentation

5. **Configuration Cleanup**
   - Remove file-based agent paths from config
   - Update environment variables
   - Clean up build scripts if needed

### Out of Scope
- New feature development
- Orchestration implementation (Phase 6)
- Performance optimization
- Database schema changes

## Success Criteria

### Code Cleanup Complete When:
1. ✅ All file-based agent code deleted
2. ✅ All YAML agent files removed (or archived)
3. ✅ Frontend has single agent store (agent2AgentChatStore)
4. ✅ No agent.source checks in code
5. ✅ Build passes without errors
6. ✅ All tests pass
7. ✅ Application runs successfully in dev and prod
8. ✅ Zero regressions in functionality

### Quality Gates:
1. ✅ Code coverage maintained or improved
2. ✅ Bundle size reduced
3. ✅ No dead code remains
4. ✅ Documentation accurate and complete
5. ✅ Team reviewed and approved

## Implementation Tasks

### Phase 5.1: Backend Cleanup (3 days)

#### Delete File-Based Controllers
1. **Remove DynamicAgentsController**
   - Delete `apps/api/src/agents/dynamic-agents.controller.ts`
   - Remove from module imports
   - Update API routes

2. **Remove agent loader services**
   - Delete agent YAML loader/parser
   - Delete file-based agent registry
   - Delete agent hierarchy builder (file version)

3. **Clean up agent types**
   - Remove file-based agent type definitions
   - Simplify to database-only types
   - Update imports across codebase

#### Archive YAML Agent Files
4. **Move YAML files to archive**
   ```bash
   mkdir -p archive/legacy-file-agents
   mv apps/api/src/agents/demo/* archive/legacy-file-agents/
   ```
   - Keep as reference for 6 months
   - Document archive location
   - Eventually delete archive

5. **Remove agent directories**
   - Delete `apps/api/src/agents/demo/`
   - Delete `apps/api/src/agents/base/` (if no longer needed)
   - Update tsconfig paths if needed

#### Update Backend Services
6. **Simplify AgentsController**
   - Remove file vs database routing
   - Direct calls to agent registry (database only)
   - Clean up conditional logic

7. **Update agent platform services**
   - AgentRegistryService: database only
   - Remove file system watchers
   - Simplify agent loading

### Phase 5.2: Frontend Cleanup (2 days)

#### Remove Legacy Store
8. **Delete agentChatStore/**
   - Delete `apps/web/src/stores/agentChatStore/` directory
   - This was the file-based agent store
   - All functionality now in agent2AgentChatStore

9. **Rename agent2AgentChatStore → agentChatStore**
   - Rename directory and files
   - Update imports across frontend
   - Simpler naming now that there's only one

#### Remove Legacy Services
10. **Delete legacy agentConversationsService**
    - Delete `apps/web/src/services/agentConversationsService.ts`
    - Old file-based conversation service
    - Functionality in agent2AgentConversationsService

11. **Rename agent2Agent services**
    - `agent2AgentConversationsService` → `agentConversationsService`
    - `agent2AgentTasksService` → `agentTasksService`
    - `agent2AgentDeliverablesService` → `agentDeliverablesService`
    - Simpler names now that there's no ambiguity

#### Simplify Routing Logic
12. **Remove agent.source checks**
    - Search codebase for `agent.source`
    - Delete all conditional routing based on source
    - All agents are database agents now

13. **Update component imports**
    - Replace agent2AgentChatStore imports
    - Replace agent2Agent service imports
    - Update to new simplified names

### Phase 5.3: Database & Config Cleanup (1 day)

14. **Archive migration data**
    - Keep migration logs for reference
    - Remove migration scripts (or move to archive)
    - Clean up migration metadata in agent records (optional)

15. **Update configuration files**
    - Remove file-based agent config
    - Update environment variables
    - Clean up unused paths

16. **Update build scripts**
    - Remove YAML copying if needed
    - Update deployment scripts
    - Verify builds work

### Phase 5.4: Documentation & Testing (2 days)

17. **Update documentation**
    - Architecture overview: database agents only
    - Developer guide: how to create database agents
    - API documentation: remove file-based endpoints
    - Remove references to YAML agents

18. **Update diagrams**
    - System architecture diagram
    - Data flow diagram
    - Service dependency diagram

19. **Comprehensive testing**
    - Run full test suite
    - Manual testing of all agent types
    - Regression testing
    - Performance testing

20. **Create PR and review**
    - Large PR with deletions
    - Team review
    - QA approval
    - Merge to main

### Phase 5.5: Deployment & Monitoring (1 day)

21. **Deploy to staging**
    - Deploy cleanup changes
    - Smoke testing
    - Monitor for errors

22. **Deploy to production**
    - Deploy during low-traffic window
    - Monitor closely
    - Be ready to rollback if needed

23. **Post-deployment monitoring**
    - Watch error rates
    - Check agent execution metrics
    - User feedback
    - Performance metrics

## Files to Delete

### Backend
```
apps/api/src/agents/
├── dynamic-agents.controller.ts ❌ DELETE
├── dynamic-agents.service.ts ❌ DELETE
├── demo/ ❌ DELETE (entire directory)
├── base/ ❌ DELETE (or keep if still used)
└── [any other file-based agent infrastructure]

apps/api/src/agent-conversations/
└── agent-conversations.service.ts ❌ DELETE (old file-based version)
```

### Frontend
```
apps/web/src/stores/
└── agentChatStore/ ❌ DELETE (old file-based store)

apps/web/src/services/
└── agentConversationsService.ts ❌ DELETE (old file-based service)
```

### Configuration
```
Any YAML agent definition files
Any file-based agent configuration
Legacy environment variables
```

## Renames (Simplification)

### Frontend Services
```
agent2AgentConversationsService.ts → agentConversationsService.ts
agent2AgentTasksService.ts → agentTasksService.ts
agent2AgentDeliverablesService.ts → agentDeliverablesService.ts
```

### Frontend Stores
```
stores/agent2AgentChatStore/ → stores/agentChatStore/
```

### Backend Services (if applicable)
```
Agent2AgentConversationsService → AgentConversationsService (maybe keep for clarity)
Agent2AgentTasksService → AgentTasksService (maybe keep for clarity)
```

**Note:** Backend services can keep "Agent2Agent" prefix since it describes the protocol/architecture, not file vs database distinction.

## Testing Strategy

### Automated Testing
1. **Unit tests**
   - All tests pass after deletions
   - Update test imports
   - Remove tests for deleted code

2. **Integration tests**
   - End-to-end agent execution
   - All agent types work
   - Deliverables, conversations, tasks

3. **Regression tests**
   - Compare before/after behavior
   - Same functionality, simpler code

### Manual Testing Checklist
- [ ] Build succeeds with no errors
- [ ] Dev server starts successfully
- [ ] Agent list loads (database agents only)
- [ ] Create conversation with context agent
- [ ] Execute converse, plan, build modes
- [ ] Deliverables panel works
- [ ] Version history works
- [ ] LLM rerun works
- [ ] Conversation-only agent works
- [ ] API agent works (if Phase 3 done)
- [ ] Orchestrator displays correctly (structure only)
- [ ] No console errors or warnings

## Rollback Plan

### If Critical Issues Found:
1. **Immediate rollback**
   - Revert PR
   - Restore file-based agent code
   - Redeploy previous version

2. **Investigate issues**
   - Identify root cause
   - Fix in database agents
   - Test thoroughly

3. **Retry cleanup**
   - Re-execute Phase 5 when ready
   - More testing before deployment

### Rollback Trigger Criteria:
- Critical functionality broken
- High error rate (>5% increase)
- User complaints about missing features
- Performance degradation

## Risks & Mitigations

### Risk: Accidentally delete needed code
**Mitigation:** Thorough code review, git history preservation, quick rollback plan

### Risk: Hidden dependencies on file-based system
**Mitigation:** Grep for references before deleting, comprehensive testing

### Risk: Documentation becomes outdated
**Mitigation:** Update docs as part of this phase, review all references

### Risk: Users confused by changes
**Mitigation:** No user-facing changes, backend cleanup only

## Timeline Estimate
- Phase 5.1 (Backend): 3 days
- Phase 5.2 (Frontend): 2 days
- Phase 5.3 (Database/Config): 1 day
- Phase 5.4 (Documentation): 2 days
- Phase 5.5 (Deployment): 1 day
- **Total: 9 days**

## Dependencies
- Phase 4 complete and stable ✅
- 1+ week of successful database agent usage ✅
- Team approval to proceed ✅
- Rollback plan tested ✅

## Definition of Done
- [ ] All file-based agent code deleted
- [ ] All YAML agent files archived
- [ ] Frontend simplified to single code path
- [ ] Build passes without errors
- [ ] All tests pass
- [ ] Manual testing checklist complete
- [ ] Documentation updated
- [ ] Deployed to production successfully
- [ ] Monitored for 48 hours with no issues
- [ ] Code reviewed and approved
- [ ] Codebase size reduced (verified)

## Benefits of Completion

### Technical Benefits
- **Simpler architecture:** One agent system, not two
- **Less code:** Easier to maintain and understand
- **Fewer bugs:** Single code path reduces edge cases
- **Faster development:** No more dual-system development
- **Better testing:** One system to test thoroughly

### Developer Benefits
- **Clearer mental model:** All agents are database agents
- **Easier onboarding:** Less legacy code to learn
- **Faster feature development:** No routing complexity
- **Better debugging:** Simpler stack traces

### User Benefits
- **More reliable:** Less code = fewer bugs
- **Consistent behavior:** All agents work the same way
- **Better performance:** Optimized single path

## Metrics to Track

### Before Cleanup
- Lines of code
- Bundle size
- Number of services
- Number of controllers
- Build time
- Test coverage

### After Cleanup
- All metrics should improve or stay same
- Track for 1 week post-deployment

## Success Celebration
When Phase 5 is complete and stable:
- **Codebase is 30-40% smaller**
- **Architecture is crystal clear**
- **Foundation is solid for Phase 6 (Orchestration)**
- **Team velocity will increase**

## Notes
This is a pure cleanup phase - no new functionality, just removing legacy code. It should be low-risk because database agents already proven to work. Taking time to test thoroughly ensures smooth transition and sets up success for Phase 6.
