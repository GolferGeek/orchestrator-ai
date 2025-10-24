# Phase 0: Aggressive Cleanup - Remove Legacy Agent Code

## Overview
Move all file-based agent execution code to an archive directory at project root, then remove imports and routing. This allows us to fix build errors by evaluating each needed function/file and deciding how to properly integrate it into agent2agent with clean code standards. Archive is kept for reference through Phase 6, then deleted.

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
- Move file-based agent code to _archive-phase-0/ at project root (safe, reversible)
- Move deliverables/ into agent2agent/ (consolidate)
- Remove imports and routing to legacy code
- Fix build errors by properly integrating needed functions
- Evaluate code quality before re-integrating (maintain standards)
- Keep _archive-phase-0/ through Phase 6 (reference), then delete
- Single, clean code path for database agents

## Prerequisites
- ✅ Agent2agent backend services exist and work
- ✅ blog_post_writer in database (primary test agent)
- ✅ Agent discovery service loads agents from database
- ✅ Team alignment on database-only commitment

## Scope

### In Scope
1. **Backend: Move to Archive (Safe, Reversible)**
   - Move `agents/base/` → `_archive-phase-0/agents-base/`
   - Move `agents/dynamic-agents.*` → `_archive-phase-0/`
   - Move `agents/loaders/` → `_archive-phase-0/agents-loaders/`
   - Move `agents/parsers/` → `_archive-phase-0/agents-parsers/`
   - Move `image-agents/` → `_archive-phase-0/image-agents/`
   - Move agent-specific code from `llms/` → `_archive-phase-0/llms-agent-code/`
   - Move agent-specific code from `mcp/` → `_archive-phase-0/mcp-agent-code/`

2. **Backend: Consolidate into agent2agent**
   - Move `deliverables/` → `agent2agent/deliverables/`
   - Keep `assets/` separate (universal file storage)
   - NOTE: Plans service added in Phase 1, not Phase 0

3. **Backend: Remove Imports**
   - Remove all imports from archived directories
   - Remove DynamicAgentsController from modules
   - Remove file-based routing logic

4. **Backend: Fix Build Errors**
   - For each missing import/function:
     - Evaluate: Is this needed?
     - Evaluate: Is the code quality good?
     - Evaluate: Is it organized properly?
     - Evaluate: Should it be refactored?
   - Properly integrate into agent2agent/ with clean standards
   - Document decisions in ARCHIVE-DECISIONS.md

5. **Agent Discovery (Keep & Verify)**
   - Keep existing database agent loading service
   - Loads agents from `agents` table in Supabase
   - Used by hierarchy endpoint and agent execution
   - Verify it works after cleanup

6. **Frontend Deletions**
   - Delete `stores/agentChatStore/` (old file-based store)
   - Delete `services/agentConversationsService.ts` (legacy)
   - Delete any file-based agent utilities
   - Remove agent.source routing logic

7. **Frontend Renames (Simplification)**
   - `stores/agent2AgentChatStore/` → `stores/agentChatStore/`
   - `agent2AgentConversationsService.ts` → `agentConversationsService.ts`
   - `agent2AgentTasksService.ts` → `agentTasksService.ts` (create during rename)
   - `agent2AgentDeliverablesService.ts` → `agentDeliverablesService.ts` (create during rename)

8. **Preserve for Reference**
   - ✅ Keep entire `apps/api/src/agents/demo/` directory
   - ✅ Keep `_archive-phase-0/` through Phase 6 (committed to git)
   - ✅ Delete `_archive-phase-0/` after Phase 6 completion

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
1. ✅ Smoke tests pass (3 automated E2E tests)
2. ✅ API starts without errors
3. ✅ No orphaned test files
4. ✅ Codebase ~30% smaller
5. ✅ CI/CD configured

## Implementation Tasks

### Phase 0.0: Write Smoke Tests (2 hours)

**Create minimal automated safety net BEFORE deleting code:**

1. **Create smoke test bash script**
   ```bash
   mkdir -p apps/api/test/agent2agent
   # Create test/agent2agent/smoke-test.sh
   # Bash script with curl calls using Supabase auth
   chmod +x test/agent2agent/smoke-test.sh
   ```

