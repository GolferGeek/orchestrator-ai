# Agent Builder Chat - Conversational Agent Creation

**Agent:** `agent_builder_chat`
**Type:** Function Agent (Conversational)
**Status:** Ready to use

## Overview

The Agent Builder Chat is a conversational agent that guides you through creating new agents via natural language dialog. Instead of filling out forms or writing JSON, you simply chat with it and answer questions.

## How to Use

### Starting a Conversation

Simply message the agent:

```
"Create an agent"
```

Or be more specific:

```
"I want to create a function agent that processes documents"
```

### The Conversation Flow

The agent will guide you through 7 steps:

#### 1. **Agent Type & Intent**
The agent asks what you want to build.

**Example:**
```
You: "I want a function agent that processes documents"

Agent: "Perfect! A function agent - I love it! ✨
Now, let's give it an identity:
1. Slug (lowercase identifier, e.g., document_processor)
2. Display Name (friendly name, e.g., "Document Processor")
3. Description (optional - what does it do?)"
```

#### 2. **Basic Information**
Provide slug, display name, and description.

**Example:**
```
You: "slug: doc_processor, name: Document Processor, description: Processes PDF documents"

Agent: "Great! I've got:
- Slug: doc_processor
- Name: Document Processor
- Description: Processes PDF documents

Now, what input and output formats will this agent use?"
```

#### 3. **Input/Output Modes**
Specify what formats the agent accepts and produces.

**Example:**
```
You: "Accepts JSON, outputs Markdown"

Agent: "Perfect! ✅
Now I need the function configuration:
1. Timeout (in milliseconds, max 30000) - How long should it run?
2. Code - The JavaScript function that will execute"
```

#### 4. **Agent-Specific Configuration**

**For Function Agents:**
```
You: "Timeout: 5000, Code: module.exports = async (input) => ({ ok: true, content: input.text })"
```

**For Context Agents:**
```
You: "You are a helpful customer service agent. Answer questions politely about our products."
```

**For API Agents:**
```
You: "endpoint: https://api.weather.com/data, method: GET"
```

#### 5. **Validation**
The agent automatically validates your configuration.

**Example:**
```
Agent: "Excellent! 🎉 I have everything I need.
Let me validate this configuration..."

[Automatic validation runs]

Agent: "✅ Validation Successful!

Agent Details:
- Type: function
- Slug: doc_processor
- Name: Document Processor
- Input: application/json
- Output: text/markdown

Validation Results:
✅ Schema validation passed
✅ Policy checks passed
✅ Dry-run: PASSED

Ready to create this agent? (Reply 'yes' to create or 'no' to cancel)"
```

#### 6. **Confirmation**
Review and approve the agent.

**Example:**
```
You: "yes"

Agent: "🚀 Creating your agent now..."
```

#### 7. **Creation**
The agent is created and you get the details.

**Example:**
```
Agent: "🎉 Success! Agent Document Processor created!

Agent ID: 550e8400-e29b-41d4-a716-446655440000
Status: draft (ready for testing)

You can now find this agent in your agent list.
Would you like to create another agent?"
```

## Supported Agent Types

### 1. Function Agents
Execute custom JavaScript code.

**What you need:**
- Timeout (milliseconds, ≤30000)
- JavaScript code (module.exports = async function)

**Example:**
```javascript
module.exports = async (input, ctx) => {
  return {
    ok: true,
    format: 'text/markdown',
    content: `Processed: ${input.text}`
  };
}
```

### 2. Context Agents
Conversational agents with custom instructions.

**What you need:**
- System prompt (instructions for the agent)

**Example:**
```
"You are a friendly HR assistant. Help employees with questions about benefits,
payroll, and company policies. Be concise and professional."
```

### 3. API Agents
Call external APIs.

**What you need:**
- Endpoint URL
- HTTP method (GET, POST, etc.)

**Example:**
```
endpoint: https://api.example.com/data
method: POST
```

## Natural Language Tips

The agent understands various phrasings:

### For Agent Type:
- "function agent"
- "context agent that..."
- "API agent to..."
- "conversational agent"

