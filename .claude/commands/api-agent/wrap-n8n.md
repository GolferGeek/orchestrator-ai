---
description: "Wrap an n8n workflow as an API agent (automated wrapper)"
argument-hint: "[workflow-name-or-id] [agent-name]"
---

# Wrap N8N Workflow as API Agent

Automatically wrap an n8n workflow as an API agent. This creates an agent.yaml with proper request/response transforms and webhook configuration.

**Usage:** `/api-agent:wrap-n8n [workflow-name-or-id] [agent-name]`

**Examples:**
- `/api-agent:wrap-n8n "Marketing Swarm Flexible LLM" "marketing-swarm-n8n"` (wrap by name)
- `/api-agent:wrap-n8n abc123 marketing-swarm-n8n` (wrap by workflow ID)
- `/api-agent:wrap-n8n` (list workflows to choose from)

## Process

### 1. Identify N8N Workflow

**If workflow name or ID provided:**
- Query n8n database or API for workflow
- Verify workflow exists and is active

**If no workflow specified:**
- List available n8n workflows
- Allow user to select which to wrap

### 2. Extract Workflow Information

From workflow configuration, extract:
- Workflow ID
- Workflow name
- Webhook URL/path
- Expected input parameters
- Response structure

**Common n8n patterns:**
- Webhook trigger at start
- Helper LLM pattern (ID: `9jxl03jCcqg17oOy`)
- Status webhook calls
- Response format

### 3. Determine Request Parameters

**For n8n workflows, typically need:**
- `taskId` - Task identifier
- `conversationId` - Conversation identifier
- `userId` - User identifier
- `announcement` or `prompt` - User message
- `statusWebhook` - Status tracking webhook URL
- `provider` - LLM provider (optional)
- `model` - LLM model (optional)

### 4. Determine Response Field

**Common n8n response patterns:**
- `payload.content` - Content in payload field
- `output` - Direct output field
- `data.text` - Text in data field
- `result.content` - Content in result field

Extract from workflow response structure.

### 5. Invoke API Agent Development Agent

Invoke `@api-agent-development-agent` with workflow details:

```
@api-agent-development-agent

Workflow Details:
- Name: [workflow-name]
- Webhook URL: http://localhost:5678/webhook/[path]
- Request Parameters: [list]
- Response Field: [field-path]

Create API agent with these details.
```

**The agent will:**
- Create agent.yaml with proper configuration
- Set endpoint to n8n webhook URL
- Configure request_transform with required parameters
- Configure response_transform with correct field path
- Include statusWebhook using `{{env.API_BASE_URL}}/webhooks/status`
- Set timeout to 120000ms (for workflow execution)

### 6. Create Agent Files

Agent creates:
- `apps/api/src/agents/demo/{department}/{agent-slug}/agent.yaml`
- Optional: `context.md` (n8n workflow documentation)
- Optional: `README.md` (usage examples)

### 7. Output Summary

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

- **CRITICAL**: Status webhook MUST use `{{env.API_BASE_URL}}/webhooks/status` (never hardcoded)
- Request transform includes all required n8n parameters
- Response transform extracts content from correct field
- Agent created with proper n8n workflow patterns
- Workflow must be active in n8n for agent to work

## N8N Workflow Requirements

- Must have webhook trigger (entry point)
- Should use Helper LLM pattern (ID: `9jxl03jCcqg17oOy`) for LLM calls
- Should include status webhook calls for progress tracking
- Response should contain content in predictable field

## Related Commands

- `/api-agent:create` - Create API agent manually
- `/api-agent:test` - Test wrapped agent
- `/n8n:create` - Create n8n workflow (then wrap with this command)
- `/supabase:agent:import` - Import agent to database

## Agent Reference

- `@api-agent-development-agent` - Used to create the agent configuration

## Skill Reference

This command leverages the `api-agent-development-skill` and `n8n-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` and `.claude/skills/n8n-development-skill/SKILL.md` for detailed patterns.

