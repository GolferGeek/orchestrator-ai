---
description: "Wrap a LangGraph endpoint as an API agent (automated wrapper)"
argument-hint: "[endpoint-url] [agent-name]"
---

# Wrap LangGraph Endpoint as API Agent

Automatically wrap a LangGraph endpoint as an API agent. This creates an agent.yaml with proper request/response transforms and webhook configuration.

**Usage:** `/api-agent:wrap-langgraph [endpoint-url] [agent-name]`

**Examples:**
- `/api-agent:wrap-langgraph http://localhost:7101/api/langgraph/research research-agent` (wrap by URL)
- `/api-agent:wrap-langgraph` (prompt for endpoint URL and agent name)

## Process

### 1. Identify LangGraph Endpoint

**If endpoint URL provided:**
- Use provided URL
- Verify endpoint is accessible

**If no URL provided:**
- Prompt user for LangGraph endpoint URL
- Verify endpoint exists and responds

### 2. Extract Endpoint Information

From LangGraph endpoint, determine:
- Endpoint URL
- Expected input parameters
- Response structure
- Authentication requirements (if any)

**Common LangGraph patterns:**
- NestJS application structure
- Webhook status tracking
- A2A protocol compliance
- Request/response formats

### 3. Determine Request Parameters

**For LangGraph endpoints, typically need:**
- `taskId` - Task identifier
- `conversationId` - Conversation identifier
- `userId` - User identifier
- `userMessage` or `prompt` - User message
- `statusWebhook` - Status tracking webhook URL
- `provider` - LLM provider (optional)
- `model` - LLM model (optional)

### 4. Determine Response Field

**Common LangGraph response patterns:**
- `payload.content` - Content in payload field
- `data.text` - Text in data field
- `result.content` - Content in result field
- `output` - Direct output field

Extract from endpoint response structure or documentation.

### 5. Invoke API Agent Development Agent

Invoke `@api-agent-development-agent` with endpoint details:

```
@api-agent-development-agent

LangGraph Endpoint Details:
- URL: [endpoint-url]
- Request Parameters: [list]
- Response Field: [field-path]

Create API agent with these details.
```

**The agent will:**
- Create agent.yaml with proper configuration
- Set endpoint to LangGraph URL
- Configure request_transform with required parameters
- Configure response_transform with correct field path
- Include statusWebhook using `{{env.API_BASE_URL}}/webhooks/status`
- Set timeout to 120000ms (for workflow execution)

### 6. Create Agent Files

Agent creates:
- `apps/api/src/agents/demo/{department}/{agent-slug}/agent.yaml`
- Optional: `context.md` (LangGraph endpoint documentation)
- Optional: `README.md` (usage examples)

### 7. Output Summary

```
✅ LangGraph Endpoint Wrapped as API Agent

📦 Agent: research-agent
📄 Location: apps/api/src/agents/demo/research/research-agent/

🔄 LangGraph Endpoint:
   URL: http://localhost:7101/api/langgraph/research
   Method: POST

📋 Configuration:
   ✅ Endpoint: http://localhost:7101/api/langgraph/research
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

- **CRITICAL**: Status webhook MUST use `{{env.API_BASE_URL}}/webhooks/status` (never hardcoded)
- Request transform includes all required LangGraph parameters
- Response transform extracts content from correct field
- Agent created with proper LangGraph endpoint patterns
- Endpoint must be running and accessible for agent to work

## LangGraph Endpoint Requirements

- Must be a NestJS application
- Should support A2A protocol
- Should include webhook status tracking
- Response should contain content in predictable field

## Related Commands

- `/api-agent:create` - Create API agent manually
- `/api-agent:test` - Test wrapped agent
- `/langgraph:create` - Create LangGraph workflow (then wrap with this command)
- `/supabase:agent:import` - Import agent to database

## Agent Reference

- `@api-agent-development-agent` - Used to create the agent configuration

## Skill Reference

This command leverages the `api-agent-development-skill` and `langgraph-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` and `.claude/skills/langgraph-development-skill/SKILL.md` for detailed patterns.

