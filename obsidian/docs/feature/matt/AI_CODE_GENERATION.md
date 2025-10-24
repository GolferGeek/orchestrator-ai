# AI Code Generation for Agent Builder

## Overview

The Agent Builder Chat now includes AI-powered code generation. Users can describe what they want a function agent to do in plain language, and the system generates the JavaScript code automatically using GPT-4o-mini.

## Architecture

### Flow

1. **User Input** (Front-end) → API conversation endpoint
2. **Agent Builder Chat** (Function Agent) → Processes user message
3. **Code Generation Request** → `ctx.services.agentBuilder.generateFunctionCode()`
4. **LLM Call** → OpenAI GPT-4o-mini generates JavaScript
5. **Code Validation** → Dry-run execution tests the generated code
6. **Agent Creation** → Code stored in database as draft agent

### Components

#### AgentBuilderService ([agent-builder.service.ts](../../apps/api/src/agent-platform/services/agent-builder.service.ts))

**New Method:**
```typescript
async generateFunctionCode(
  description: string,
  inputModes: string[],
  outputModes: string[],
): Promise<{ code: string; error?: string }>
```

**Features:**
- Uses GPT-4o-mini for cost-effective code generation
- Temperature: 0.3 (focused, deterministic output)
- Instructs LLM on function signature: `async function handler(input, ctx)`
- Includes IO contract in prompt (input/output modes)
- References available services (`ctx.services.images.generate()`)
- Strips markdown code fences from response
- Error handling with graceful fallback

#### Agent Builder Chat ([agent_builder_chat.json](./payloads/agent_builder_chat.json))

**Updated Flow:**
1. **collect_intent** - Determine agent type
2. **collect_basic_info** - Get slug, name, description
3. **collect_io** - Extract input/output modes
4. **collect_config** - For function agents:
   - Ask for natural language description
   - Call `ctx.services.agentBuilder.generateFunctionCode()`
   - Store generated code in config
5. **validate** - Run validation + dry-run on generated code
6. **confirm** - Show code preview to user
7. **create** - Create agent with generated code

**Example Interaction:**

```
Agent: What should this function do?

User: Take the input text, count the words, and return the count as JSON

Agent: ✨ Code generated! Validating now...

Agent: ✅ Validation Successful!

Generated Code Preview:
```javascript
async function handler(input, ctx) {
  if (!input || !input.text) {
    throw new Error('Missing required input.text');
  }

  const wordCount = input.text.split(/\s+/).length;

  return {
    count: wordCount,
    text: `Word count: ${wordCount}`
  };
}
```

Ready to create? (yes/no)
```

## Testing

### Unit Tests ([agent-builder-code-gen.spec.ts](../../apps/api/src/agent-platform/services/agent-builder-code-gen.spec.ts))

**7 tests covering:**
- ✅ Code generation from description
- ✅ LLM service parameters
- ✅ Markdown fence removal
- ✅ Error handling
- ✅ IO modes in prompt
- ✅ Service context examples

### Smoke Tests ([agent-seed-smoke.spec.ts](../../apps/api/src/agent-platform/services/agent-seed-smoke.spec.ts))

**Validates:**
- ✅ Agent Builder Chat payload structure
- ✅ Function code syntax
- ✅ Policy compliance

## Usage

### Via Chat (Recommended)

1. Start conversation: "Create a function agent"
2. Provide slug, name, description
3. Specify input/output modes
4. **Describe functionality in plain language** (AI generates code)
5. Review generated code preview
6. Confirm creation

### Via API

```bash
curl -X POST http://localhost:7100/api/admin/agents \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "word_counter",
    "display_name": "Word Counter",
    "agent_type": "function",
    "mode_profile": "draft",
    "yaml": "input_modes: [\"text/plain\"]\noutput_modes: [\"application/json\"]\n",
    "config": {
      "configuration": {
        "function": {
          "timeout_ms": 10000,
          "code": "<GENERATED_CODE>"
        }
      }
    }
  }'
```

### Via Seed Script

```bash
# Add your agent payload with AI-generated code
./apps/api/scripts/seed-agents.sh
```

## System Prompt Engineering

The code generation prompt includes:

1. **Role Definition:** "JavaScript code generator for function agents"
2. **Output Format:** "Return ONLY JavaScript code - no markdown, no explanations"
3. **Function Signature:** `async function handler(input, ctx)`
4. **IO Contract:** Input/output modes from user specification
5. **Service Context:** Examples of available services (images, etc.)
6. **Best Practices:** Input validation, error handling, concise code

## LLM Configuration

**Provider:** OpenAI
**Model:** gpt-4o-mini
**Temperature:** 0.3 (focused, less creative)
**Max Tokens:** 2000
**Caller:** `agent-builder-code-gen`

## Security & Validation

1. **Code Sandbox:** Generated code runs in VM with 10s timeout
2. **Dry-Run Validation:** Code tested before storage
3. **Policy Checks:** Timeout limits (≤30s), IO contracts verified
4. **Draft Status:** All generated agents start as `draft`
5. **Input Sanitization:** LLM responses stripped of markdown/formatting

## Benefits

### For Users
- **No coding required** for function agents
- **Natural language** interface
- **Instant feedback** with code preview
- **Safe iteration** with validation before creation

### For System
- **Consistent code structure** via LLM prompts
- **Reduced errors** from manual coding
- **Scalable agent creation** for non-technical users
- **Built-in best practices** (validation, error handling)

## Future Enhancements

- [ ] Multi-turn refinement (user edits generated code via chat)
- [ ] Code explanation generation
- [ ] Support for more complex service integrations
- [ ] Template-based generation for common patterns
- [ ] A/B testing of different LLM prompts
- [ ] Code optimization suggestions

## Files Modified

1. `apps/api/src/agent-platform/services/agent-builder.service.ts` - Added `generateFunctionCode()` method
2. `docs/feature/matt/payloads/agent_builder_chat.json` - Updated to use AI code generation
3. `apps/api/src/agent-platform/services/agent-builder-code-gen.spec.ts` - New test suite

## Dependencies

- **LLMService:** Already integrated in AgentPlatformModule
- **OpenAI API Key:** Required for code generation
- **GPT-4o-mini:** Cost-effective model for code generation

## Related Documentation

- [Agent Builder Plan](./agent-builder-plan.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Agent Builder Chat Guide](./AGENT_BUILDER_CHAT_GUIDE.md)
