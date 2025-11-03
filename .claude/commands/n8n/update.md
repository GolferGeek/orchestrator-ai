---
description: "Update an existing n8n workflow with new nodes or modifications"
argument-hint: "[workflow-name-or-id] [description-of-changes]"
---

# Update N8N Workflow

Update an existing n8n workflow by modifying nodes, adding new steps, or changing configuration. This command uses the n8n-development-agent to make changes while preserving existing functionality.

**Usage:** `/n8n:update [workflow-name-or-id] [description-of-changes]`

**Examples:**
- `/n8n:update "Marketing Swarm Flexible LLM" "Add error handling node after Helper LLM call"`
- `/n8n:update abc123 "Change temperature from 0.7 to 0.5"`
- `/n8n:update` (list workflows to choose from)

## Process

### 1. Identify Workflow to Update

**If workflow name or ID provided:**
- Query n8n database or API for workflow
- Verify workflow exists
- Load current workflow configuration

**If no workflow specified:**
- List available n8n workflows
- Allow user to select which to update

### 2. Load Current Workflow

Load workflow from:
- Database: `n8n.workflow_entity` table
- File system: `storage/snapshots/n8n/<workflow-name>.json` (if exists)

**Display current workflow structure:**
```
📋 Current Workflow: Marketing Swarm Flexible LLM

📊 Workflow Structure:
   - Webhook Trigger
   - Extract Config Node
   - Helper LLM Call (Step 1)
   - Helper LLM Call (Step 2)
   - Helper LLM Call (Step 3)
   - Combine Results
   - Respond to Webhook

📋 Nodes: [X] nodes
🔄 Active: [true/false]
```

### 3. Understand Changes Requested

**Parse description of changes:**
- What needs to be added?
- What needs to be modified?
- What needs to be removed?
- What parameters need to change?

**Common update scenarios:**
- Add new Helper LLM call
- Modify temperature/model settings
- Add error handling
- Change response format
- Update webhook path
- Add new processing step

### 4. Invoke N8N Development Agent

Invoke `@n8n-development-agent` with update request:

```
@n8n-development-agent

Update Request:
- Workflow: [workflow-name]
- Current Structure: [summary]
- Changes Needed: [description]

Update the workflow while preserving existing functionality.
```

**The agent will:**
- Analyze current workflow structure
- Plan changes to preserve existing functionality
- Update workflow nodes as needed
- Ensure Helper LLM pattern is maintained
- Verify required parameters are included
- Update workflow in database

### 5. Verify Updates

**Check updated workflow:**
- Verify Helper LLM calls still include required parameters
- Verify status webhook configuration
- Verify workflow structure is correct
- Check for any breaking changes

### 6. Export Updated Workflow

After updating, export workflow to file system:

```bash
bash storage/scripts/export-n8n-workflow.sh "<workflow-name>"
```

This saves the updated workflow to `storage/snapshots/n8n/` for version control.

### 7. Output Summary

```
✅ N8N Workflow Updated Successfully

📦 Workflow: Marketing Swarm Flexible LLM
🔄 Changes Applied:
   ✅ Added error handling node after Helper LLM calls
   ✅ Updated temperature from 0.7 to 0.5
   ✅ Added retry logic for failed calls

📋 Updated Structure:
   - Webhook Trigger
   - Extract Config Node
   - Helper LLM Call (Step 1)
   - Error Handler (NEW)
   - Helper LLM Call (Step 2)
   - Error Handler (NEW)
   - Helper LLM Call (Step 3)
   - Error Handler (NEW)
   - Combine Results
   - Respond to Webhook

📊 Nodes: [X] nodes (was [Y])
📄 Exported to: storage/snapshots/n8n/marketing-swarm-flexible-llm.json

📤 Next Steps:
   1. Test workflow: /n8n:test "Marketing Swarm Flexible LLM"
   2. Activate workflow in n8n UI if needed
   3. Wrap as API agent: /api-agent:wrap-n8n "Marketing Swarm Flexible LLM"
```

## Important Notes

- **CRITICAL**: Updates must preserve Helper LLM pattern (ID: `9jxl03jCcqg17oOy`)
- Required parameters must remain (taskId, conversationId, userId, statusWebhook, etc.)
- Status webhook URL must continue using environment variables
- Always export workflow after updating for version control
- Test workflow after updates to verify functionality

## Common Update Patterns

- **Add Helper LLM call**: Include required parameters, use Execute Workflow node
- **Modify parameters**: Update Set node values, preserve required fields
- **Add error handling**: Use error handling nodes, set `continueOnFail: true`
- **Change response format**: Update response nodes, maintain A2A compliance

## Error Handling

- If workflow not found: Show error and list available workflows
- If update breaks workflow: Show error and suggest rollback
- If required parameters missing: Warn and suggest fixes
- If Helper LLM pattern broken: Show error and suggest fixes

## Related Commands

- `/n8n:create` - Create new workflow
- `/n8n:test` - Test workflow
- `/n8n:wrap` - Wrap workflow as API agent
- `/supabase:n8n:export` - Export workflow to file

## Agent Reference

- `@n8n-development-agent` - Used to update workflow

## Skill Reference

This command leverages the `n8n-development-skill` for context. See `.claude/skills/n8n-development-skill/SKILL.md` for detailed N8N patterns and Helper LLM usage.

