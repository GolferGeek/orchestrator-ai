---
description: "Export a single agent or all agents to JSON files"
argument-hint: "[agent-name or 'all']"
---

# Export Agent(s)

Export one or all agents from the database to JSON files in `storage/snapshots/agents/`. This is the primary way agents are versioned and shared.

**Usage:** `/supabase:agent:export [agent-name]`

**Examples:**
- `/supabase:agent:export demo_supabase_agent` (export single agent)
- `/supabase:agent:export all` (export all agents)
- `/supabase:agent:export` (show list of agents to choose from)

## Process

### 1. Determine Export Scope

**If "all" provided:**
- Export all agents from database
- Use: `bash storage/scripts/export-all-agents.sh`

**If agent name provided:**
- Export single agent
- Use: `bash storage/scripts/export-agent.sh <agent-name>`

**If no argument provided:**
- List all agents in database
- Allow user to select which to export
- Or prompt for agent name

### 2. Verify Agent Exists

**For single agent export:**
- Check agent exists in database
- If not found, show error with list of available agents:
  ```
  ❌ Agent not found: [agent-name]
  
  Available agents:
    - demo_supabase_agent
    - demo_marketing_swarm_n8n
    - context-agent-development-agent
    ...
  ```

### 3. Execute Export Script

**For single agent:**
```bash
bash storage/scripts/export-agent.sh <agent-name>
```

**For all agents:**
```bash
bash storage/scripts/export-all-agents.sh
```

**What these scripts do:**
- Query database for agent(s)
- Export to JSON format
- Save to `storage/snapshots/agents/<agent-name>.json`
- Include all agent fields (id, name, description, config, yaml, etc.)

### 4. Output Summary

**For single agent:**
```
✅ Agent Exported Successfully

📦 Agent: demo_supabase_agent
📄 File: storage/snapshots/agents/demo_supabase_agent.json

📋 Exported Fields:
   ✅ Basic info (name, description, agent_type)
   ✅ Configuration (mode_profile, status)
   ✅ YAML definition
   ✅ Organization settings

📊 Size: [X] KB
🕐 Exported: [timestamp]

📤 Next Steps:
   - Share JSON file with team
   - Commit to git for version control
   - Import with: /supabase:agent:import
```

**For all agents:**
```
✅ All Agents Exported Successfully

📦 Location: storage/snapshots/agents/

📋 Exported Agents:
   ✅ demo_supabase_agent
   ✅ demo_marketing_swarm_n8n
   ✅ context-agent-development-agent
   ... (X total)

📊 Total Size: [X] MB
🕐 Exported: [timestamp]

📤 Next Steps:
   - Share storage/snapshots/agents/ directory
   - Commit to git for version control
   - Import with: /supabase:agent:import
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/export-agent.sh` or `export-all-agents.sh` - never use direct Supabase CLI or API
- Exported JSON files are the source of truth for agent definitions
- Always export agents after making changes
- Share `storage/snapshots/agents/` directory for team distribution
- JSON files can be committed to git for version control

## Agent JSON Format

Exported agents follow this structure:

```json
{
  "id": "uuid",
  "organization_slug": "org-slug",
  "slug": "agent-slug",
  "display_name": "Agent Name",
  "description": "Agent description",
  "agent_type": "llm|api|function|orchestrator",
  "mode_profile": {
    "plan": {...},
    "build": {...},
    "converse": {...},
    "orchestrate": {...}
  },
  "status": "active|inactive",
  "yaml": {...},
  "config": {...}
}
```

## Error Handling

- If agent not found: List available agents
- If database connection fails: Show connection error
- If export script fails: Show script output and error
- If file write fails: Show permission error

## Related Commands

- `/supabase:agent:import` - Import agent from JSON file
- `/supabase:snapshot:export` - Export full snapshot (includes agents)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

