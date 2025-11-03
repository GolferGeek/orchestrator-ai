---
description: "Wrap an n8n workflow as an API agent (convenience wrapper for /api-agent:wrap-n8n)"
argument-hint: "[workflow-name-or-id] [agent-name]"
---

# Wrap N8N Workflow as API Agent

Convenience command that wraps an n8n workflow as an API agent. This is a shortcut for `/api-agent:wrap-n8n` command.

**Usage:** `/n8n:wrap [workflow-name-or-id] [agent-name]`

**Examples:**
- `/n8n:wrap "Marketing Swarm Flexible LLM" "marketing-swarm-n8n"` (wrap by name)
- `/n8n:wrap abc123 marketing-swarm-n8n` (wrap by workflow ID)
- `/n8n:wrap` (list workflows to choose from)

## Process

### 1. Delegate to API Agent Wrap Command

This command is a convenience wrapper that delegates to `/api-agent:wrap-n8n`:

```
/api-agent:wrap-n8n [workflow-name-or-id] [agent-name]
```

**Why this command exists:**
- Convenience for developers working primarily with n8n
- Shorter command syntax
- Matches workflow development workflow

### 2. See API Agent Wrap Command

For full details on the wrapping process, see `/api-agent:wrap-n8n` command documentation.

**Brief summary:**
- Identifies n8n workflow
- Extracts workflow information
- Determines request parameters
- Determines response field
- Invokes `@api-agent-development-agent` to create agent.yaml
- Creates agent files

### 3. Output Summary

```
✅ N8N Workflow Wrapped as API Agent

📦 Agent: marketing-swarm-n8n
📄 Location: apps/api/src/agents/demo/marketing/marketing-swarm-n8n/

🔄 N8N Workflow:
   Name: Marketing Swarm Flexible LLM
   ID: [workflow-id]
   Webhook: http://localhost:5678/webhook/marketing-swarm-flexible

📋 Configuration:
   ✅ Endpoint: http://localhost:5678/webhook/marketing-swarm-flexible
   ✅ Method: POST
   ✅ Timeout: 120000ms
   ✅ Request Transform: Includes taskId, conversationId, userId, announcement, statusWebhook
   ✅ Response Transform: Field extraction from payload.content
   ✅ Status Webhook: {{env.API_BASE_URL}}/webhooks/status

📤 Next Steps:
   1. Test agent: /api-agent:test marketing-swarm-n8n
   2. Import to database: /supabase:agent:import
   3. Verify in UI: http://localhost:7100/agents
```

## Important Notes

- **CRITICAL**: This command delegates to `/api-agent:wrap-n8n` - see that command for full details
- Wrapped agent must be imported to database before use
- Workflow must be active in n8n for agent to work
- Status webhook uses environment variables (never hardcoded)

## Related Commands

- `/api-agent:wrap-n8n` - Full API agent wrap command (delegated to)
- `/n8n:create` - Create n8n workflow
- `/n8n:test` - Test n8n workflow
- `/api-agent:test` - Test wrapped agent

## Skill Reference

This command leverages the `api-agent-development-skill` and `n8n-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` and `.claude/skills/n8n-development-skill/SKILL.md` for detailed patterns.

