# Phase 0: Aggressive Cleanup - Remove Legacy Agent Code

## Overview
Remove all file-based agent execution code from backend and frontend while preserving the demo agent directory for reference. This creates a clean foundation for rapid database-agent development without dual-system complexity.

## Strategic Rationale
**Why cleanup FIRST instead of last:**
- Eliminates routing confusion (no more "file vs database" checks)
- Simplifies all future PRDs (single code path)
- Faster development velocity (no dual maintenance)
- Achieves 1-week timeline for agent platform
- Forces commitment to database-only approach

**The Flip:**
- ❌ Old plan: Build dual → Migrate → Cleanup
- ✅ New plan: Cleanup → Build clean → Win

## Goals
- Delete all file-based agent execution infrastructure
- Preserve demo agent directory (YAML files, types, utilities)
- Rename agent2agent services to simpler names
- Single, clean code path for database agents
- Ready for rapid Phase 1-6 development

## Prerequisites
- ✅ Agent2agent backend services exist and work
- ✅ blog_post_writer, image generators, agent_builder_chat in database
- ✅ Team alignment on database-only commitment

## Scope

### In Scope
1. **Backend Deletions**
   - Delete `DynamicAgentsController`
   - Delete YAML agent loader/parser services
   - Delete file-based agent execution logic
   - Delete file-based routing code
   - Remove legacy agent type handling

2. **Backend Renames (Simplification)**
   - `Agent2AgentController` → keep as-is (describes protocol)
   - `Agent2AgentConversationsService` → `AgentConversationsService`
   - `Agent2AgentTasksService` → `AgentTasksService`
   - `Agent2AgentDeliverablesService` → `AgentDeliverablesService`
   - Module: `agent2agent/` → `agents/` (simpler)

3. **Frontend Deletions**
   - Delete `stores/agentChatStore/` (old file-based store)
   - Delete `services/agentConversationsService.ts` (legacy)
   - Delete any file-based agent utilities
   - Remove agent.source routing logic

4. **Frontend Renames (Simplification)**
   - `stores/agent2AgentChatStore/` → `stores/agentChatStore/`
   - `agent2AgentConversationsService.ts` → `agentConversationsService.ts`
   - `agent2AgentTasksService.ts` → `agentTasksService.ts` (create during rename)
   - `agent2AgentDeliverablesService.ts` → `agentDeliverablesService.ts` (create during rename)

5. **Preserve for Reference**
   - ✅ Keep entire `apps/api/src/agents/demo/` directory
   - ✅ Keep YAML files (templates, documentation)
   - ✅ Keep agent types, interfaces, utilities
   - ✅ Keep base implementations (may be useful)

### Out of Scope
- New feature development (Phases 1-6)
- Database schema changes
- Agent migration (already done for key agents)
- Documentation updates (do in Phase 1)

## Success Criteria

### Code Cleanup Complete When:
1. ✅ DynamicAgentsController deleted
2. ✅ YAML loader/execution code deleted
3. ✅ File-based store deleted
4. ✅ All agent.source checks removed
5. ✅ Services renamed (no "agent2agent" prefix)
6. ✅ Stores renamed (single agentChatStore)
7. ✅ Build passes without errors
8. ✅ Existing database agents still work
9. ✅ Demo directory preserved intact

### Quality Gates:
1. ✅ blog_post_writer still works (regression test)
2. ✅ Conversation list still works
3. ✅ Agent hierarchy still displays
4. ✅ No console errors
5. ✅ Codebase ~30% smaller

## Implementation Tasks

### Phase 0.1: Backend Cleanup (1 day)

#### Delete File-Based Execution
1. **Delete DynamicAgentsController**
   ```bash
   rm apps/api/src/agents/dynamic-agents.controller.ts
   rm apps/api/src/agents/dynamic-agents.controller.spec.ts
   ```

2. **Update agents.module.ts**
   - Remove DynamicAgentsController import
   - Remove file-based providers
   - Keep only database agent infrastructure

3. **Delete YAML loaders**
   - Find and delete agent YAML loader services
   - Delete file-based agent registry
   - Keep types and interfaces (may be useful)

