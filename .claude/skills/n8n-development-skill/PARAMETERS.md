# N8N Workflow Parameters - Helper LLM & Webhook Status

Complete parameter reference for N8N workflows that use Helper LLM pattern and webhook status system in Orchestrator AI.

## Required Parameters for Helper LLM Integration

When creating N8N workflows that use the Helper LLM pattern (`9jxl03jCcqg17oOy`) and webhook status tracking, these parameters MUST be included:

### LLM Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | ✅ Yes | - | The prompt/message to send to LLM (can use `userMessage` instead) |
| `userMessage` | string | ✅ Yes* | - | Alternative to `prompt` (Helper LLM accepts both) |
| `systemMessage` | string | ❌ No | - | System prompt for LLM context |
| `provider` | string | ❌ No | `"openai"` | `"openai"` \| `"anthropic"` \| `"ollama"` |
| `model` | string | ❌ No | Provider-specific | OpenAI: `"gpt-4"`, Anthropic: `"claude-3-sonnet-20240229"`, Ollama: `"llama2"` |
| `temperature` | number | ❌ No | `0.7` | 0.0 to 1.0 (0.5 factual, 0.7 general, 0.8 creative) |
| `maxTokens` | number | ❌ No | `1000` | Max completion tokens (800 short, 1000 standard, 1200+ long) |

**Note:** `prompt` OR `userMessage` is required (Helper LLM accepts both, but use one consistently).

### Status Tracking Parameters (REQUIRED for Webhook Status)

These parameters are **REQUIRED** if you want webhook status tracking to work:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `taskId` | string | ✅ Yes | Task identifier (UUID) for tracking |
| `conversationId` | string | ✅ Yes | Conversation context identifier (UUID) |
| `userId` | string | ✅ Yes | User identifier (UUID) |
| `statusWebhook` | string | ✅ Yes* | Webhook URL for status updates (must read from `.env`) |
| `stepName` | string | ✅ Yes | Descriptive name of this step (e.g., `"web_post"`, `"seo_content"`) |
| `sequence` | number | ✅ Yes | Step number in sequence (1-based, e.g., `1`, `2`, `3`) |
| `totalSteps` | number | ✅ Yes | Total number of steps in parent workflow (e.g., `4`) |
| `sendStartStatus` | boolean | ❌ No | `false` | Whether to send start status webhook |
| `sendEndStatus` | boolean | ❌ No | `false` | Whether to send end status webhook |

**Note:** `statusWebhook` is REQUIRED if `sendStartStatus` or `sendEndStatus` is `true`.

## Status Webhook URL Configuration

**CRITICAL**: The `statusWebhook` URL MUST be read from environment variables, NOT hardcoded.

### Environment Variable Reading

```javascript
// ❌ WRONG - Hardcoded
"statusWebhook": "http://host.docker.internal:7100/webhooks/status"

// ✅ CORRECT - Read from environment
"statusWebhook": "={{ process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://host.docker.internal:7100' }}/webhooks/status"
```

### Default Behavior

1. **Read from `.env` file:**
   - Primary: `API_BASE_URL` or `VITE_API_BASE_URL`
   - Development fallback: `http://host.docker.internal:7100`
   - Production fallback: Read from production `.env` (should be production URL)

2. **URL Construction:**
   - Base URL from env + `/webhooks/status`
   - Example: `${API_BASE_URL}/webhooks/status`

3. **Environment-Specific:**
   - **Development (Docker)**: `http://host.docker.internal:7100/webhooks/status`
   - **Production**: `${API_BASE_URL}/webhooks/status` (from `.env`)

## Complete Parameter Set for Helper LLM Call

When calling Helper LLM via "Execute Workflow" node, include ALL these parameters:

```javascript
{
  "source": "database",
  "workflowId": "9jxl03jCcqg17oOy",
  "fieldMapping": {
    "fields": [
      // LLM Configuration
      { "name": "prompt", "value": "={{ $json.body.announcement }}" },
      // OR
      { "name": "userMessage", "value": "={{ $json.body.announcement }}" },
      { "name": "systemMessage", "value": "={{ $json.body.systemMessage }}" }, // Optional
      { "name": "provider", "value": "={{ $json.body.provider || 'openai' }}" },
      { "name": "model", "value": "={{ $json.body.model || 'gpt-4' }}" },
      { "name": "temperature", "value": "={{ $json.body.temperature || 0.7 }}" },
      { "name": "maxTokens", "value": "={{ $json.body.maxTokens || 1000 }}" },
      
      // Status Tracking (REQUIRED)
      { "name": "taskId", "value": "={{ $json.body.taskId }}" },
      { "name": "conversationId", "value": "={{ $json.body.conversationId }}" },
      { "name": "userId", "value": "={{ $json.body.userId }}" },
      { "name": "statusWebhook", "value": "={{ $json.body.statusWebhook || process.env.API_BASE_URL + '/webhooks/status' }}" },
      { "name": "stepName", "value": "web_post" },
      { "name": "sequence", "value": 1 },
      { "name": "totalSteps", "value": 4 },
      { "name": "sendStartStatus", "value": true },
      { "name": "sendEndStatus", "value": true }
    ]
  }
}
```

## Webhook Input Parameters (Parent Workflow)

When a workflow receives a webhook that will call Helper LLM, it should accept these parameters:

