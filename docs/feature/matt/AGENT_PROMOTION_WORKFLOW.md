# Agent Promotion Workflow with HITL Approval

## Overview

The agent promotion system provides a complete lifecycle management workflow for agents, from creation through activation to archival. It includes human-in-the-loop (HITL) approval gates for sensitive agent types.

## Lifecycle States

```
draft → (HITL approval?) → active → archived
  ↑                                    ↓
  └────────── demote ─────────────────┘
```

### Status Values

- **draft** - Newly created, under development, not yet approved
- **active** - Approved and available for use in production
- **archived** - Soft-deleted, no longer available for use

## Promotion Flow

### 1. Create Agent (Draft Status)

All agents are created with `status='draft'`:

```bash
POST /api/admin/agents
{
  "slug": "my-agent",
  "display_name": "My Agent",
  "agent_type": "function",
  "status": "draft",  # Auto-set if not provided
  ...
}
```

### 2. Request Promotion

**Endpoint:** `POST /api/admin/agents/:id/promote`

**Body:**
```json
{
  "requireApproval": false,  // Optional: force approval requirement
  "skipValidation": false    // Optional: skip validation checks
}
```

**Response (Auto-Approved):**
```json
{
  "success": true,
  "agentId": "agent-123",
  "previousStatus": "draft",
  "newStatus": "active"
}
```

**Response (Requires Approval):**
```json
{
  "success": true,
  "agentId": "agent-123",
  "previousStatus": "draft",
  "newStatus": "draft",  // Still draft, pending approval
  "requiresApproval": true,
  "approvalId": "approval-456"
}
```

### 3. HITL Approval (if required)

**List Pending Approvals:**
```bash
GET /api/agent-approvals?status=pending
```

**Approve:**
```bash
POST /api/agent-approvals/:id/approve
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "approval-456",
    "status": "approved",
    "approved_by": "user-789"
  },
  "promotion": {
    "success": true,
    "agentId": "agent-123",
    "previousStatus": "draft",
    "newStatus": "active"
  }
}
```

**Reject:**
```bash
POST /api/agent-approvals/:id/reject
```

## Approval Requirements

### Auto-Promoted (No Approval Required)

- **Simple context agents** - Conversational agents with system prompts
- **Small function agents** - Code < 5000 characters, no external calls

### Requires Approval

- **Complex function agents**
  - Code > 5000 characters
  - Contains `fetch()`, `axios`, or `http` calls
- **API agents** - All agents calling external endpoints
- **Orchestrator agents** - All multi-agent coordinators

### Check Requirements

```bash
GET /api/admin/agents/:id/promotion-requirements
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requiresApproval": true,
    "requiresValidation": true,
    "requiresDryRun": true,
    "customChecks": []
  }
}
```

## Demotion

Move an active agent back to draft status for fixes/updates:

```bash
POST /api/admin/agents/:id/demote
{
  "reason": "Security update required"
}
```

**Response:**
```json
{
  "success": true,
  "agentId": "agent-123",
  "previousStatus": "active",
  "newStatus": "draft"
}
```

## Archival

Soft-delete an agent (any status):

```bash
POST /api/admin/agents/:id/archive
{
  "reason": "Agent no longer needed"
}
```

**Response:**
```json
{
  "success": true,
  "agentId": "agent-123",
  "previousStatus": "active",
  "newStatus": "archived"
}
```

## Validation Checks

Before promotion, the system validates:

1. **Schema Validation** - Agent structure matches type-specific schema
2. **Policy Checks** - Compliance with platform policies
   - Function agents: timeout ≤ 30000ms
   - IO contracts: input_modes and output_modes declared
   - Context agents: system prompt required
   - API agents: api_configuration required
3. **Dry-Run Execution** (function/API agents)
   - Code executes successfully
   - No runtime errors
   - Returns valid output

### Skip Validation

For trusted scenarios (e.g., re-promoting after minor config change):

```bash
POST /api/admin/agents/:id/promote
{
  "skipValidation": true
}
```

## Implementation Architecture

### Services

**AgentPromotionService** ([agent-promotion.service.ts](../../apps/api/src/agent-platform/services/agent-promotion.service.ts))

Methods:
- `requestPromotion(agentId, options)` - Initiate promotion workflow
- `completePromotionAfterApproval(approvalId)` - Complete after HITL approval
- `demote(agentId, reason)` - Move active → draft
- `archive(agentId, reason)` - Soft delete agent
- `getPromotionRequirements(agentId)` - Check approval requirements