### For I/O Modes:
- "JSON input, markdown output"
- "Takes text/plain, returns application/json"
- "application/json → text/markdown"
- "Accepts JSON and outputs markdown"

### For Confirmation:
- "yes" / "Yes" / "YES"
- "create it"
- "proceed"
- "go ahead"

### For Cancellation:
- "no" / "No"
- "cancel"
- "stop"
- "nevermind"

## Example Conversations

### Quick Function Agent

```
You: "Create a function agent"
Agent: [Welcome message]

You: "I want to build a text formatter"
Agent: [Asks for basic info]

You: "slug: text_formatter, name: Text Formatter"
Agent: [Asks for I/O]

You: "JSON input, markdown output"
Agent: [Asks for function config]

You: "Timeout: 3000, Code: module.exports = async (input) => ({ ok: true, content: input.text.toUpperCase() })"
Agent: [Validates]

Agent: "✅ Validation successful! Ready to create?"

You: "yes"
Agent: "🎉 Created! Agent ID: ..."
```

### Context Agent for Support

```
You: "I need a context agent for customer support"
Agent: [Collects info]

You: "slug: support_bot, name: Support Bot, description: Helps customers"
Agent: [Asks for I/O]

You: "text/plain in, markdown out"
Agent: [Asks for system prompt]

You: "You are a helpful customer support agent. Answer questions about our products with patience and clarity. If you don't know something, say so and offer to connect them with a specialist."
Agent: [Validates and creates]
```

## Error Handling

If validation fails, the agent provides clear feedback:

```
Agent: "❌ Validation Issues Found

❌ Function agents should set timeout_ms
❌ timeout_ms should be <= 30000ms per policy

Would you like to fix these issues? (Reply 'yes' to go back or 'no' to cancel)"

You: "yes"
Agent: [Returns to the relevant step]
```

## Integration with Existing System

The chat agent uses the same backend services as the API:
- ✅ Real `AgentValidationService` for validation
- ✅ Real `AgentPolicyService` for policy checks
- ✅ Real agent creation via `AgentBuilderService`
- ✅ All agents created with `status='draft'`

## Testing the Agent

### Via Chat UI
1. Start a conversation with `agent_builder_chat`
2. Follow the prompts
3. The agent will guide you through each step

### Via API (for testing)
```bash
curl -X POST http://localhost:7100/api/agents/my-org/agent_builder_chat/task \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "converse",
    "userMessage": "I want to create a function agent",
    "conversationId": "test-123",
    "sessionId": "session-456"
  }'
```

## Advantages

### vs Traditional UI Forms
- ✅ More natural and conversational
- ✅ No complex forms to fill out
- ✅ Guides you step-by-step
- ✅ Validates as you go
- ✅ Easy to fix mistakes

### vs Direct API
- ✅ No need to know JSON structure
- ✅ No need to remember field names
- ✅ Validation happens automatically
- ✅ Clear error messages in plain language

### vs Manual Configuration
- ✅ Enforces best practices
- ✅ Prevents common mistakes
- ✅ Ensures all required fields are provided
- ✅ Real-time feedback

## Next Steps After Creation

Once an agent is created with `status='draft'`:

1. **Test It** - Try using the agent in a conversation
2. **Review It** - Check the agent configuration
3. **Refine It** - Make adjustments if needed
4. **Promote It** - Change status to 'active' when ready (future feature)

## Troubleshooting

### "I can't find the agent in my list"
- Agents are created with `status='draft'`
- Filter by draft status in the agent list
- Check the organization slug matches

### "Validation keeps failing"
- Function timeout must be ≤ 30000ms
- Code must be valid JavaScript
- Input/output modes are required
- Context agents need a system prompt

### "The agent doesn't understand my input"
- Be specific about agent type (function/context/api)
- Use clear format for slug: `my_agent_name`
- Provide modes clearly: "JSON input, markdown output"

## File Location

**Payload:** `docs/feature/matt/payloads/agent_builder_chat.json`
**Tests:** `apps/api/src/agent-platform/services/agent-seed-smoke.spec.ts`

## Related Documentation

- [Agent Builder Plan](./agent-builder-plan.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Agent Authoring Standards](../agent-types/AUTHORING-STANDARDS.md)
