---
description: "Import a single N8N workflow or all workflows from JSON files"
argument-hint: "[json-file-path or 'all']"
---

# Import N8N Workflow(s)

Import one or all N8N workflows from JSON files in `storage/snapshots/n8n/` into the database. This is how N8N workflows are synced across team members.

**Usage:** `/supabase:n8n:import [json-file-path]`

**Examples:**
- `/supabase:n8n:import storage/snapshots/n8n/helper-llm-task.json` (import single workflow)
- `/supabase:n8n:import all` (import all workflows from directory)
- `/supabase:n8n:import` (show list of JSON files to choose from)

## Process

### 1. Determine Import Scope

**If "all" provided:**
- Import all JSON files from `storage/snapshots/n8n/`
- Use: `bash storage/scripts/import-all-n8n-workflows.sh`

**If file path provided:**
- Import single workflow from JSON file
- Use: `bash storage/scripts/import-n8n-workflow.sh <json-file>`

**If no argument provided:**
- List all JSON files in `storage/snapshots/n8n/`
- Allow user to select which to import
- Or prompt for file path

### 2. Verify File Exists

**For single workflow import:**
- Check JSON file exists
- Validate JSON syntax
- Verify file contains required workflow fields (id, name, nodes, connections)

**For all workflows:**
- Check `storage/snapshots/n8n/` directory exists
- List available JSON files
- Validate all JSON files before importing

### 3. Show Import Preview

Display what will be imported:

**For single workflow:**
```
📋 N8N Workflow Import Preview

📄 File: storage/snapshots/n8n/helper-llm-task.json

📋 Workflow Details:
   Name: Helper: LLM Task
   ID: [workflow-id]
   Nodes: [X] nodes
   Active: [true/false]

⚠️  This will UPSERT the workflow (create or update)
```

**For all workflows:**
```
📋 Import All N8N Workflows Preview

📦 Directory: storage/snapshots/n8n/

📋 Workflows to Import:
   ✅ helper-llm-task.json
   ✅ marketing-swarm-flexible-llm.json
   ✅ research-summarizer.json
   ... (X files)

⚠️  This will UPSERT all workflows (create or update)
```

### 4. Execute Import Script

**For single workflow:**
```bash
bash storage/scripts/import-n8n-workflow.sh <json-file>
```

**For all workflows:**
```bash
bash storage/scripts/import-all-n8n-workflows.sh
```

**What these scripts do:**
- Read JSON file(s)
- Validate workflow structure
- Upsert workflow(s) into `n8n.workflow_entity` table (INSERT or UPDATE)
- Handle conflicts (updates existing if ID matches)

### 5. Output Summary

**For single workflow:**
```
✅ N8N Workflow Imported Successfully

📦 Workflow: Helper: LLM Task
📄 Source: storage/snapshots/n8n/helper-llm-task.json

📋 Imported Fields:
   ✅ Basic info (id, name, active)
   ✅ Nodes array
   ✅ Connections object
   ✅ Settings
   ✅ Static data

🕐 Imported: [timestamp]

📊 Next Steps:
   - Verify workflow in n8n UI: http://localhost:5678
   - Activate workflow if needed
   - Test workflow functionality
```

**For all workflows:**
```
✅ All N8N Workflows Imported Successfully

📦 Source: storage/snapshots/n8n/

📋 Imported Workflows:
   ✅ Helper: LLM Task (updated)
   ✅ Marketing Swarm Flexible LLM (created)
   ✅ Research Summarizer (updated)
   ... (X total)

📊 Results:
   - Created: [X]
   - Updated: [X]
   - Errors: [X]

🕐 Imported: [timestamp]

📊 Next Steps:
   - Verify workflows in n8n UI: http://localhost:5678
   - Activate workflows if needed
   - Test workflow functionality
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/import-n8n-workflow.sh` or `import-all-n8n-workflows.sh` - never use direct Supabase CLI or API
- Import uses UPSERT (INSERT or UPDATE) - existing workflows are updated, new ones are created
- JSON files must follow the N8N workflow format (see export command for structure)
- Always verify workflows in n8n UI after importing
- Use this to sync workflows after receiving updates from team
- Workflows may need to be activated manually in n8n UI after import

## N8N Workflow JSON Format

Imported workflows must follow this structure:

```json
{
  "id": "workflow-id",
  "name": "Workflow Name",
  "active": true,
  "nodes": [...],
  "connections": {...},
  "settings": {...},
  "staticData": {...},
  "pinData": {...},
  "versionId": "...",
  "triggerCount": 0,
  "meta": {...}
}
```

## Error Handling

- If file not found: Show error and list available files
- If JSON invalid: Show JSON parsing error
- If required fields missing: List missing fields (id, name, nodes, connections)
- If database connection fails: Show connection error
- If import script fails: Show script output and error
- If workflow conflicts: Show conflict details (handled automatically by UPSERT)

## Related Commands

- `/supabase:n8n:export` - Export workflow to JSON file
- `/supabase:snapshot:apply` - Apply full snapshot (includes N8N workflows)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