**HumanApprovalsRepository** ([human-approvals.repository.ts](../../apps/api/src/agent-platform/repositories/human-approvals.repository.ts))

Methods:
- `create(input)` - Create approval request
- `setStatus(id, status, approvedBy)` - Approve/reject
- `get(id)` - Fetch approval record

### Controllers

**AgentsAdminController** - Promotion endpoints
- `POST /api/admin/agents/:id/promote`
- `POST /api/admin/agents/:id/demote`
- `POST /api/admin/agents/:id/archive`
- `GET /api/admin/agents/:id/promotion-requirements`

**AgentApprovalsController** - Approval management
- `GET /api/agent-approvals` - List approvals
- `POST /api/agent-approvals/:id/approve` - Approve (auto-promotes if agent_promotion)
- `POST /api/agent-approvals/:id/reject` - Reject

### Database Schema

**agents table:**
```sql
status text DEFAULT 'active'  -- 'draft' | 'active' | 'archived'
```

**human_approvals table:**
```sql
id uuid PRIMARY KEY
organization_slug text
agent_slug text
mode text  -- 'agent_promotion' for promotion approvals
status text  -- 'pending' | 'approved' | 'rejected'
approved_by text
decision_at timestamptz
metadata jsonb  -- Contains agentId, agentType, requestedBy, etc.
```

## Testing

**Unit Tests:** [agent-promotion.service.spec.ts](../../apps/api/src/agent-platform/services/agent-promotion.service.spec.ts)

- ✅ 13 tests covering all promotion scenarios
- Auto-promotion for simple agents
- Approval requirements for complex agents
- Validation failures
- Approval workflow
- Demotion and archival

**Run Tests:**
```bash
npm test -- agent-promotion.service.spec.ts
```

## Usage Examples

### Example 1: Simple Context Agent (Auto-Promoted)

```bash
# 1. Create agent
curl -X POST http://localhost:7100/api/admin/agents \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "faq-bot",
    "display_name": "FAQ Bot",
    "agent_type": "context",
    "mode_profile": "conversation_only",
    "yaml": "input_modes: [\"text/plain\"]\noutput_modes: [\"text/markdown\"]\n",
    "context": {
      "system": "You are a helpful FAQ bot."
    }
  }'

# Response: { "success": true, "data": { "id": "agent-123", "status": "draft", ... } }

# 2. Request promotion (auto-approved)
curl -X POST http://localhost:7100/api/admin/agents/agent-123/promote

# Response: { "success": true, "newStatus": "active" }
```

### Example 2: Complex Function Agent (Requires Approval)

```bash
# 1. Create agent
curl -X POST http://localhost:7100/api/admin/agents \
  -d '{ "agent_type": "function", ... "code": "<6000 char code with fetch()>" }'

# 2. Request promotion
curl -X POST http://localhost:7100/api/admin/agents/agent-456/promote

# Response: { "success": true, "requiresApproval": true, "approvalId": "approval-789" }

# 3. Admin approves
curl -X POST http://localhost:7100/api/agent-approvals/approval-789/approve

# Response: {
#   "success": true,
#   "promotion": { "success": true, "newStatus": "active" }
# }
```

### Example 3: Demote for Fixes

```bash
# Agent needs urgent security fix
curl -X POST http://localhost:7100/api/admin/agents/agent-123/demote \
  -d '{ "reason": "CVE-2025-1234 fix required" }'

# Fix the agent
curl -X PATCH http://localhost:7100/api/admin/agents/agent-123 \
  -d '{ "config": { ... updated config ... } }'

# Re-promote
curl -X POST http://localhost:7100/api/admin/agents/agent-123/promote
```

## Security Considerations

1. **Approval Gates** - Sensitive agents require human review
2. **Validation Enforcement** - All agents validated before activation
3. **Audit Trail** - All status changes logged with approver info
4. **Draft Safety** - New agents start as draft, preventing accidental production use
5. **Role-Based Access** - All endpoints require `@AdminOnly()` decorator

## Future Enhancements

- [ ] Multi-stage approval (require 2+ approvers)
- [ ] Scheduled promotions (promote at specific time)
- [ ] Rollback capability (instant revert to previous version)
- [ ] Blue/green deployments (test active version before full promotion)
- [ ] Approval delegation (route to specific teams/users)
- [ ] SLA tracking (time in each status)
- [ ] Automated regression testing before promotion

## Related Documentation

- [Agent Builder Plan](./agent-builder-plan.md)
- [AI Code Generation](./AI_CODE_GENERATION.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