2. **Write 3 critical curl tests**
   - Authenticate with Supabase (test user credentials)
   - List conversations (with auth token)
   - Get hierarchy endpoint (with auth token)

3. **Add test script**
   ```json
   // apps/api/package.json
   "test:smoke": "./test/agent2agent/smoke-test.sh"
   ```

4. **Ensure test user exists**
   ```bash
   # Verify test@example.com exists in Supabase
   # Or create test user if needed
   ```

5. **Verify tests pass**
   ```bash
   ./test/agent2agent/smoke-test.sh
   # Should complete in < 10 seconds
   ```

**See:** [PHASE-0-TESTING-STRATEGY.md](./PHASE-0-TESTING-STRATEGY.md) for full test implementation.

### Phase 0.1: Backend Triage & Consolidation (3 days)

#### Step 1: Create Archive Directory (Project Root)
1. **Create archive directory at project root**
   ```bash
   # At project root (NOT in source tree)
   mkdir -p _archive-phase-0
   ```

2. **Create clear README in archive**
   ```bash
   cat > _archive-phase-0/README.md << 'EOF'
   # Phase 0 Archive

   **DO NOT USE CODE FROM THIS DIRECTORY**

   This directory contains legacy file-based agent code that was removed during Phase 0.
   It is kept as reference only during Phases 1-6 development.

   - This code is NOT compiled
   - This code is NOT imported
   - This code is NOT part of the active system
   - This code is FOR REFERENCE ONLY

   See ARCHIVE-DECISIONS.md for what was migrated and where it went.

   **Delete this entire directory after Phase 6 completion.**
   EOF
   ```

3. **Update .claude.md with archive warning**
   ```bash
   cat >> .claude.md << 'EOF'

   ## Phase 0 Archive Directory

   **IMPORTANT: Do NOT use code from `_archive-phase-0/` directory**

   This directory contains legacy code removed during Phase 0 cleanup.
   It is kept for reference only during Phases 1-6.

   - NOT compiled
   - NOT imported
   - NOT part of active system
   - FOR REFERENCE ONLY

   When helping with code:
   - Do NOT suggest using code from _archive-phase-0/
   - Do NOT copy code from _archive-phase-0/
   - Only reference if explicitly asked to check legacy implementation

   This directory will be deleted after Phase 6 completion.
   EOF
   ```

#### Step 2: Move File-Based Code to Archive (Safe, Reversible)
4. **Move legacy agent code to archive**
   ```bash
   # Move entire directories to archive at project root
   mv apps/api/src/agents/base _archive-phase-0/agents-base
   mv apps/api/src/agents/dynamic-agents.* _archive-phase-0/
   mv apps/api/src/agents/loaders _archive-phase-0/agents-loaders
   mv apps/api/src/agents/parsers _archive-phase-0/agents-parsers
   mv apps/api/src/image-agents _archive-phase-0/image-agents

   # Identify and move agent-specific code from llms/ and mcp/
   # (manual evaluation needed - grep for agent execution logic)
   ```

#### Step 3: Consolidate Deliverables into agent2agent
5. **Move deliverables into agent2agent**
   ```bash
   mv apps/api/src/deliverables apps/api/src/agent2agent/deliverables

   # Update imports throughout codebase
   # FROM: '@/deliverables/...'
   # TO:   '@/agent2agent/deliverables/...'
   ```

6. **Update agent2agent module**
   ```typescript
   // apps/api/src/agent2agent/agent2agent.module.ts
   @Module({
     imports: [
       // ... existing imports
     ],
     providers: [
       DeliverablesService,  // Now internal to agent2agent
       DeliverableVersionsService,
       // ... other services
     ],
     controllers: [
       DeliverablesController,  // Now internal to agent2agent
       // ... other controllers
     ],
     exports: [
       DeliverablesService,  // Export for other modules if needed
       DeliverableVersionsService,
     ],
   })
   ```

#### Step 4: Remove Imports from Archive
7. **Remove all imports pointing to archived code**
   ```bash
   # Find all imports from archived directories
   grep -r "import.*agents/base" apps/api/src
   grep -r "import.*image-agents" apps/api/src
   grep -r "DynamicAgentsController" apps/api/src

   # Remove these imports (will cause build errors - that's intentional)
   ```