```json
{
  // LLM Configuration
  "prompt": "The task description",
  "provider": "openai|anthropic|ollama",
  "model": "model-name",
  "temperature": 0.7,
  "maxTokens": 1000,
  
  // Status Tracking (REQUIRED)
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "statusWebhook": "http://.../webhooks/status",  // Read from env
  "stepName": "descriptive_step_name",
  "sequence": 1,
  "totalSteps": 4
}
```

## Status Webhook Payload Format

### Start Status
```json
{
  "taskId": "uuid",
  "status": "running",
  "timestamp": "2025-01-12T10:00:00.000Z",
  "step": "stepName",
  "message": "Starting stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

### End Status
```json
{
  "taskId": "uuid",
  "status": "completed",
  "timestamp": "2025-01-12T10:01:00.000Z",
  "step": "stepName",
  "message": "Completed stepName",
  "sequence": 1,
  "totalSteps": 4,
  "conversationId": "uuid",
  "userId": "uuid"
}
```

## Parameter Passing Pattern

### Pattern: Extract from Webhook → Pass to Helper LLM

```javascript
// 1. Webhook receives these parameters
Webhook Trigger
  ↓
// 2. Extract parameters
Set Node:
  - taskId: $json.body.taskId
  - conversationId: $json.body.conversationId
  - userId: $json.body.userId
  - statusWebhook: $json.body.statusWebhook || process.env.API_BASE_URL + '/webhooks/status'
  - provider: $json.body.provider || 'openai'
  - model: $json.body.model || 'gpt-4'
  ↓
// 3. Call Helper LLM with all parameters
Execute Workflow Node (Helper LLM):
  - workflowId: "9jxl03jCcqg17oOy"
  - Pass ALL parameters via fieldMapping
```

## Minimum Required Set

For workflows that DON'T use Helper LLM or webhook status, parameters are flexible.

For workflows that DO use Helper LLM + webhook status, these are **MANDATORY**:

```javascript
{
  // LLM (one required)
  "prompt": "...",           // OR "userMessage": "..."
  
  // Status Tracking (all required)
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "statusWebhook": "...",   // From env
  "stepName": "...",
  "sequence": 1,
  "totalSteps": 4
}
```

## Parameter Validation Checklist

When creating a workflow that uses Helper LLM:

- [ ] `prompt` OR `userMessage` is provided
- [ ] `taskId` is provided (UUID format)
- [ ] `conversationId` is provided (UUID format)
- [ ] `userId` is provided (UUID format)
- [ ] `statusWebhook` is provided (from environment, not hardcoded)
- [ ] `stepName` is descriptive and unique within workflow
- [ ] `sequence` is 1-based and sequential
- [ ] `totalSteps` matches actual number of steps
- [ ] `sendStartStatus` and `sendEndStatus` are set appropriately
- [ ] `statusWebhook` URL is constructed from environment variables

## Examples

### Example 1: Simple Single-Step Workflow

```javascript
// Webhook receives:
{
  "prompt": "Summarize this article",
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "conversationId": "123e4567-e89b-12d3-a456-426614174001",
  "userId": "123e4567-e89b-12d3-a456-426614174002",
  "statusWebhook": "${API_BASE_URL}/webhooks/status"  // From env
}

// Helper LLM call:
{
  "prompt": $json.body.prompt,
  "taskId": $json.body.taskId,
  "conversationId": $json.body.conversationId,
  "userId": $json.body.userId,
  "statusWebhook": $json.body.statusWebhook,
  "stepName": "summarize",
  "sequence": 1,
  "totalSteps": 1,
  "sendStartStatus": true,
  "sendEndStatus": true
}
```

### Example 2: Multi-Step Parallel Workflow (Marketing Swarm)

```javascript
// Webhook receives:
{
  "announcement": "We're launching a new feature",
  "taskId": "uuid",
  "conversationId": "uuid",
  "userId": "uuid",
  "statusWebhook": "${API_BASE_URL}/webhooks/status"  // From env
}

// Step 1: Web Post
{
  "prompt": "Write web post: " + $json.body.announcement,
  "taskId": $json.body.taskId,
  "conversationId": $json.body.conversationId,
  "userId": $json.body.userId,
  "statusWebhook": $json.body.statusWebhook,
  "stepName": "web_post",
  "sequence": 1,
  "totalSteps": 4,
  "temperature": 0.7,
  "maxTokens": 1000
}

// Step 2: SEO Content
{
  "prompt": "Create SEO content: " + $json.body.announcement,
  "taskId": $json.body.taskId,
  "conversationId": $json.body.conversationId,
  "userId": $json.body.userId,
  "statusWebhook": $json.body.statusWebhook,
  "stepName": "seo_content",
  "sequence": 2,
  "totalSteps": 4,
  "temperature": 0.5,  // Lower for SEO
  "maxTokens": 800
}

// Step 3: Social Media
{
  "prompt": "Create social posts: " + $json.body.announcement,
  "taskId": $json.body.taskId,
  "conversationId": $json.body.conversationId,
  "userId": $json.body.userId,
  "statusWebhook": $json.body.statusWebhook,
  "stepName": "social_media",
  "sequence": 3,
  "totalSteps": 4,
  "temperature": 0.8,  // Higher for creativity
  "maxTokens": 1200
}
```

## Helper LLM Output Format

Helper LLM returns normalized output:

```json
{
  "text": "LLM response content",
  "provider": "openai|ollama|anthropic",
  "model": "actual-model-used",
  "usage": {
    "prompt_tokens": 123,
    "completion_tokens": 456
  }
}
```

All three providers return the SAME format, making it easy to work with results.

