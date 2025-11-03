---
description: "Test an API agent by sending a request and verifying the response"
argument-hint: "[agent-slug] [test-message]"
---

# Test API Agent

Test an API agent by sending a test request and verifying the response. This verifies that the agent's request/response transforms work correctly and the endpoint is accessible.

**Usage:** `/api-agent:test [agent-slug] [test-message]`

**Examples:**
- `/api-agent:test marketing-swarm-n8n` (test with default message)
- `/api-agent:test marketing-swarm-n8n "Write a blog post about AI"` (test with custom message)
- `/api-agent:test` (list available agents to test)

## Process

### 1. Determine Agent to Test

**If agent slug provided:**
- Use provided slug
- Verify agent exists in database or file system

**If no slug provided:**
- List available API agents
- Allow user to select which to test

### 2. Load Agent Configuration

Load agent configuration from:
- Database (if imported)
- File system: `apps/api/src/agents/demo/{department}/{agent-slug}/agent.yaml`

**Verify:**
- Agent type is "api"
- `api_configuration` section exists
- `endpoint` is configured
- `request_transform` and `response_transform` are configured

### 3. Build Test Request

**Test Message:**
- Use provided test message or default: "Hello, this is a test message"

**Build Request Body:**
- Apply request_transform template
- Replace template variables:
  - `{{userMessage}}` → test message
  - `{{conversationId}}` → generated test UUID
  - `{{taskId}}` → generated test UUID
  - `{{userId}}` → test user ID
  - `{{env.API_BASE_URL}}` → from environment or default
  - Other variables as needed

**Request Headers:**
- Use headers from `api_configuration.headers`
- Add authentication if configured

### 4. Send Test Request

Send HTTP request to agent endpoint:

```bash
curl -X POST [endpoint] \
  -H "Content-Type: application/json" \
  -d '[request-body]'
```

**Or use API test endpoint:**
```bash
POST /api/agents/{agent-slug}/test
{
  "message": "test message",
  "conversationId": "test-conv-id"
}
```

### 5. Verify Response

**Check Response:**
- HTTP status code (should be 200)
- Response body structure
- Apply response_transform to extract content
- Verify content field exists and is accessible

### 6. Output Summary

**If test succeeds:**
```
✅ API Agent Test Passed

📦 Agent: marketing-swarm-n8n
🔗 Endpoint: http://localhost:5678/webhook/marketing-swarm-flexible

📋 Request:
   Method: POST
   Headers: Content-Type: application/json
   Body: [request body preview]

📋 Response:
   Status: 200 OK
   Content Field: payload.content
   Extracted Content: [content preview]

✅ Transform Verification:
   ✅ Request transform applied correctly
   ✅ Response transform extracted content correctly
   ✅ All template variables replaced correctly
```

**If test fails:**
```
❌ API Agent Test Failed

📦 Agent: marketing-swarm-n8n
🔗 Endpoint: http://localhost:5678/webhook/marketing-swarm-flexible

📋 Request:
   [request details]

📋 Error:
   [error message]

💡 Common Issues:
   - Endpoint not accessible (check n8n/local service is running)
   - Request transform issue (check template variables)
   - Response transform issue (check field path)
   - Authentication issue (check auth configuration)
```

## Important Notes

- **CRITICAL**: Ensure the endpoint is accessible (n8n running, service up, etc.)
- Test verifies request/response transforms work correctly
- Use test to debug transform issues before importing to database
- Test uses test UUIDs for conversationId, taskId, userId
- Environment variables must be set for `{{env.API_BASE_URL}}`

## Common Test Failures

- **Endpoint not found**: Service not running or wrong URL
- **Request transform error**: Template variable not replaced correctly
- **Response transform error**: Field path incorrect or field missing
- **Authentication error**: Missing or incorrect auth credentials
- **Timeout**: Endpoint taking too long (increase timeout)

## Error Handling

- If agent not found: Show error and list available agents
- If endpoint unreachable: Show connection error
- If request transform fails: Show transform error
- If response transform fails: Show field extraction error
- If HTTP error: Show HTTP status and error message

## Related Commands

- `/api-agent:create` - Create new API agent
- `/api-agent:wrap-n8n` - Wrap n8n workflow as API agent
- `/supabase:agent:import` - Import agent to database

## Skill Reference

This command leverages the `api-agent-development-skill` for context. See `.claude/skills/api-agent-development-skill/SKILL.md` for detailed API agent patterns.

