---
# High-Level Orchestrator V2

## Status

- **Created**: October 28, 2025
- **Phase**: Architecture Discovery & Planning
- **Last Updated**: October 28, 2025

---

## Strategic Vision: Simplification

**Goal**: Rethink Orchestrator as a lean, hierarchical agent composition system.

### Current Plan (V2)
- **Remove** complex workflow orchestration (N8n/Landgraf-style multi-step pipelines)
- **Keep** Orchestrators as first-class agents with hierarchical knowledge
- **MVP Scope**:
  - Single sub-object invocation per request
  - Return sub-agent deliverable as response
  - Support ad hoc chaining ("Also run the marketing swarm")
  - No recipe save/load initially

### Evolution Path
1. **V2.0** (Current): Single sub-object calls, ad hoc chaining
2. **V2.1** (Future): Multi-step composition with user-defined ordering
3. **V2.2+** (Future): Saved recipes, complex workflows

---

## Current Architecture (Discovered)

### Hierarchy System ✅ **ALREADY BUILT**

The backend has an **existing, working hierarchy system**:

- **Backend Discovery**: `apps/api/src/agent-platform/hierarchy/`
  - `HierarchyController` builds agent trees from database
  - Uses `reports_to` (or `reportsTo`) field in agent YAML
  - Groups agents by `organization_slug` (namespace)
  - Recursively builds parent-child relationships

- **Frontend Display**: `apps/web/src/stores/agentsStore.ts`
  - Stores and filters hierarchy by namespace
  - Displays org-specific agents + global agents
  - Already renders tree in `AgentTreeView.vue`

- **Key Database Fields**:
  - `agent_records.reports_to` — Parent agent slug
  - `agent_records.organization_slug` — Namespace/org
  - Recursive relationship building via YAML parsing

### Current State Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Agent Hierarchy** | ✅ Built | Backend discovers via `reports_to`; Frontend displays filtered tree |
| **Organization Scoping** | ✅ Built | Org-specific agents visible; global agents always shown |
| **Agent Registry** | ✅ Exists | `AgentRegistryService` knows all agents |
| **Orchestrator Concept** | ⚠️ Exists but Over-engineered | Current orchestration system handles complex pipelines (recipes, human loops, etc.) |
| **Agent Pool** | ❓ Not Found | No `agent-pool` module detected; concept may have been archived |

### What Needs to Change

1. **Simplify Orchestrator Model**
   - Current: Complex orchestration with recipes, runs, steps, human loops
   - New: Lightweight orchestrator that knows its sub-agents and can invoke them
   
2. **Update Transport Types**
   - Current: Supports complex `OrchestrateMode` payloads (create, execute, continue, save recipes, etc.)
   - New: Simplify to basic orchestrator request/response (invoke sub-agent, return deliverable)

3. **Update Database Schema**
   - Current: `orchestration_runs`, `orchestration_steps`, `orchestration_recipes`
   - New: Keep lightweight metadata; focus on agent hierarchy via `reports_to`

4. **API Routes**
   - Current: `/orchestrate/*` handles complex workflows
   - New: Simple `/agents/{orchestratorId}/invoke/{subAgentId}` endpoint

5. **Frontend Orchestrator UX**
   - Current: Complex workflow builder with run history
   - New: Simple "invoke sub-agent" button; show deliverable; offer ad hoc chaining

---

## Hierarchical Knowledge Model (Confirmed)

Your model is **correct and already reflected in the database**:

```
CEO (Orchestrator, organization_slug = 'acme')
├─ reports_to: null (root)
├─ knows:
│  ├─ Marketing Manager (Orchestrator)
│  ├─ Engineering Manager (Orchestrator)
│  └─ Finance Manager (Orchestrator)

Marketing Manager (Orchestrator, organization_slug = 'acme')
├─ reports_to: 'ceo'
├─ knows (direct children):
│  ├─ Blog Post Writer (Agent)
│  ├─ Social Media Agent (Agent)
│  └─ Analytics Agent (Agent)
├─ knows (transitive children via recursion):
│  └─ All children of any sub-orchestrators
```

