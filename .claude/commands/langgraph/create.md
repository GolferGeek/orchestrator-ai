---
description: "Create a new LangGraph workflow as a NestJS application"
argument-hint: "[workflow-name] [description]"
---

# Create LangGraph Workflow

Create a new LangGraph workflow as a NestJS application under `apps/langgraph/`. The workflow will be created with webhook endpoints, status tracking, and A2A protocol compliance.

**Usage:** `/langgraph:create [workflow-name] [description]`

**Examples:**
- `/langgraph:create research "Research workflow that analyzes topics and generates summaries"`
- `/langgraph:create` (interactive creation with agent)

## Process

### 1. Invoke LangGraph Development Agent

Invoke `@langgraph-development-agent` to guide the creation process:

```
@langgraph-development-agent
```

**The agent will:**
- Ask for workflow name and description
- Ask for workflow steps/nodes
- Ask for webhook endpoint path
- Ask for LLM provider/model preferences
- Create NestJS application structure
- Implement webhook endpoint
- Implement LangGraph workflow
- Implement status tracking
- Wrap as API agent automatically

### 2. Provide Workflow Information

When prompted by the agent, provide:

**Basic Workflow Info:**
- Workflow name (used for directory and endpoint)
- Description (what the workflow does)
- Workflow steps/nodes (sequential or parallel)
- Webhook endpoint path (e.g., `/webhook/langgraph/research`)

**LLM Configuration:**
- Provider preference (openai, anthropic, ollama)
- Model preference (gpt-4, claude-opus-4, etc.)
- Temperature and max tokens

**Status Tracking:**
- Status webhook URL (uses `{{env.API_BASE_URL}}/webhooks/status`)
- Step names for progress tracking

### 3. Agent Creates NestJS Application

The agent will create:
- `apps/langgraph/{workflow-name}/src/main.ts` (entry point)
- `apps/langgraph/{workflow-name}/src/app.module.ts` (NestJS module)
- `apps/langgraph/{workflow-name}/src/app.controller.ts` (webhook controller)
- `apps/langgraph/{workflow-name}/src/app.service.ts` (workflow service)
- `apps/langgraph/{workflow-name}/src/workflows/{workflow-name}.workflow.ts` (LangGraph workflow)
- `apps/langgraph/{workflow-name}/package.json` (dependencies)
- `apps/langgraph/{workflow-name}/tsconfig.json` (TypeScript config)

### 4. Agent Wraps as API Agent

After workflow creation, the agent automatically invokes `@api-agent-development-agent` to wrap the workflow as an API agent.

### 5. Output Summary

```
✅ LangGraph Workflow Created Successfully

📦 Workflow: research
📄 Location: apps/langgraph/research/

📋 NestJS Application:
   ✅ Entry point: src/main.ts
   ✅ Module: src/app.module.ts
   ✅ Controller: src/app.controller.ts (webhook endpoint)
   ✅ Service: src/app.service.ts
   ✅ Workflow: src/workflows/research.workflow.ts

🔗 Webhook Endpoint:
   POST http://localhost:7101/webhook/langgraph/research

📋 Configuration:
   ✅ Port: 7101 (from environment or default)
   ✅ Status Webhook: {{env.API_BASE_URL}}/webhooks/status
   ✅ Parameters: taskId, conversationId, userId, userMessage, statusWebhook

📦 API Agent:
   ✅ Wrapped as API agent: research-agent
   ✅ Location: apps/api/src/agents/demo/research/research-agent/

📤 Next Steps:
   1. Start workflow: cd apps/langgraph/research && npm run start:dev
   2. Test workflow: /langgraph:test research
   3. Test API agent: /api-agent:test research-agent
   4. Import agent: /supabase:agent:import
```

## Important Notes

- **CRITICAL**: LangGraph workflows are NestJS applications, not n8n workflows
- Status webhook URLs MUST use `{{env.API_BASE_URL}}/webhooks/status` (never hardcoded)
- Workflow automatically wrapped as API agent after creation
- Endpoint receives same parameters as n8n workflows (taskId, conversationId, userId, etc.)
- Workflow must be started before it can receive requests

## LangGraph vs N8N

**LangGraph:**
- NestJS application (TypeScript)
- Code-based workflows
- More control and flexibility
- Better for complex logic

**N8N:**
- Visual workflow builder
- JSON-based workflows
- Easier for non-developers
- Better for simple integrations

## Related Commands

- `/langgraph:update` - Update existing workflow
- `/langgraph:test` - Test workflow endpoint
- `/langgraph:wrap` - Wrap workflow as API agent (already done automatically)
- `/api-agent:test` - Test wrapped API agent

## Agent Reference

- `@langgraph-development-agent` - Specialized agent for LangGraph workflow creation
- `@api-agent-development-agent` - Automatically invoked to wrap workflow

## Skill Reference

This command leverages the `langgraph-development-skill` for context. See `.claude/skills/langgraph-development-skill/SKILL.md` for detailed LangGraph patterns and NestJS structure.