4. **Clean up imports**
   - Search for DynamicAgentsController imports
   - Remove or update to database equivalents

#### Rename Backend Services
5. **Rename agent2agent module**
   ```bash
   mv apps/api/src/agent2agent apps/api/src/agents/database-agents
   # Or keep as agent2agent - it describes the protocol
   ```
   **Decision point:** Keep `agent2agent/` module name? It describes A2A protocol.

6. **Rename services (optional)**
   - `Agent2AgentConversationsService` → `AgentConversationsService`
   - Update all imports
   - **OR:** Keep "Agent2Agent" prefix - it's descriptive of the architecture

   **Recommendation:** Keep backend service names as-is. They describe the protocol.

### Phase 0.2: Frontend Cleanup (1 day)

#### Delete Legacy Store
7. **Delete old agentChatStore**
   ```bash
   rm -rf apps/web/src/stores/agentChatStore
   ```
   - This is the file-based agent store
   - All logic moving to agent2AgentChatStore

8. **Delete legacy services**
   ```bash
   rm apps/web/src/services/agentConversationsService.ts
   ```
   - Old file-based conversation service

#### Rename Frontend Stores/Services
9. **Rename agent2AgentChatStore → agentChatStore**
   ```bash
   mv apps/web/src/stores/agent2AgentChatStore apps/web/src/stores/agentChatStore
   ```

10. **Rename frontend services**
    ```bash
    # In apps/web/src/services/
    mv agent2AgentConversationsService.ts agentConversationsService.ts
    ```
    - Create agentTasksService.ts (was agent2AgentTasksService)
    - Create agentDeliverablesService.ts (was agent2AgentDeliverablesService)

11. **Update all imports**
    - Search for `agent2AgentChatStore` → replace with `agentChatStore`
    - Search for `agent2AgentConversationsService` → replace with `agentConversationsService`
    - Update component imports
    - Update store imports

#### Remove Routing Logic
12. **Remove agent.source checks**
    ```bash
    grep -r "agent.source" apps/web/src
    # Delete all conditional routing based on agent.source
    ```

13. **Simplify component logic**
    - No more "if file agent, else database agent"
    - Single code path
    - Remove conditionals in ConversationView, DeliverablesPanel, etc.

### Phase 0.3: Verification & Testing (0.5 days)

14. **Verify build**
    ```bash
    npm run build
    # Should succeed without errors
    ```

15. **Test existing database agents**
    - [ ] blog_post_writer conversation works
    - [ ] Agent list loads correctly
    - [ ] Hierarchy displays correctly
    - [ ] Can create new conversation
    - [ ] Image generators work (if tested before)

16. **Check bundle size**
    - Verify frontend bundle smaller
    - Backend build faster

17. **Git cleanup**
    ```bash
    git status
    # Should show lots of deletions, some renames
    ```

### Phase 0.4: Documentation (0.5 days)

18. **Update architecture docs**
    - Remove references to file-based agents
    - Update diagrams
    - Simple "database agents only" architecture

19. **Update developer guide**
    - How to create new database agent
    - Remove YAML agent instructions

20. **Create PR**
    - Title: "Phase 0: Remove file-based agent system"
    - Large PR with mostly deletions
    - Team review
    - Merge to feature branch

## Files to Delete

### Backend
```
apps/api/src/agents/
├── dynamic-agents.controller.ts ❌ DELETE
├── dynamic-agents.controller.spec.ts ❌ DELETE
├── dynamic-agents.service.ts ❌ DELETE (if exists)
├── loaders/ ❌ DELETE (YAML loaders)
├── demo/ ✅ KEEP ENTIRE DIRECTORY
└── base/ ✅ KEEP (may have useful utilities)
```

### Frontend
```
apps/web/src/stores/
├── agentChatStore/ ❌ DELETE (old file-based)
└── agent2AgentChatStore/ ✅ RENAME to agentChatStore/

apps/web/src/services/
├── agentConversationsService.ts ❌ DELETE (legacy)
└── agent2AgentConversationsService.ts ✅ RENAME to agentConversationsService.ts
```