8. **Update agents.module.ts**
   - Remove DynamicAgentsController import
   - Remove ALL base/ imports
   - Keep ONLY: demo/ (reference), agent2agent/ (execution)

#### Step 5: Fix Build Errors (Evaluation Phase)
9. **Run build and fix errors iteratively**
   ```bash
   npm run build
   # Will fail with missing imports
   ```

10. **For each build error, evaluate:**
   ```typescript
   // DECISION TREE for each missing import/function:

   // 1. Is this needed at all?
   //    NO  → Remove the code that imports it
   //    YES → Continue to step 2

   // 2. Is the code quality good?
   //    NO  → Refactor before integrating
   //    YES → Continue to step 3

   // 3. Is it organized properly?
   //    NO  → Reorganize into proper structure
   //    YES → Continue to step 4

   // 4. Does it belong in agent2agent?
   //    YES → Copy to agent2agent/ with proper organization
   //    NO  → Put in appropriate module (llms/, mcp/, etc.)

   // 5. Document in ARCHIVE-DECISIONS.md
   //    - What was moved/refactored
   //    - Why
   //    - Where it went
   ```

11. **Create ARCHIVE-DECISIONS.md in archive**
    ```bash
    cat > _archive-phase-0/ARCHIVE-DECISIONS.md << 'EOF'
    # Triage Decisions

    **IMPORTANT: This directory is kept until Phase 6 completion**
    - May contain code needed for Phases 1-6
    - Faster than searching git history
    - Delete after Phase 6 when all features implemented

    ---

    ## Decisions Log

    EOF
    ```

    Document each decision:
    ```markdown
    ## File: agents/base/some-service.ts
    - **Decision**: Refactored and moved to agent2agent/services/
    - **Reason**: Needed for task execution, but had poor separation of concerns
    - **Changes**: Split into 3 smaller services
    - **New Location**: agent2agent/services/{task-executor, context-loader, result-processor}.ts

    ## File: agents/base/unused-helper.ts
    - **Decision**: Not needed
    - **Reason**: Not imported anywhere, dead code
    - **Action**: Left in archive, not migrated
    ```

