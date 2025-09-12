# PRD: Team-Based Agent Hierarchy Display

## Overview
Replace the current agent hierarchy system with a team-based approach where agents define their teams in YAML files, enabling proper nested hierarchy display in the left navigation.

## Problem Statement
Currently, the agent hierarchy system uses `reportsTo` relationships that are not working properly. Managers appear as root nodes instead of being nested under the CEO, making the organizational structure unclear to users.

## Solution
Implement a team-based hierarchy where agents define who reports to them (rather than who they report to), making hierarchy building straightforward and reliable.

## Core Requirements

### 1. YAML Structure Update
- Add `team` property to agent YAML files
- List team members by name in the team array
- Maintain backward compatibility with existing files

**Example:**
```yaml
# ceo_orchestrator/agent.config.yaml
name: ceo_orchestrator
type: orchestrator
hierarchy:
  team:
    - marketing_manager_orchestrator
    - finance_manager_orchestrator
    - engineering_manager_orchestrator

# marketing_manager_orchestrator/agent.config.yaml  
name: marketing_manager_orchestrator
type: orchestrator
hierarchy:
  team:
    - blog_post
    - content
    - market_research
```

### 2. Backend Hierarchy Building
- Update `agent-discovery.service.ts` to read `team` arrays instead of `reportsTo`
- Build hierarchy by iterating through teams (top-down approach)
- Ensure proper parent-child relationships in the hierarchy response

### 3. Frontend Display
- Update `AgentTreeView.vue` to properly display nested hierarchy
- Show managers with folder icons, individual agents with person icons
- Add "Create conversation" and "Create project" buttons at each hierarchy level
- Maintain expand/collapse functionality

## Success Criteria
- ✅ CEO shows all manager children in the hierarchy
- ✅ Managers show their team members as children
- ✅ Left navigation displays proper nested structure
- ✅ Users can easily navigate to any agent through the hierarchy
- ✅ Action buttons appear at appropriate hierarchy levels

## Technical Implementation

### Files to Modify
1. **Backend:**
   - `apps/api/src/agent-discovery.service.ts` - Update hierarchy building logic
   - Agent YAML files - Add team properties

2. **Frontend:**
   - `apps/web/src/components/AgentTreeView.vue` - Already updated for hierarchy display

### Approach
1. Update CEO and manager YAML files with team definitions
2. Modify hierarchy building logic to use teams instead of reportsTo
3. Test hierarchy endpoint returns proper nested structure
4. Verify frontend displays correctly

## Timeline
- **Phase 1:** Update YAML files with team definitions (2 hours)
- **Phase 2:** Update backend hierarchy logic (3 hours)  
- **Phase 3:** Test and refine display (1 hour)
- **Total:** ~6 hours

## Risks & Mitigation
- **Risk:** Breaking existing hierarchy functionality
- **Mitigation:** Implement on feature branch, test thoroughly before merge

## Future Considerations
This is the foundation for the larger universal orchestrator architecture. The team-based approach will scale naturally as we add:
- Capability-based delegation
- Tool-wrapped agents
- Dynamic team management
- Universal orchestrator capabilities

## Definition of Done
- All managers appear as children of CEO in hierarchy
- Nested structure displays correctly in left navigation
- Users can navigate hierarchy intuitively
- No regression in existing agent functionality
- Code is clean and maintainable
