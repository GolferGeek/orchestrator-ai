---
description: "Import a single agent or all agents from JSON files"
argument-hint: "[json-file-path or 'all']"
---

# Import Agent(s)

Import one or all agents from JSON files in `storage/snapshots/agents/` into the database. This is how agents are synced across team members.

**Usage:** `/supabase:agent:import [json-file-path]`

**Examples:**
- `/supabase:agent:import storage/snapshots/agents/demo_supabase_agent.json` (import single agent)
- `/supabase:agent:import all` (import all agents from directory)
- `/supabase:agent:import` (show list of JSON files to choose from)

## Process

### 1. Determine Import Scope

**If "all" provided:**
- Import all JSON files from `storage/snapshots/agents/`
- Use: `bash storage/scripts/import-all-agents.sh`

**If file path provided:**
- Import single agent from JSON file
- Use: `bash storage/scripts/import-agent.sh <json-file>`

**If no argument provided:**
- List all JSON files in `storage/snapshots/agents/`
- Allow user to select which to import
- Or prompt for file path

### 2. Verify File Exists

**For single agent import:**
- Check JSON file exists
- Validate JSON syntax
- Verify file contains required agent fields

**For all agents:**
- Check `storage/snapshots/agents/` directory exists
- List available JSON files
- Validate all JSON files before importing

### 3. Show Import Preview

Display what will be imported:

**For single agent:**
```
📋 Agent Import Preview

📄 File: storage/snapshots/agents/demo_supabase_agent.json

📋 Agent Details:
   Name: Demo Supabase Agent
   Type: api
   Status: active
   Organization: [org-slug]

⚠️  This will UPSERT the agent (create or update)
```

**For all agents:**
```
📋 Import All Agents Preview

📦 Directory: storage/snapshots/agents/

📋 Agents to Import:
   ✅ demo_supabase_agent.json
   ✅ demo_marketing_swarm_n8n.json
   ✅ context-agent-development-agent.json
   ... (X files)

⚠️  This will UPSERT all agents (create or update)
```

### 4. Execute Import Script

**For single agent:**
```bash
bash storage/scripts/import-agent.sh <json-file>
```

**For all agents:**
```bash
bash storage/scripts/import-all-agents.sh
```

**What these scripts do:**
- Read JSON file(s)
- Validate agent structure
- Upsert agent(s) into database (INSERT or UPDATE)
- Handle conflicts (updates existing if ID matches)

### 5. Output Summary

**For single agent:**
```
✅ Agent Imported Successfully

📦 Agent: demo_supabase_agent
📄 Source: storage/snapshots/agents/demo_supabase_agent.json

📋 Imported Fields:
   ✅ Basic info (name, description, agent_type)
   ✅ Configuration (mode_profile, status)
   ✅ YAML definition
   ✅ Organization settings

🕐 Imported: [timestamp]

📊 Next Steps:
   - Verify agent in database: /supabase:agent:list
   - Test agent functionality
   - Activate agent if needed
```

**For all agents:**
```
✅ All Agents Imported Successfully

📦 Source: storage/snapshots/agents/

📋 Imported Agents:
   ✅ demo_supabase_agent (updated)
   ✅ demo_marketing_swarm_n8n (created)
   ✅ context-agent-development-agent (updated)
   ... (X total)

📊 Results:
   - Created: [X]
   - Updated: [X]
   - Errors: [X]

🕐 Imported: [timestamp]

📊 Next Steps:
   - Verify agents in database: /supabase:agent:list
   - Test agent functionality
   - Activate agents if needed
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/import-agent.sh` or `import-all-agents.sh` - never use direct Supabase CLI or API
- Import uses UPSERT (INSERT or UPDATE) - existing agents are updated, new ones are created
- JSON files must follow the agent format (see export command for structure)
- Always verify agents after importing
- Use this to sync agents after receiving updates from team

## Agent JSON Format

Imported agents must follow this structure:

```json
{
  "id": "uuid",
  "organization_slug": "org-slug",
  "slug": "agent-slug",
  "display_name": "Agent Name",
  "description": "Agent description",
  "agent_type": "llm|api|function|orchestrator",
  "mode_profile": {...},
  "status": "active|inactive",
  "yaml": {...},
  "config": {...}
}
```

## Error Handling

- If file not found: Show error and list available files
- If JSON invalid: Show JSON parsing error
- If required fields missing: List missing fields
- If database connection fails: Show connection error
- If import script fails: Show script output and error
- If agent conflicts: Show conflict details (handled automatically by UPSERT)

## Related Commands

- `/supabase:agent:export` - Export agent to JSON file
- `/supabase:snapshot:apply` - Apply full snapshot (includes agents)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