#### Step 6: Iterate Until Build Passes
12. **Repeat evaluation cycle**
    - Fix build error
    - Evaluate code quality
    - Integrate properly into agent2agent/
    - Document decision
    - Run build again
    - Repeat until `npm run build` succeeds

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
    # Examples to remove:
    # - if (agent.source === 'database') { ... } else { ... }
    # - agent.source === 'file' ? fileService : dbService
    # - switch (agent.source) cases
    ```

13. **Simplify component logic**
    - ❌ Remove: "if file agent, else database agent" conditionals
    - ❌ Remove: agent.source-based routing
    - ✅ Keep: namespace-based logic (we use multiple namespaces)
    - ✅ Keep: organizationSlug handling
    - Single code path for all agents
    - Remove conditionals in ConversationView, DeliverablesPanel, etc.

14. **Preserve namespace filtering**
    ```typescript
    // KEEP this kind of logic:
    agents.filter(a => a.namespace === currentNamespace)

    // DELETE this kind of logic:
    if (agent.source === 'database') {
      await agent2AgentService.execute()
    } else {
      await fileAgentService.execute()
    }
    ```

### Phase 0.3: Verification & Testing (0.5 days)

15. **Verify build passes**
    ```bash
    npm run build
    # Should succeed without errors
    ```

16. **Run smoke tests**
    ```bash
    ./test/agent2agent/smoke-test.sh
    # All tests should pass
    ```

17. **Test existing database agents**
    - [ ] blog_post_writer conversation works
    - [ ] Agent list loads correctly
    - [ ] Hierarchy displays correctly
    - [ ] Can create new conversation
    - [ ] Namespace filtering still works
    - [ ] Deliverables work (now under agent2agent/)

18. **Verify archive is complete**
    - All legacy code in `_archive-phase-0/`
    - README.md created with warnings
    - ARCHIVE-DECISIONS.md created
    - .claude.md updated with archive warning

19. **Verify ARCHIVE-DECISIONS.md**
    - Review all decisions made
    - Ensure documentation is complete
    - Note: Keep updating through Phases 1-6 if we need more code

20. **Check bundle size**
    - Verify frontend bundle smaller
    - Backend build faster

21. **Git cleanup**
    ```bash
    git status
    # Should show:
    # - _archive-phase-0/ added (committed for team visibility)
    # - deliverables moved to agent2agent/
    # - Frontend renames
    # - Lots of import updates
    # - .claude.md updated
    ```

### Phase 0.4: Configure CI/CD (0.5 days)

22. **Add smoke tests to CI/CD**
    ```yaml
    # .github/workflows/api-tests.yml
    - name: Run Agent2Agent Smoke Tests
      run: npm run test:smoke --prefix apps/api
      timeout-minutes: 2
    ```

23. **Verify CI/CD passes**
    - Push to feature branch
    - Ensure smoke tests run and pass
    - Fast feedback loop established

24. **Create PR**
    - Title: "Phase 0: Consolidate to agent2agent architecture"
    - PR includes:
      - _archive-phase-0/ added (WITH README and ARCHIVE-DECISIONS.md)
      - deliverables/ moved to agent2agent/
      - Frontend simplified (no agent.source routing)
      - .claude.md updated with archive warning
    - Smoke tests prove nothing broke
    - Merge to feature branch
    - Note: _archive-phase-0/ kept until Phase 6 completion

## File Structure Changes

### Project Root - Archive Approach
```
orchestrator-ai/  (project root)
├── _archive-phase-0/  📦 ARCHIVE (kept until Phase 6)
│   ├── README.md  ⚠️ "DO NOT USE CODE FROM THIS DIRECTORY"
│   ├── ARCHIVE-DECISIONS.md  📝 Documents all migration decisions
│   ├── agents-base/              # Moved from apps/api/src/agents/base/
│   ├── agents-loaders/           # Moved from apps/api/src/agents/loaders/
│   ├── agents-parsers/           # Moved from apps/api/src/agents/parsers/
│   ├── dynamic-agents.*          # Moved controller/service
│   ├── image-agents/             # Moved from apps/api/src/image-agents/
│   ├── llms-agent-code/          # Agent execution code from llms/
│   └── mcp-agent-code/           # Agent execution code from mcp/
│
├── .claude.md  ⚠️ Updated with archive warning
│
└── apps/api/src/
    ├── agent2agent/  ✅ CONSOLIDATED
    │   ├── deliverables/             # ⬅️ MOVED from deliverables/
    │   │   ├── deliverables.service.ts
    │   │   ├── deliverable-versions.service.ts
    │   │   └── deliverables.controller.ts
    │   ├── services/
    │   │   ├── agent2agent-conversations.service.ts
    │   │   ├── agent2agent-tasks.service.ts
    │   │   └── agent2agent-deliverables.service.ts
    │   └── agent2agent.module.ts  (now includes deliverables)
    │
    ├── agents/
    │   └── demo/  ✅ KEEP (reference only)
    │
    ├── assets/  ✅ KEEP (universal file storage)
    ├── llms/  ✅ KEEP (LLM clients only, no agent code)
    └── mcp/  ✅ KEEP (MCP protocol only, no agent code)
```

### Frontend
```
apps/web/src/stores/
├── agentChatStore/  ❌ DELETE (old file-based)
└── agent2AgentChatStore/  ⬅️ RENAME to agentChatStore/

apps/web/src/services/
├── agentConversationsService.ts  ❌ DELETE (legacy)
└── agent2AgentConversationsService.ts  ⬅️ RENAME to agentConversationsService.ts
```

### Final Result (After Phase 6, delete archive)
```
orchestrator-ai/
├── apps/api/src/
│   ├── agent2agent/  ✅ Complete agent system
│   │   ├── deliverables/  (moved in)
│   │   └── services/
│   ├── agents/demo/  ✅ Reference only
│   ├── assets/  ✅ Universal storage
│   ├── llms/  ✅ Clean
│   └── mcp/  ✅ Clean
│
└── .claude.md  ✅ Clean (archive warning removed)
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

### Automated Smoke Tests (Phase 0.0)
**3 curl-based E2E tests, < 10 seconds, catches 90% of breaking changes:**

