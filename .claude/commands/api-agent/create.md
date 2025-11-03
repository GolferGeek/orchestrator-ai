---
description: "Create a new API agent that wraps an external HTTP service"
argument-hint: "[agent-name] [endpoint-url]"
---

# Create API Agent

Create a new API agent that wraps an external HTTP service (n8n workflow, LangGraph endpoint, CrewAI endpoint, OpenAI endpoint, or any REST API). This command invokes the api-agent-development-agent to guide you through the creation process.

**Usage:** `/api-agent:create [agent-name] [endpoint-url]`

**Examples:**
- `/api-agent:create` (interactive creation with agent)
- `/api-agent:create "Marketing Swarm" "http://localhost:5678/webhook/marketing-swarm"` (quick create with minimal info)
- `/api-agent:create` then provide details when prompted

## Process

### 1. Invoke API Agent Development Agent

Invoke `@api-agent-development-agent` to guide the creation process:

```
@api-agent-development-agent
```

**The agent will:**
- Ask for agent details (name, description, department, hierarchy)
- Ask for API configuration (endpoint, method, timeout, authentication)
- Ask for request transform requirements (what parameters the API expects)
- Ask for response transform requirements (what field contains the content)
- Create the agent.yaml file with proper configuration
- Optionally create context.md and README.md

### 2. Provide Agent Information

When prompted by the agent, provide:

**Basic Agent Info:**
- Agent name (display name and slug)
- Department/category
- Hierarchy level (specialist, manager, executive)
- Parent orchestrator (if applicable)
- Description
- Core capabilities
- Skills (with examples)

**API Configuration:**
- Endpoint URL
- HTTP method (POST, GET, PUT, DELETE)
- Timeout (default: 30000ms for simple APIs, 120000ms for workflows)
- Authentication (none, bearer token, API key, etc.)

**Request Transform:**
- What parameters does the API expect?
- Use template variables: `{{userMessage}}`, `{{conversationId}}`, `{{taskId}}`, etc.
- For n8n/LangGraph/CrewAI: Must include `statusWebhook` using `{{env.API_BASE_URL}}/webhooks/status`

**Response Transform:**
- What field in the API response contains the actual content?
- Common patterns: `"output"`, `"payload.content"`, `"data.answer.text"`

### 3. Agent Creates Files

The agent will create:
- `apps/api/src/agents/demo/{department}/{agent-slug}/agent.yaml`
- Optional: `context.md` (API documentation)
- Optional: `README.md` (usage examples)

### 4. Output Summary

```
✅ API Agent Created Successfully

📦 Agent: marketing-swarm-n8n
📄 Location: apps/api/src/agents/demo/marketing/marketing-swarm-n8n/

📋 Configuration:
   ✅ Endpoint: http://localhost:5678/webhook/marketing-swarm-flexible
   ✅ Method: POST
   ✅ Timeout: 120000ms
   ✅ Request Transform: Custom template with template variables
   ✅ Response Transform: Field extraction from payload.content
   ✅ Status Webhook: {{env.API_BASE_URL}}/webhooks/status

📤 Next Steps:
   1. Import agent to database: /supabase:agent:import
   2. Test agent: /api-agent:test marketing-swarm-n8n
   3. Verify in UI: http://localhost:7100/agents
```

## Important Notes

- **CRITICAL**: Status webhook URLs MUST use `{{env.API_BASE_URL}}/webhooks/status` (never hardcoded)
- Request transforms use template variables (see API Agent Development Skill for full list)
- Response transforms use field extraction with dotted/bracket paths
- For n8n/LangGraph/CrewAI workflows, include required parameters (taskId, conversationId, userId, statusWebhook)
- Agent must be imported to database before use: `/supabase:agent:import`

## Template Variables Available

- `{{userMessage}}` or `{{prompt}}` - User's message
- `{{sessionId}}` - Session identifier
- `{{conversationId}}` - Conversation identifier
- `{{taskId}}` - Task identifier
- `{{userId}}` - User identifier
- `{{agentSlug}}` - Agent slug
- `{{organizationSlug}}` or `{{org}}` - Organization slug
- `{{env.API_BASE_URL}}` - Environment variable for webhook URL

## Related Commands

- `/api-agent:test` - Test an API agent
- `/api-agent:wrap-n8n` - Wrap n8n workflow as API agent (automated)
- `/api-agent:wrap-langgraph` - Wrap LangGraph endpoint as API agent (automated)
- `/supabase:agent:import` - Import agent to database

## Agent Reference

- `@api-agent-development-agent` - Specialized agent for API agent creation

## Skill Reference

This command leverages the `api-agent-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` for detailed API agent patterns and examples.

