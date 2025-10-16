# Reports-To Hierarchy Refactor

**Status**: Planning
**Created**: 2025-10-16
**Related**: [[initial-agent-building]]

---

## 🎯 Goal

Replace the current complex hierarchy system (team + reports_to in config/YAML) with a simple `reports_to` column. Build team relationships dynamically by querying which agents report to a given agent.

---

## 🔍 Current State Analysis

### Current Hierarchy Implementation

**Database:**
- No dedicated hierarchy columns
- Hierarchy stored in `config` JSONB field
- Example: `config.hierarchy = {level, department, reports_to}`

**Discovery Service:**
- Uses team and reports_to from config
- Complex logic trying to manage bidirectional relationships
- Inconsistencies possible (A says B is in team, but B doesn't say reports_to A)

**Frontend:**
- Agent cards show hierarchy from config
- Discovery/routing may use hierarchy

**Backend:**
- Agent runtime uses hierarchy from config
- Passed through transport types

---

## ✅ Target State

### Simple Model

**Single column:** `reports_to TEXT`
- Stores slug of agent this agent reports to
- NULL for top-level agents
- **Team is derived** by query: `WHERE reports_to = 'this-agent'`

**Benefits:**
- ✅ Single source of truth
- ✅ No duplication/inconsistency
- ✅ Easy to query org structure
- ✅ Can build full tree with recursive query

---

## 📋 Implementation Plan

### Phase 1: Database Schema
- [ ] Create migration to add `reports_to` column
- [ ] Write script to extract `reports_to` from existing `config.hierarchy`
- [ ] Migrate existing data to new column
- [ ] Verify all agents have correct `reports_to` value
- [ ] Add index on `reports_to` for query performance

**Migration:**
```sql
ALTER TABLE agents ADD COLUMN reports_to TEXT;
CREATE INDEX idx_agents_reports_to ON agents(reports_to);

-- Migrate data
UPDATE agents
SET reports_to = config->'hierarchy'->>'reports_to'
WHERE config->'hierarchy'->>'reports_to' IS NOT NULL;
```

### Phase 2: Backend Types & Interfaces

**Files to Update:**

- [ ] `apps/api/src/agent-platform/interfaces/agent-record.interface.ts`
  - Add `reports_to?: string | null` to `AgentRecord`
  - Add to `AgentUpsertInput`

- [ ] `apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts`
  - Add `reportsTo?: string | null` to `AgentRuntimeDefinition`
  - Update `AgentHierarchyDefinition` if exists

- [ ] `apps/api/src/agent-platform/services/agent-runtime-definition.service.ts`
  - Update `buildDefinition()` to include `reportsTo` from record
  - Update `extractHierarchy()` to use column instead of config
  - Add method to get team: `getTeam(agentSlug)` - query agents where reports_to = slug

- [ ] `apps/api/src/agent-platform/repositories/agents.repository.ts`
  - Update `upsert()` to handle `reports_to` column
  - Add `findByReportsTo(slug)` method to get team
  - Add `getOrgChart()` method for recursive hierarchy

### Phase 3: Transport Types

**Files to Update:**

- [ ] `apps/transport-types/agent-definition.types.ts`
  - Add `reportsTo?: string | null` to agent definition type
  - Update any hierarchy-related types

- [ ] Verify all mode payloads that reference hierarchy

### Phase 4: Discovery Service

**Files to Check/Update:**

- [ ] Find discovery service location
- [ ] Update to use `reports_to` column instead of config.hierarchy
- [ ] Update team lookup to query `WHERE reports_to = X`
- [ ] Remove old team/reports_to bidirectional logic
- [ ] Test agent discovery by hierarchy

### Phase 5: Agent Card & YAML

**Files to Update:**

- [ ] YAML schema - define `reports_to` at root level
  ```yaml
  name: blog_post_writer
  reports_to: marketing-manager  # simple, top-level
  ```

- [ ] Agent card generation - include `reports_to` in card
- [ ] Remove old `hierarchy` object from YAML/config

### Phase 6: Frontend Integration

**Files to Check/Update:**

- [ ] `apps/web-v1/src/types/` - Agent type definitions
  - Add `reportsTo?: string | null`

- [ ] `apps/web-v1/src/services/` - Agent service
  - Update agent data mapping

- [ ] Agent display components
  - Update to show `reports_to` instead of `hierarchy.reports_to`
  - Update team display (if any) to use derived team

- [ ] Discovery/filtering UI
  - Update filters if they use hierarchy

### Phase 7: Agent Management Scripts

**Files to Update:**

- [ ] `initial-agent-building/scripts/load-agent.ts`
  - Extract `reports_to` from YAML
  - Set `reports_to` column when loading

- [ ] `initial-agent-building/scripts/export-agent.ts`
  - Include `reports_to` column in export

- [ ] Update agent file structure documentation

### Phase 8: Testing & Validation

- [ ] Unit tests for agents.repository (findByReportsTo, getOrgChart)
- [ ] Unit tests for agent-runtime-definition.service (hierarchy extraction)
- [ ] Integration test: Create agent with reports_to, verify team query works
- [ ] E2E test: Agent discovery by hierarchy
- [ ] Manual test: View agent in frontend, verify reports_to displayed
- [ ] Manual test: View manager agent, verify team shown (derived)

### Phase 9: Migration & Cleanup

- [ ] Run migration on local database
- [ ] Verify all existing agents migrated correctly
- [ ] Test with blog_post_writer (Phase 1 agent)
- [ ] Remove old `config.hierarchy` references (optional cleanup)
- [ ] Update documentation

---

## 🔍 Files to Investigate

Need to find and understand these services:

- [ ] Discovery service - where is it?
- [ ] Agent routing - how does it use hierarchy?
- [ ] Orchestration - does it use team/hierarchy for agent selection?
- [ ] Frontend agent tree/list - how is hierarchy displayed?

**Search Commands:**
```bash
# Find discovery service
grep -r "discovery\|Discovery" apps/api/src --include="*.ts" | grep -i service

# Find hierarchy usage in backend
grep -r "hierarchy\|reports_to\|team" apps/api/src --include="*.ts" | grep -v spec

# Find hierarchy usage in frontend
grep -r "hierarchy\|reportsTo" apps/web-v1/src --include="*.ts" --include="*.vue"
```

---

## 🎯 Testing Scenarios

### Scenario 1: Simple Hierarchy
```
ceo-orchestrator (reports_to: null)
  ├── marketing-manager (reports_to: ceo-orchestrator)
  │   ├── blog_post_writer (reports_to: marketing-manager)
  │   └── social_media_specialist (reports_to: marketing-manager)
  └── finance-manager (reports_to: ceo-orchestrator)
      └── metrics (reports_to: finance-manager)
```

**Tests:**
- [ ] Query marketing-manager's team → returns [blog_post_writer, social_media_specialist]
- [ ] Query blog_post_writer's boss → returns marketing-manager
- [ ] Query ceo-orchestrator's team → returns [marketing-manager, finance-manager]
- [ ] Recursive query → builds full tree

### Scenario 2: Agent Discovery
- [ ] "Find all agents in marketing" → follows reports_to chain up to marketing-manager
- [ ] "Find all specialists" → filters by some criteria (TBD how specialist is defined)

### Scenario 3: Orphaned Agents
- [ ] Agent has `reports_to: 'nonexistent-agent'` → how to handle?
- [ ] Validation on insert/update?

---

## 🚧 Open Questions

- [ ] **Q1**: Do we keep `config.hierarchy` for backward compatibility during transition?
- [ ] **Q2**: Should we validate `reports_to` references an existing agent?
- [ ] **Q3**: How does frontend display "team" for a manager? Separate query?
- [ ] **Q4**: Does orchestration need to know hierarchy for agent selection?
- [ ] **Q5**: Do we need department/level fields, or just reports_to?
- [ ] **Q6**: Should `reports_to` be in agent card (YAML) for external callers?

---

## 📅 Execution Order

**Recommended sequence:**

1. ✅ **Investigation Phase** (1-2 hours)
   - Find all files that use hierarchy
   - Understand current discovery/routing logic
   - Answer open questions

2. **Backend Foundation** (2-3 hours)
   - Database migration
   - Update interfaces and types
   - Update agent-runtime-definition.service
   - Update agents.repository

3. **Transport & API** (1 hour)
   - Update transport-types
   - Ensure API payloads include reports_to

4. **Frontend Integration** (1-2 hours)
   - Update type definitions
   - Update agent display components
   - Test in UI

5. **Agent Scripts** (30 min)
   - Update load-agent/export-agent scripts
   - Test with blog_post_writer

6. **Testing** (1-2 hours)
   - Write tests
   - Manual testing
   - Verify hierarchy queries work

7. **Migration** (30 min)
   - Run migration
   - Verify existing agents

**Total Estimate: 8-12 hours**

---

## 🔗 Related Work

This refactor should happen **before** or **during** Phase 1 of initial-agent-building:
- [[initial-agent-building#phase-1-context-agent-blog-post-writer]]

When we flesh out blog_post_writer, we'll want clean hierarchy in place.

---

## 📝 Notes

- Keep this simple: just `reports_to` column
- Derive team dynamically - don't store it
- Single source of truth prevents inconsistencies
- Can always add more hierarchy metadata later (department, level) if needed