```bash
# test/agent2agent/smoke-test.sh
1. Authenticate with Supabase (test user credentials)
2. List conversations (with auth token)
3. Get hierarchy endpoint (with auth token)
```

**Uses real Supabase auth:**
- Test user: `test@example.com`
- Auth via Supabase token endpoint
- All requests include `Authorization: Bearer <token>`

**Run before and after deletion:**
```bash
./test/agent2agent/smoke-test.sh  # Before deletion → pass ✅
# ... delete code ...
./test/agent2agent/smoke-test.sh  # After deletion → still pass ✅
```

**See:** [PHASE-0-TESTING-STRATEGY.md](./PHASE-0-TESTING-STRATEGY.md) for full implementation.

### Manual Validation (Quick Checks)
1. API starts without errors: `npm run dev:api`
2. Frontend builds: `npm run dev`
3. No console errors in browser

## Risks & Mitigations

### Risk: Break existing database agents
**Mitigation:** Automated smoke tests catch regressions immediately, quick rollback if needed

### Risk: Miss hidden dependencies
**Mitigation:** Smoke tests + comprehensive grep for imports + careful PR review

### Risk: Naming confusion after renames
**Mitigation:** Clear naming strategy, update all at once, team alignment

### Risk: Demo directory has important code
**Mitigation:** Keep entire demo/ directory intact, only delete execution paths

## Timeline Estimate
- Phase 0.0 (Smoke Tests): 2 hours
- Phase 0.1 (Backend Triage & Consolidation): 3 days (evaluation + integration)
- Phase 0.2 (Frontend Cleanup): 1 day (includes renames)
- Phase 0.3 (Delete Triage): 0.5 days (verification + deletion)
- Phase 0.4 (CI/CD): 0.5 days
- **Total: 5 days** (includes evaluation, documentation, testing)

## Agent Discovery (How Agents are Loaded)

**Current System (Keep This):**
- Agents are stored in `agents` table in Supabase
- Agent discovery service queries database for active agents
- Used by:
  - `/api/.well-known/agent-hierarchy` (loads all agents for hierarchy)
  - Agent execution (loads specific agent by slug)
- **NO CHANGES needed** - this already works

**What we're removing:**
- YAML file loaders (agents/loaders/)
- File-based agent parsers (agents/parsers/)
- DynamicAgentsController (loaded from filesystem)

**After Phase 0:**
- ✅ Database is the single source of truth for agents
- ✅ Agent discovery service unchanged (already database-based)
- ✅ Hierarchy endpoint works (loads from database)
- ✅ Agent execution works (loads from database)

## Dependencies
- blog_post_writer in database ✅ (primary test agent)
- Agent discovery service already database-based ✅
- Hierarchy endpoint already working ✅
- Team commitment to database-only ✅

## Definition of Done
- [ ] Smoke tests written and passing (Phase 0.0)
- [ ] Legacy code moved to _archive-phase-0/ (project root)
- [ ] _archive-phase-0/README.md created with warnings
- [ ] _archive-phase-0/ARCHIVE-DECISIONS.md created
- [ ] .claude.md updated with archive warning
- [ ] deliverables/ moved to agent2agent/deliverables/
- [ ] All imports from archived code removed
- [ ] Build errors fixed by proper integration
- [ ] Code quality evaluated for all re-integrated code
- [ ] _archive-phase-0/ committed to git (team visibility)
- [ ] Frontend services renamed (no agent2agent prefix)
- [ ] Frontend store renamed (agentChatStore)
- [ ] All agent.source checks removed
- [ ] Namespace filtering still works
- [ ] Smoke tests still passing after cleanup
- [ ] CI/CD configured
- [ ] Build passes
- [ ] blog_post_writer still works
- [ ] Deliverables work (now under agent2agent/)
- [ ] Demo directory intact
- [ ] PR merged to feature branch
- [ ] Ready for Phase 1

## Post-Phase 6: Final Archive Cleanup
**After Phase 6 (Orchestration) is complete:**
- [ ] Verify all features work (Phases 1-6)
- [ ] Confirm no additional code needed from _archive-phase-0/
- [ ] Delete _archive-phase-0/ directory permanently
- [ ] Remove archive warning from .claude.md
- [ ] Create PR: "Phase 6 Complete: Remove legacy code archive"

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
