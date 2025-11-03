---
description: "Update an existing LangGraph workflow with new nodes or modifications"
argument-hint: "[workflow-name] [description-of-changes]"
---

# Update LangGraph Workflow

Update an existing LangGraph workflow by modifying nodes, adding new steps, or changing configuration. This command uses the langgraph-development-agent to make changes while preserving existing functionality.

**Usage:** `/langgraph:update [workflow-name] [description-of-changes]`

**Examples:**
- `/langgraph:update research "Add error handling step after LLM call"`
- `/langgraph:update research "Change temperature from 0.7 to 0.5"`
- `/langgraph:update` (list workflows to choose from)

## Process

### 1. Identify Workflow to Update

**If workflow name provided:**
- Locate workflow directory: `apps/langgraph/{workflow-name}/`
- Verify workflow exists
- Load current workflow code

**If no workflow specified:**
- List available LangGraph workflows in `apps/langgraph/`
- Allow user to select which to update

### 2. Load Current Workflow

Load workflow files:
- `src/workflows/{workflow-name}.workflow.ts` (LangGraph workflow definition)
- `src/app.controller.ts` (webhook endpoint)
- `src/app.service.ts` (workflow service)

**Display current workflow structure:**
```
📋 Current Workflow: research

📊 Workflow Structure:
   - Start Node
   - LLM Call (Step 1)
   - Process Results (Step 2)
   - Generate Summary (Step 3)
   - End Node

📋 Steps: [X] steps
🔗 Endpoint: /webhook/langgraph/research
```

### 3. Understand Changes Requested

**Parse description of changes:**
- What needs to be added?
- What needs to be modified?
- What needs to be removed?
- What parameters need to change?

**Common update scenarios:**
- Add new LangGraph node
- Modify LLM provider/model settings
- Add error handling
- Change response format
- Update webhook path
- Add new processing step

### 4. Invoke LangGraph Development Agent

Invoke `@langgraph-development-agent` with update request:

```
@langgraph-development-agent

Update Request:
- Workflow: [workflow-name]
- Current Structure: [summary]
- Changes Needed: [description]

Update the workflow while preserving existing functionality.
```

**The agent will:**
- Analyze current workflow code
- Plan changes to preserve existing functionality
- Update workflow nodes as needed
- Ensure status tracking is maintained
- Verify required parameters are included
- Update TypeScript code

### 5. Verify Updates

**Check updated workflow:**
- Verify webhook endpoint still works
- Verify status webhook configuration
- Verify workflow structure is correct
- Check for TypeScript compilation errors

### 6. Rebuild and Test

After updating, rebuild and test:

```bash
cd apps/langgraph/{workflow-name}
npm run build
npm run start:dev
```

### 7. Output Summary

```
✅ LangGraph Workflow Updated Successfully

📦 Workflow: research
📄 Location: apps/langgraph/research/

🔄 Changes Applied:
   ✅ Added error handling step after LLM call
   ✅ Updated temperature from 0.7 to 0.5
   ✅ Added retry logic for failed calls

📋 Updated Structure:
   - Start Node
   - LLM Call (Step 1)
   - Error Handler (NEW)
   - Process Results (Step 2)
   - Error Handler (NEW)
   - Generate Summary (Step 3)
   - End Node

📊 Steps: [X] steps (was [Y])
🔗 Endpoint: /webhook/langgraph/research

📤 Next Steps:
   1. Rebuild: cd apps/langgraph/research && npm run build
   2. Restart: npm run start:dev
   3. Test workflow: /langgraph:test research
   4. Update API agent if needed: /api-agent:wrap-langgraph
```

## Important Notes

- **CRITICAL**: Updates must preserve status webhook configuration
- Required parameters must remain (taskId, conversationId, userId, statusWebhook, etc.)
- Status webhook URL must continue using environment variables
- Workflow must be rebuilt and restarted after updates
- TypeScript compilation must succeed after updates

## Common Update Patterns

- **Add LangGraph node**: Create new node in workflow, update state graph
- **Modify LLM settings**: Update provider/model configuration
- **Add error handling**: Implement try-catch and error nodes
- **Change response format**: Update response transformation logic

## Error Handling

- If workflow not found: Show error and list available workflows
- If update breaks workflow: Show TypeScript compilation errors
- If required parameters missing: Warn and suggest fixes
- If status webhook broken: Show error and suggest fixes

## Related Commands

- `/langgraph:create` - Create new workflow
- `/langgraph:test` - Test workflow
- `/langgraph:wrap` - Wrap workflow as API agent
- `/api-agent:wrap-langgraph` - Wrap workflow as API agent (alternative)

## Agent Reference

- `@langgraph-development-agent` - Used to update workflow

## Skill Reference

This command leverages the `langgraph-development-skill` for context. See `.claude/skills/langgraph-development-skill/SKILL.md` for detailed LangGraph patterns.

