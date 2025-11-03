---
description: "Export a single N8N workflow or all workflows to JSON files"
argument-hint: "[workflow-name or 'all']"
---

# Export N8N Workflow(s)

Export one or all N8N workflows from the database to JSON files in `storage/snapshots/n8n/`. This is the primary way N8N workflows are versioned and shared.

**Usage:** `/supabase:n8n:export [workflow-name]`

**Examples:**
- `/supabase:n8n:export "Helper: LLM Task"` (export single workflow)
- `/supabase:n8n:export all` (export all workflows)
- `/supabase:n8n:export` (show list of workflows to choose from)

## Process

### 1. Determine Export Scope

**If "all" provided:**
- Export all workflows from database
- Use: `bash storage/scripts/export-all-n8n-workflows.sh`

**If workflow name provided:**
- Export single workflow
- Use: `bash storage/scripts/export-n8n-workflow.sh "<workflow-name>"`

**If no argument provided:**
- List all workflows in database
- Allow user to select which to export
- Or prompt for workflow name

### 2. Verify Workflow Exists

**For single workflow export:**
- Check workflow exists in `n8n.workflow_entity` table
- If not found, show error with list of available workflows:
  ```
  ❌ Workflow not found: [workflow-name]
  
  Available workflows:
    - Helper: LLM Task
    - Marketing Swarm Flexible LLM
    - Research Summarizer
    ...
  ```

### 3. Execute Export Script

**For single workflow:**
```bash
bash storage/scripts/export-n8n-workflow.sh "<workflow-name>"
```

**For all workflows:**
```bash
bash storage/scripts/export-all-n8n-workflows.sh
```

**What these scripts do:**
- Query `n8n.workflow_entity` table for workflow(s)
- Export to JSON format
- Save to `storage/snapshots/n8n/<sanitized-name>.json`
- Include all workflow fields (id, name, nodes, connections, settings, etc.)

**Filename sanitization:**
- Convert to lowercase
- Replace spaces with hyphens
- Remove special characters
- Example: "Helper: LLM Task" → `helper-llm-task.json`

### 4. Output Summary

**For single workflow:**
```
✅ N8N Workflow Exported Successfully

📦 Workflow: Helper: LLM Task
📄 File: storage/snapshots/n8n/helper-llm-task.json

📋 Exported Fields:
   ✅ Basic info (id, name, active)
   ✅ Nodes array
   ✅ Connections object
   ✅ Settings
   ✅ Static data
   ✅ Metadata

📊 Size: [X] KB
🕐 Exported: [timestamp]

📤 Next Steps:
   - Share JSON file with team
   - Commit to git for version control
   - Import with: /supabase:n8n:import
```

**For all workflows:**
```
✅ All N8N Workflows Exported Successfully

📦 Location: storage/snapshots/n8n/

📋 Exported Workflows:
   ✅ Helper: LLM Task
   ✅ Marketing Swarm Flexible LLM
   ✅ Research Summarizer
   ... (X total)

📊 Total Size: [X] MB
🕐 Exported: [timestamp]

📤 Next Steps:
   - Share storage/snapshots/n8n/ directory
   - Commit to git for version control
   - Import with: /supabase:n8n:import
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/export-n8n-workflow.sh` or `export-all-n8n-workflows.sh` - never use direct Supabase CLI or API
- Exported JSON files are the source of truth for N8N workflow definitions
- Always export workflows after making changes
- Share `storage/snapshots/n8n/` directory for team distribution
- JSON files can be committed to git for version control
- Workflow names may contain special characters - filenames are sanitized

## N8N Workflow JSON Format

Exported workflows follow this structure:

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

- If workflow not found: List available workflows
- If database connection fails: Show connection error
- If export script fails: Show script output and error
- If file write fails: Show permission error
- If workflow name has special characters: Handle sanitization automatically

## Related Commands

- `/supabase:n8n:import` - Import workflow from JSON file
- `/supabase:snapshot:export` - Export full snapshot (includes N8N workflows)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

