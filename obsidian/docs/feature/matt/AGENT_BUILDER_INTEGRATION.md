# Agent Builder Chat - Vue Frontend Integration Guide

## Overview

The `agent_builder_chat` is a **function agent** that runs server-side and integrates seamlessly with your existing Vue conversation UI. **No React components needed** - it uses your existing conversation infrastructure.

## How It Works

### Architecture

```
Vue Frontend (existing)
    ↓ HTTP POST
Agent-to-Agent API (/agents/my-org/agent_builder_chat/tasks)
    ↓ Execute
Function Agent Runner (server-side VM)
    ↓ Access
AgentBuilderService (validation, LLM code gen, creation)
    ↓ Return
Response with content + state
    ↓ Display
Vue Frontend (renders markdown/json)
```

### Key Points

1. **Server-Side Execution** - The agent runs in a Node.js VM sandbox on the API server
2. **Stateless HTTP** - Each request is independent, state passed in payload
3. **Existing UI Works** - Your Vue conversation component handles all rendering
4. **No New Components** - Agent returns markdown text that your UI already displays

## API Contract

### Request Format

**Endpoint:** `POST /agents/:orgSlug/:agentSlug/tasks`

**Agent Slug:** `agent_builder_chat`

**Request Body:**
```json
{
  "mode": "converse",
  "conversationId": "uuid-here",
  "userMessage": "Create a function agent that counts words",
  "payload": {
    "conversationState": {
      "step": "collect_intent",
      "agentConfig": {},
      "needsInfo": []
    }
  },
  "metadata": {
    "userId": "user-uuid"
  }
}
```

### Response Format

**Success Response:**
```json
{
  "mode": "converse",
  "ok": true,
  "content": {
    "format": "text/markdown",
    "content": "Perfect! A **function agent**! ✨\n\nNow give it an identity:\n- **Slug** (e.g., article_summarizer)\n- **Display Name** (e.g., Article Summarizer)",
    "state": {
      "step": "collect_basic_info",
      "agentConfig": {
        "agent_type": "function",
        "purpose": "counts words"
      }
    }
  }
}
```

**On Agent Creation:**
```json
{
  "mode": "converse",
  "ok": true,
  "content": {
    "format": "application/json",
    "content": {
      "success": true,
      "message": "🎉 Success! Agent **Word Counter** created!\n\n**Agent ID:** agent-123\n**Status:** draft",
      "agentId": "agent-123",
      "agentSlug": "word_counter"
    },
    "state": {
      "step": "complete",
      "agentId": "agent-123"
    }
  }
}
```

## State Management

### Client-Side State Persistence

Your Vue frontend must:

1. **Store state from response** - Extract `response.content.state`
2. **Pass state on next request** - Include as `payload.conversationState`
3. **Handle initial request** - Pass empty/null state for first message

### Example Vue Implementation

```javascript
// In your conversation component

export default {
  data() {
    return {
      messages: [],
      conversationState: null,  // Stores builder state between turns
      conversationId: null
    }
  },

  methods: {
    async sendMessage(userMessage) {
      // Build request
      const request = {
        mode: 'converse',
        conversationId: this.conversationId,
        userMessage: userMessage,
        payload: {
          conversationState: this.conversationState || {
            step: 'welcome',
            agentConfig: {},
            needsInfo: []
          }
        },
        metadata: {
          userId: this.$store.state.user.id
        }
      };

      // Send to agent
      const response = await this.$api.post(
        `/agents/my-org/agent_builder_chat/tasks`,
        request
      );

      // Extract response
      const { content } = response.data;

      // Update conversation state for next turn
      if (content.state) {
        this.conversationState = content.state;
      }

      // Display message in UI
      this.messages.push({
        role: 'assistant',
        content: content.content,
        format: content.format
      });

      // If agent created successfully
      if (content.content.agentId) {
        this.$emit('agent-created', {
          id: content.content.agentId,
          slug: content.content.agentSlug
        });
      }
    }
  }
}
```

## Conversation Flow

### Step-by-Step Example

**Turn 1: User starts conversation**
```
User: "Create a function agent"

Request:
{
  "userMessage": "Create a function agent",
  "payload": { "conversationState": null }
}

Response:
{
  "content": "# Welcome to Agent Builder! 🤖\n\nWhat would you like to build?",
  "state": { "step": "collect_intent" }
}
```

**Turn 2: User provides intent**
```
User: "I want a function agent that counts words"

Request:
{
  "userMessage": "I want a function agent that counts words",
  "payload": {
    "conversationState": { "step": "collect_intent" }
  }
}

Response:
{
  "content": "Perfect! A **function agent**! ✨\n\nNow give it an identity...",
  "state": {
    "step": "collect_basic_info",
    "agentConfig": {
      "agent_type": "function",
      "purpose": "counts words"
    }
  }
}
```

**Turn 3: User provides slug/name**
```
User: "slug: word_counter, name: Word Counter"

Request:
{
  "userMessage": "slug: word_counter, name: Word Counter",
  "payload": {
    "conversationState": {
      "step": "collect_basic_info",
      "agentConfig": { "agent_type": "function", "purpose": "counts words" }
    }
  }
}

Response:
{
  "content": "Great!\n- **Slug:** word_counter\n- **Name:** Word Counter\n\n**What input/output formats?**",
  "state": {
    "step": "collect_io",
    "agentConfig": {
      "agent_type": "function",
      "slug": "word_counter",
      "display_name": "Word Counter"
    }
  }
}
```

**... continues through IO modes, code generation, validation, creation ...**

## Testing Without UI

### Using cURL

