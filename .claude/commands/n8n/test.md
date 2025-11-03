---
description: "Test an n8n workflow by sending a test request to its webhook"
argument-hint: "[workflow-name-or-id] [test-message]"
---

# Test N8N Workflow

Test an n8n workflow by sending a test request to its webhook endpoint and verifying the response. This verifies that the workflow executes correctly and returns expected results.

**Usage:** `/n8n:test [workflow-name-or-id] [test-message]`

**Examples:**
- `/n8n:test "Marketing Swarm Flexible LLM"` (test with default message)
- `/n8n:test "Marketing Swarm Flexible LLM" "Write a blog post about AI"` (test with custom message)
- `/n8n:test abc123` (test by workflow ID)
- `/n8n:test` (list workflows to choose from)

## Process

### 1. Identify Workflow to Test

**If workflow name or ID provided:**
- Query n8n database or API for workflow
- Verify workflow exists and is active
- Extract webhook URL/path

**If no workflow specified:**
- List available n8n workflows
- Allow user to select which to test

### 2. Load Workflow Configuration

Load workflow from:
- Database: `n8n.workflow_entity` table
- File system: `storage/snapshots/n8n/<workflow-name>.json` (if exists)

**Extract webhook information:**
- Webhook trigger node
- Webhook path/URL
- Expected input parameters

### 3. Build Test Request

**Test Message:**
- Use provided test message or default: "Hello, this is a test message"

**Build Request Body:**
```json
{
  "taskId": "test-task-id",
  "conversationId": "test-conv-id",
  "userId": "test-user-id",
  "announcement": "test message",
  "statusWebhook": "http://localhost:7100/webhooks/status",
  "provider": "openai",
  "model": "gpt-4"
}
```

**Webhook URL:**
- Format: `http://localhost:5678/webhook/[path]`
- Or: `http://localhost:5678/webhook/[workflow-id]`

### 4. Send Test Request

Send HTTP POST request to webhook:

```bash
curl -X POST http://localhost:5678/webhook/[path] \
  -H "Content-Type: application/json" \
  -d '[request-body]'
```

**Or use n8n API:**
```bash
POST http://localhost:5678/api/v1/workflows/[id]/execute
```

### 5. Monitor Execution

**Check workflow execution:**
- Monitor n8n execution logs
- Track status webhook calls (if configured)
- Wait for workflow completion

**Expected execution time:**
- Simple workflows: 5-10 seconds
- Helper LLM workflows: 30-60 seconds
- Complex workflows: 60+ seconds

### 6. Verify Response

**Check Response:**
- HTTP status code (should be 200)
- Response body structure
- Content field exists
- Helper LLM calls succeeded

**Response Structure:**
```json
{
  "payload": {
    "content": "workflow output...",
    "provider": "openai",
    "model": "gpt-4"
  }
}
```

### 7. Output Summary

**If test succeeds:**
```
✅ N8N Workflow Test Passed

📦 Workflow: Marketing Swarm Flexible LLM
🔗 Webhook: http://localhost:5678/webhook/marketing-swarm-flexible

📋 Request:
   Method: POST
   Body: [request body preview]

📋 Response:
   Status: 200 OK
   Execution Time: [X] seconds
   Content: [content preview]

✅ Verification:
   ✅ Webhook triggered successfully
   ✅ Helper LLM calls executed
   ✅ Status webhooks sent (if configured)
   ✅ Response format correct
```

**If test fails:**
```
❌ N8N Workflow Test Failed

📦 Workflow: Marketing Swarm Flexible LLM
🔗 Webhook: http://localhost:5678/webhook/marketing-swarm-flexible

📋 Request:
   [request details]

📋 Error:
   [error message]

💡 Common Issues:
   - Workflow not active (activate in n8n UI)
   - Webhook path incorrect
   - Missing required parameters
   - Helper LLM workflow not found
   - n8n service not running
```

## Important Notes

- **CRITICAL**: Workflow must be active in n8n UI for webhook to work
- Ensure n8n service is running (`npm run n8n:up`)
- Test uses test UUIDs for taskId, conversationId, userId
- Status webhook calls are optional but recommended
- Execution time varies based on workflow complexity

## Common Test Failures

- **Workflow not active**: Activate workflow in n8n UI
- **Webhook not found**: Check webhook path/URL
- **Missing parameters**: Verify required parameters are included
- **Helper LLM not found**: Verify Helper LLM workflow exists (ID: `9jxl03jCcqg17oOy`)
- **Timeout**: Workflow taking too long (check Helper LLM calls)

## Error Handling

- If workflow not found: Show error and list available workflows
- If webhook unreachable: Show connection error
- If workflow not active: Warn and suggest activation
- If execution fails: Show n8n execution error
- If timeout: Show timeout error

## Related Commands

- `/n8n:create` - Create new workflow
- `/n8n:update` - Update workflow
- `/n8n:wrap` - Wrap workflow as API agent
- `/api-agent:wrap-n8n` - Wrap workflow as API agent (alternative)

## Skill Reference

This command leverages the `n8n-development-skill` for context. See `.claude/skills/n8n-development-skill/SKILL.md` for detailed N8N patterns.