## Renames

### Frontend (Simplify naming)
```
FROM → TO

stores/agent2AgentChatStore/ → stores/agentChatStore/
services/agent2AgentConversationsService.ts → services/agentConversationsService.ts
services/agent2AgentTasksService.ts → services/agentTasksService.ts (create first)
services/agent2AgentDeliverablesService.ts → services/agentDeliverablesService.ts (create first)
```

### Backend (Keep as-is - describes protocol)
```
Keep: agent2agent/ module
Keep: Agent2AgentController
Keep: Agent2AgentConversationsService
Keep: Agent2AgentTasksService
Keep: Agent2AgentDeliverablesService

Reason: "Agent2Agent" describes the protocol/architecture, not file vs database
```

## Testing Strategy

### Smoke Tests
1. **Backend starts without errors**
   ```bash
   npm run dev:api
   # No import errors
   # No missing module errors
   ```

2. **Frontend builds and runs**
   ```bash
   npm run dev
   # No compilation errors
   # App loads in browser
   ```

3. **Existing agents work**
   - blog_post_writer conversation
   - Agent list loads
   - Hierarchy displays

### Regression Tests
- [ ] Can list agents
- [ ] Can create conversation
- [ ] Can send message
- [ ] Can view conversation history
- [ ] Agent hierarchy displays correctly

## Risks & Mitigations

### Risk: Break existing database agents
**Mitigation:** Test blog_post_writer thoroughly before/after, quick rollback if needed

### Risk: Miss hidden dependencies
**Mitigation:** Comprehensive grep for imports, careful PR review

### Risk: Naming confusion after renames
**Mitigation:** Clear naming strategy, update all at once, team alignment

### Risk: Demo directory has important code
**Mitigation:** Keep entire demo/ directory, only delete execution paths

## Timeline Estimate
- Phase 0.1 (Backend): 1 day
- Phase 0.2 (Frontend): 1 day
- Phase 0.3 (Testing): 0.5 days
- Phase 0.4 (Documentation): 0.5 days
- **Total: 3 days**

## Dependencies
- blog_post_writer in database ✅
- Image generators in database ✅
- agent_builder_chat in database ✅
- Team commitment to database-only ✅

## Definition of Done
- [ ] DynamicAgentsController deleted
- [ ] YAML execution code deleted
- [ ] File-based store deleted
- [ ] Frontend services renamed (no agent2agent prefix)
- [ ] Frontend store renamed (agentChatStore)
- [ ] All agent.source checks removed
- [ ] Build passes
- [ ] Smoke tests pass
- [ ] blog_post_writer still works
- [ ] Demo directory intact
- [ ] PR merged to feature branch
- [ ] Ready for Phase 1

## Impact on Future Phases

### Phase 1-6 Simplifications
**Before Phase 0:**
- "Route to agent2AgentService if database agent, else fileService"
- Dual code paths everywhere
- Complex PRDs with routing logic

**After Phase 0:**
- "Use agentService" (only one exists)
- Single code path
- Simple PRDs focused on features

### PRD Updates Needed
After Phase 0, update Phases 1-6 to remove:
- ❌ Agent source routing
- ❌ Dual service references
- ❌ File-based compatibility notes
- ❌ Migration concerns

Add:
- ✅ Clean database-only architecture
- ✅ Simpler implementation tasks
- ✅ Faster timelines

## Success Celebration
When Phase 0 complete:
- **Codebase is cleaner and smaller**
- **Mental model is simpler**
- **Team velocity will increase**
- **Foundation ready for rapid Phases 1-6**
- **1-week timeline achievable**

## Notes
This is the most important phase. Getting this right means everything else becomes easier and faster. The "agent2agent" name on backend is fine - it describes the A2A protocol. Frontend simplifies to just "agentChatStore" and "agentConversationsService" because there's only one system now.

## Next Steps After Phase 0
1. Update Phase 1-6 PRDs (remove dual-system complexity)
2. Start Phase 1 with clean slate
3. Move fast - no legacy baggage
4. Ship to main in 1 week