**Key Insight**: `reports_to` already creates this hierarchy in the database. We just need to:
1. Leverage it for orchestrator invocation
2. Simplify the orchestration engine to not overload it with complex pipeline logic
3. Keep the hierarchy as the source of truth for "what agents does this orchestrator know"

---

## Implementation Implications

### Database Schema Changes
- Keep `reports_to` field (already there)
- Simplify `orchestrator_*` tables or consolidate to agent metadata
- Track last invocation/deliverable for caching (optional)

### Transport Type Changes
1. **Reduce `OrchestrateMode` payload complexity**
   - Remove: recipes, run steps, human loops, plan workflows
   - Keep: agent invoke (minimal request/response)

2. **New Simple Payload Types**
   ```typescript
   OrchestratorInvokePayload {
     subAgentId: string;
     agentInput: string;  // user request
   }
   
   OrchestratorInvokeResponse {
     success: boolean;
     deliverable: string;  // sub-agent result
     metadata: { ... }
   }
   ```

### API Routes
- `POST /agents/{orchestratorId}/invoke/{subAgentId}` — invoke sub-agent
- `GET /agents/{orchestratorId}/known-agents` — list known sub-agents (from hierarchy)

### Frontend Changes
- Orchestrator conversation shows list of known sub-agents
- User can invoke any known agent
- Result is displayed as deliverable
- User can ask for follow-up (e.g., "Also run the marketing swarm")
- Backend chains the new request through same orchestrator

---

## Scope of Work

### Phase 1: Discovery & Design (Current)
- [x] Confirm hierarchy system exists
- [x] Map current orchestration complexity
- [x] Validate simplified model vs. existing code
- [ ] Design simplified orchestrator request/response payloads
- [ ] Plan database schema updates

### Phase 2: Database & Schema
- [ ] Audit `orchestration_*` tables
- [ ] Identify what to remove vs. keep
- [ ] Create migration plan (backward compatible if needed)

### Phase 3: Transport Types
- [ ] Simplify `OrchestrateMode` payloads
- [ ] Update request/response types
- [ ] Maintain backward compatibility or deprecate cleanly

### Phase 4: Backend Implementation
- [ ] Update orchestrator service to use hierarchy
- [ ] Implement simple invoke endpoint
- [ ] Ensure sub-agent execution returns deliverable

### Phase 5: Frontend UX
- [ ] Update orchestrator conversation view
- [ ] Add sub-agent invocation UI
- [ ] Display deliverable results

### Phase 6: Testing & Refinement
- [ ] E2E tests for orchestrator → sub-agent chains
- [ ] Ad hoc chaining validation
- [ ] Performance testing

---

## Key Questions to Resolve

1. **Migration Strategy**: Do we deprecate old orchestration tables or repurpose them?
2. **Sub-agent Execution**: Should orchestrator proxy requests or execute sub-agents directly?
3. **Context Carryover**: When user says "also run swarm X", does context carry over?
4. **Deliverable Format**: What constitutes the "deliverable" from a sub-agent?

---

## Related Architecture

- **Hierarchy System**: `apps/api/src/agent-platform/hierarchy/`
- **Agent Registry**: `apps/api/src/agent-platform/services/agent-registry.service.ts`
- **Current Orchestration**: `apps/api/src/agent-platform/services/orchestration-*.service.ts`
- **Frontend Tree**: `apps/web/src/components/AgentTreeView.vue`
- **Transport Types**: `apps/transport-types/`

---

## Notes

- The `agent-pool` module mentioned in AGENTS.md was not found in codebase; may have been archived
- Current orchestration system is significantly over-engineered for V2 needs
- Hierarchy system is production-ready; no redesign needed there
- This simplification will make orchestrators feel like natural agent composition, not complex workflows
