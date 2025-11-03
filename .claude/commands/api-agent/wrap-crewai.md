---
description: "Wrap a CrewAI endpoint as an API agent (FUTURE - automated wrapper)"
argument-hint: "[endpoint-url] [agent-name]"
---

# Wrap CrewAI Endpoint as API Agent

**FUTURE**: Automatically wrap a CrewAI endpoint as an API agent. This feature will be implemented when CrewAI development is active.

**Usage:** `/api-agent:wrap-crewai [endpoint-url] [agent-name]`

**Examples:**
- `/api-agent:wrap-crewai http://localhost:7102/api/crewai/research research-agent` (wrap by URL)
- `/api-agent:wrap-crewai` (prompt for endpoint URL and agent name)

## Status

🚧 **This command is planned but not yet implemented.**

CrewAI development is marked as FUTURE in the PRD. Once CrewAI workflows are actively being developed, this command will:

1. Identify CrewAI endpoint
2. Extract endpoint information
3. Determine request parameters
4. Determine response field
5. Invoke `@api-agent-development-agent` to create agent.yaml
6. Create agent files

## Expected Behavior (When Implemented)

Similar to `/api-agent:wrap-langgraph`, this command will:
- Wrap CrewAI endpoints as API agents
- Configure request/response transforms
- Include webhook status tracking
- Follow CrewAI development patterns

## Related Commands

- `/api-agent:create` - Create API agent manually
- `/api-agent:wrap-n8n` - Wrap n8n workflow (implemented)
- `/api-agent:wrap-langgraph` - Wrap LangGraph endpoint (implemented)
- `/crewai:create` - Create CrewAI workflow (FUTURE)

## Skill Reference

This command will leverage the `api-agent-development-skill` and `crewai-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` and `.claude/skills/crewai-development-skill/SKILL.md` for patterns.

