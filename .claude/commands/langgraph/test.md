---
description: "Test a LangGraph workflow by sending a test request to its webhook endpoint"
argument-hint: "[workflow-name] [test-message]"
---

# Test LangGraph Workflow

Test a LangGraph workflow by sending a test request to its webhook endpoint and verifying the response. This verifies that the workflow executes correctly and returns expected results.

**Usage:** `/langgraph:test [workflow-name] [test-message]`

**Examples:**
- `/langgraph:test research` (test with default message)
- `/langgraph:test research "Analyze the topic of AI agents"` (test with custom message)
- `/langgraph:test` (list workflows to choose from)

## Process

### 1. Identify Workflow to Test

**If workflow name provided:**
- Locate workflow directory: `apps/langgraph/{workflow-name}/`
- Verify workflow exists
- Extract webhook endpoint path

**If no workflow specified:**
- List available LangGraph workflows in `apps/langgraph/`
- Allow user to select which to test

### 2. Verify Workflow is Running

**Check if workflow service is running:**
- Check if process is running on expected port
- Default port: 7101 (or from environment)

**If not running:**
```
⚠️  Workflow service not running

📋 Start workflow:
   cd apps/langgraph/{workflow-name}
   npm run start:dev

   Or in background:
   npm run start:dev &
```

### 3. Build Test Request

**Test Message:**
- Use provided test message or default: "Hello, this is a test message"

**Build Request Body:**
```json
{
  "taskId": "test-task-id",
  "conversationId": "test-conv-id",
  "userId": "test-user-id",
  "userMessage": "test message",
  "statusWebhook": "http://localhost:7100/webhooks/status",
  "provider": "openai",
  "model": "gpt-4",
  "stepName": "test-step",
  "sequence": 1,
  "totalSteps": 1
}
```

**Webhook URL:**
- Format: `http://localhost:7101/webhook/langgraph/{workflow-name}`
- Or from workflow configuration

### 4. Send Test Request

Send HTTP POST request to webhook:

```bash
curl -X POST http://localhost:7101/webhook/langgraph/research \
  -H "Content-Type: application/json" \
  -d '[request-body]'
```

### 5. Monitor Execution

**Check workflow execution:**
- Monitor NestJS application logs
- Track status webhook calls (if configured)
- Wait for workflow completion

**Expected execution time:**
- Simple workflows: 5-10 seconds
- LLM workflows: 30-60 seconds
- Complex workflows: 60+ seconds

### 6. Verify Response

**Check Response:**
- HTTP status code (should be 200)
- Response body structure
- Content field exists
- LangGraph workflow executed successfully

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
✅ LangGraph Workflow Test Passed

📦 Workflow: research
🔗 Endpoint: http://localhost:7101/webhook/langgraph/research

📋 Request:
   Method: POST
   Body: [request body preview]

📋 Response:
   Status: 200 OK
   Execution Time: [X] seconds
   Content: [content preview]

✅ Verification:
   ✅ Webhook triggered successfully
   ✅ LangGraph workflow executed
   ✅ Status webhooks sent (if configured)
   ✅ Response format correct
```

**If test fails:**
```
❌ LangGraph Workflow Test Failed

📦 Workflow: research
🔗 Endpoint: http://localhost:7101/webhook/langgraph/research

📋 Request:
   [request details]

📋 Error:
   [error message]

💡 Common Issues:
   - Workflow service not running (start with npm run start:dev)
   - Endpoint path incorrect
   - Missing required parameters
   - TypeScript compilation errors
   - LangGraph workflow errors
```

## Important Notes

- **CRITICAL**: Workflow service must be running before testing
- Ensure workflow is built and started (`npm run build && npm run start:dev`)
- Test uses test UUIDs for taskId, conversationId, userId
- Status webhook calls are optional but recommended
- Execution time varies based on workflow complexity

## Common Test Failures

- **Service not running**: Start workflow service
- **Endpoint not found**: Check webhook path/URL
- **Missing parameters**: Verify required parameters are included
- **TypeScript errors**: Rebuild workflow (`npm run build`)
- **Workflow errors**: Check LangGraph workflow logic

## Error Handling

- If workflow not found: Show error and list available workflows
- If service not running: Show error and suggest starting service
- If endpoint unreachable: Show connection error
- If execution fails: Show workflow error details
- If timeout: Show timeout error

## Related Commands

- `/langgraph:create` - Create new workflow
- `/langgraph:update` - Update workflow
- `/langgraph:wrap` - Wrap workflow as API agent
- `/api-agent:test` - Test wrapped API agent

## Skill Reference

This command leverages the `langgraph-development-skill` for context. See `.claude/skills/langgraph-development-skill/SKILL.md` for detailed LangGraph patterns.

