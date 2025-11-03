---
description: "Wrap a LangGraph workflow as an API agent (convenience wrapper for /api-agent:wrap-langgraph)"
argument-hint: "[workflow-name] [agent-name]"
---

# Wrap LangGraph Workflow as API Agent

Convenience command that wraps a LangGraph workflow as an API agent. This is a shortcut for `/api-agent:wrap-langgraph` command.

**Usage:** `/langgraph:wrap [workflow-name] [agent-name]`

**Examples:**
- `/langgraph:wrap research research-agent` (wrap by workflow name)
- `/langgraph:wrap` (prompt for workflow name and agent name)

## Process

### 1. Delegate to API Agent Wrap Command

This command is a convenience wrapper that delegates to `/api-agent:wrap-langgraph`:

```
/api-agent:wrap-langgraph http://localhost:7101/webhook/langgraph/{workflow-name} [agent-name]
```

**Why this command exists:**
- Convenience for developers working primarily with LangGraph
- Shorter command syntax
- Matches workflow development workflow

### 2. Determine Endpoint URL

**Extract endpoint URL:**
- Format: `http://localhost:7101/webhook/langgraph/{workflow-name}`
- Or from workflow configuration
- Default port: 7101 (or from environment)

### 3. See API Agent Wrap Command

For full details on the wrapping process, see `/api-agent:wrap-langgraph` command documentation.

**Brief summary:**
- Identifies LangGraph endpoint
- Extracts endpoint information
- Determines request parameters
- Determines response field
- Invokes `@api-agent-development-agent` to create agent.yaml
- Creates agent files

### 4. Output Summary

```
✅ LangGraph Workflow Wrapped as API Agent

📦 Agent: research-agent
📄 Location: apps/api/src/agents/demo/research/research-agent/

🔄 LangGraph Endpoint:
   URL: http://localhost:7101/webhook/langgraph/research
   Method: POST

📋 Configuration:
   ✅ Endpoint: http://localhost:7101/webhook/langgraph/research
   ✅ Method: POST
   ✅ Timeout: 120000ms
   ✅ Request Transform: Includes taskId, conversationId, userId, userMessage, statusWebhook
   ✅ Response Transform: Field extraction from payload.content
   ✅ Status Webhook: {{env.API_BASE_URL}}/webhooks/status

📤 Next Steps:
   1. Test agent: /api-agent:test research-agent
   2. Import to database: /supabase:agent:import
   3. Verify in UI: http://localhost:7100/agents
```

## Important Notes

- **CRITICAL**: This command delegates to `/api-agent:wrap-langgraph` - see that command for full details
- Wrapped agent must be imported to database before use
- LangGraph workflow must be running for agent to work
- Status webhook uses environment variables (never hardcoded)
- Endpoint URL is constructed from workflow name and default port

## Related Commands

- `/api-agent:wrap-langgraph` - Full API agent wrap command (delegated to)
- `/langgraph:create` - Create LangGraph workflow
- `/langgraph:test` - Test LangGraph workflow
- `/api-agent:test` - Test wrapped agent

## Skill Reference

This command leverages the `api-agent-development-skill` and `langgraph-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` and `.claude/skills/langgraph-development-skill/SKILL.md` for detailed patterns.