```bash
# 1. Create conversation
CONV_ID=$(uuidgen)

# 2. Start conversation
curl -X POST http://localhost:7100/agents/my-org/agent_builder_chat/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "converse",
    "conversationId": "'$CONV_ID'",
    "userMessage": "Create a function agent",
    "payload": {
      "conversationState": null
    },
    "metadata": {
      "userId": "test-user"
    }
  }'

# 3. Continue conversation (copy state from previous response)
curl -X POST http://localhost:7100/agents/my-org/agent_builder_chat/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "converse",
    "conversationId": "'$CONV_ID'",
    "userMessage": "I want a function agent that counts words",
    "payload": {
      "conversationState": {
        "step": "collect_intent"
      }
    },
    "metadata": {
      "userId": "test-user"
    }
  }'
```

### Using Node.js Script

```javascript
const axios = require('axios');

async function testAgentBuilder() {
  const conversationId = 'test-conv-123';
  let conversationState = null;

  const sendMessage = async (userMessage) => {
    const response = await axios.post(
      'http://localhost:7100/agents/my-org/agent_builder_chat/tasks',
      {
        mode: 'converse',
        conversationId,
        userMessage,
        payload: { conversationState },
        metadata: { userId: 'test-user' }
      }
    );

    console.log('\n--- Agent Response ---');
    console.log(response.data.content.content);
    console.log('\n--- State ---');
    console.log(JSON.stringify(response.data.content.state, null, 2));

    // Update state for next turn
    conversationState = response.data.content.state;

    return response.data;
  };

  // Run conversation
  await sendMessage('Create a function agent');
  await sendMessage('I want one that counts words');
  await sendMessage('slug: word_counter, name: Word Counter');
  await sendMessage('JSON input, JSON output');
  await sendMessage('Count the words in the input text and return the count');
  // ... wait for code generation, validation ...
  await sendMessage('yes'); // Confirm creation
}

testAgentBuilder();
```

## Deployment Checklist

### 1. Seed the Agent

```bash
cd apps/api
./scripts/seed-agents.sh
```

Or manually:

```bash
curl -X POST http://localhost:7100/api/admin/agents \
  -H "Content-Type: application/json" \
  -d @docs/feature/matt/payloads/agent_builder_chat.json
```

### 2. Verify Agent is Active

```bash
curl http://localhost:7100/agents/my-org/agent_builder_chat/.well-known/agent.json
```

Expected: Agent card with `status: "active"`

### 3. Test Conversation Flow

Use cURL or Node.js script (see above) to verify:
- ✅ State persistence works
- ✅ Code generation returns valid JavaScript
- ✅ Validation catches errors
- ✅ Agent creation succeeds

### 4. Vue Frontend Changes

**Minimal changes needed:**

1. **Add conversationState to component data**
```javascript
data() {
  return {
    conversationState: null  // New: track builder state
  }
}
```

2. **Pass state in requests**
```javascript
payload: {
  conversationState: this.conversationState
}
```

3. **Update state from responses**
```javascript
if (response.content.state) {
  this.conversationState = response.content.state;
}
```

4. **Handle agent creation event**
```javascript
if (response.content.content.agentId) {
  // Navigate to agent details or show success message
}
```

That's it! Your existing markdown rendering, message history, and UI components work as-is.

## Troubleshooting

### State Not Persisting

**Symptom:** Agent asks the same question repeatedly

**Cause:** Frontend not passing `conversationState` from previous response

**Fix:** Ensure you extract and store `response.content.state` and pass it as `payload.conversationState` on next request

### Code Generation Fails

**Symptom:** "Code generation failed" error

**Causes:**
1. LLM service (OpenAI) not configured
2. API key missing/invalid
3. Network issues

**Fix:** Check `.env` for `OPENAI_API_KEY` and verify LLM service is running

### Validation Errors

**Symptom:** Agent says "Validation Issues" but code looks correct

**Causes:**
1. Generated code missing required structure
2. Policy violations (timeout > 30s, missing IO modes)
3. Dry-run execution failed

**Fix:** Check validation details in response, regenerate code with different description

### Agent Not Found

**Symptom:** 404 when calling `/agents/my-org/agent_builder_chat/tasks`

**Cause:** Agent not seeded or wrong organization slug

**Fix:** Run seed script or check agent exists with correct slug

## Performance Considerations

### Code Generation Latency

- **Typical:** 2-5 seconds
- **Max:** 15 seconds (function timeout)

Your Vue UI should show a loading indicator during code generation step.

### State Size

- **Typical:** < 5KB per conversation
- **Max:** ~50KB (large generated code)

State is passed in each request, so keep it minimal. Don't store unnecessary data.

### Rate Limiting

Recommended limits:
- **10 code generations per minute per user**
- **100 validation requests per minute per org**

Prevents LLM API abuse and cost overruns.

## Next Steps

1. ✅ **Agent is ready** - Already seeded and tested
2. ⏳ **Update Vue frontend** - Add state management (3 lines of code)
3. ⏳ **Test end-to-end** - Create an agent through UI
4. ⏳ **Add rate limiting** - Protect LLM endpoints
5. ⏳ **Monitor costs** - Track OpenAI token usage

## Related Documentation

- [AI Code Generation](./AI_CODE_GENERATION.md) - How LLM code gen works
- [Agent Builder Chat Guide](./AGENT_BUILDER_CHAT_GUIDE.md) - User-facing guide
- [Promotion Workflow](./AGENT_PROMOTION_WORKFLOW.md) - Draft → Active lifecycle

---

**TL;DR:** Your Vue conversation UI already works with this agent. Just pass `conversationState` between turns. No new components needed.
