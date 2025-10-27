# Claude Agent Builder - High Level Design

## Overview

A simplified, prompt-driven approach to agent creation and management that leverages the Claude Agent SDK to generate agent configurations from natural language descriptions.

## Core Concept

Instead of manual JSON editing or complex form-based builders, users describe what they want in natural language:

- **Create**: "Create an SEO agent that reports to the marketing manager and outputs JSON"
- **Update**: "Change this agent to report to the CMO instead"
- **Archive**: "Archive this agent"
- **Activate**: "Activate this agent"

The system uses Claude's intelligence to understand requirements and generate proper agent configurations.

## Architecture

### Components

```
Frontend (Web UI)
    ↓
A2A Transport Protocol (/a2a/tasks)
    ↓
Agent Builder Agent (Specialized Coded Agent)
    ↓
Claude Agent SDK (Node.js)
    ↓
JSON File System → Database
```

### Agent Builder Agent

**Type**: Specialized hard-coded agent (not prompt/tool/api-based)

**Location**: `apps/api/src/agents/agent-builder/`

**Transport Compliance**:
- Full A2A TaskRequestDto support
- Streaming support via StreamingService
- Standard response format

**Actions**:
1. **BUILD** - Create new agents from scratch
2. **EDIT** - Update, archive, or activate existing agents

### Technology Stack

**Claude Agent SDK (Node.js)**
- Package: `@anthropic-ai/claude-agent-sdk`
- Method: `query()` function with streaming support
- Why Node SDK vs CLI:
  - Native streaming for real-time progress updates
  - Better error handling
  - No subprocess overhead
  - Async/await compatible with NestJS

## User Flows

### Flow 1: Create New Agent

**Entry Point**: Agent Builder UI Page

```
1. User enters prompt: "Create an SEO agent reporting to marketing-manager, outputs JSON"

2. Frontend calls:
   POST /a2a/tasks
   {
     method: "build",
     params: {
       mode: "build",
       userMessage: "Create an SEO agent...",
       conversationId: "...",
       payload: {
         action: "build"
       }
     }
   }

3. Agent Builder Agent:
   - Receives TaskRequestDto
   - Calls Claude SDK with system prompt + user requirements
   - Claude generates agent configuration JSON
   - Agent writes to /initial-agent-building/working/{slug}.json
   - Agent runs existing load script to update database
   - Streams progress updates via StreamingService

4. Response:
   {
     success: true,
     agentSlug: "seo-agent",
     filePath: "/initial-agent-building/working/seo-agent.json"
   }
```

### Flow 2: Edit Existing Agent

**Entry Point**: Individual Agent's UI Page (Update button/form)

```
1. User on "seo-agent" page enters: "Change this to report to CMO instead"

2. Frontend calls:
   POST /a2a/tasks
   {
     method: "build",
     params: {
       mode: "build",
       userMessage: "Change this to report to CMO instead",
       conversationId: "...",
       payload: {
         action: "edit",
         agentSlug: "seo-agent"
       }
     }
   }

3. Agent Builder Agent:
   - Loads existing agent config from database
   - Calls Claude SDK with current config + edit request
   - Claude generates updated configuration
   - Agent updates JSON file
   - Agent reloads to database
   - Streams progress updates

4. Response:
   {
     success: true,
     agentSlug: "seo-agent",
     changes: ["reporter changed from marketing-manager to cmo"]
   }
```

## File Structure

### Agent Implementation

```
apps/api/src/agents/
  ├── agent-builder/
  │   ├── agent-builder.service.ts       # Main business logic
  │   ├── agent-builder.controller.ts    # A2A endpoint handler
  │   ├── claude-sdk.service.ts          # Claude SDK wrapper
  │   ├── agent-builder.module.ts        # NestJS module
  │   └── templates/
  │       ├── agent-schema.ts            # Agent config schema for Claude
  │       └── system-prompts.ts          # System prompts for build/edit
  │
  ├── image-builder/                     # Future: Image generation agent
  ├── video-builder/                     # Future: Video generation agent
  └── audio-builder/                     # Future: Audio generation agent
```

### Agent Configuration Files

**Storage**: `initial-agent-building/working/`

**Format**: JSON files matching existing structure

**Workflow**:
1. Agent Builder generates/updates JSON file
2. Runs existing load script to sync to database
3. Maintains file-first approach for versioning and debugging

## Key Design Principles

### 1. File-First Approach
- Always write to JSON files first
- Use existing load scripts to update database
- Preserves current workflow and tooling
- Enables version control and manual review

### 2. Specialized Agent
- Not using standard agent types (prompt/tool/api)
- Custom coded implementation
- Full control over Claude SDK integration
- Optimized for agent configuration generation

### 3. Transport Type Compliance
- Implements standard A2A protocol
- Works with existing frontend infrastructure
- Supports streaming for progress updates
- Standard error handling and responses

### 4. Natural Language First
- No forms or manual JSON editing required
- Claude interprets requirements intelligently
- Handles ambiguity and asks for clarification
- Learns from examples in system prompts

### 5. Extensible Architecture
- Same pattern for future hard-coded agents
- Image/video/audio builders follow same structure
- Consistent A2A integration
- Reusable Claude SDK wrapper

## Claude SDK Integration

### System Prompt Strategy

```typescript
const systemPrompt = `You are an agent configuration expert.

Your task is to generate agent configurations based on user requirements.

AGENT SCHEMA:
${agentSchemaDefinition}

EXAMPLES:
${exampleAgentConfigs}

GUIDELINES:
- Generate valid JSON matching the schema
- Use appropriate agent types (prompt/tool/api)
- Set proper execution capabilities
- Include deliverable configuration
- Follow naming conventions

OUTPUT FORMAT:
Return ONLY valid JSON, no explanation or markdown.
`;
```

### Streaming Implementation

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async buildAgent(userPrompt: string) {
  const stream = await query(systemPrompt + "\n\n" + userPrompt);

  for await (const chunk of stream) {
    // Send progress via StreamingService
    this.streamingService.sendProgress(conversationId, {
      type: 'agent_generation',
      content: chunk
    });
  }

  return finalConfig;
}
```

## Database Integration

### Agent Loading Process

1. **Generate JSON** - Claude SDK creates configuration
2. **Write File** - Save to `initial-agent-building/working/{slug}.json`
3. **Validate** - Check schema compliance
4. **Load to DB** - Use existing load script or direct DB insert
5. **Verify** - Confirm agent appears in system

### Existing Scripts Reuse

- Leverage current JSON loading scripts
- No changes to database schema required
- Maintains compatibility with manual agent creation
- Preserves audit trail via file system

## Benefits Over Previous Approach

### Simplification
- ✅ No complex PRD workflows
- ✅ No manual JSON editing
- ✅ No form-based builder UI complexity
- ✅ Single natural language interface

### Flexibility
- ✅ Create any agent type with simple description
- ✅ Update multiple properties in one prompt
- ✅ Archive/activate with simple commands
- ✅ Claude handles ambiguity and edge cases

### Maintainability
- ✅ File-first approach preserved
- ✅ Existing scripts still work
- ✅ Standard A2A integration
- ✅ Isolated specialized agent

### User Experience
- ✅ Fastest way to create agents
- ✅ No learning curve for config format
- ✅ Natural language editing
- ✅ Real-time streaming feedback

## Future Extensions

### Image Builder Agent
- Hard-coded agent for image generation workflows
- Same A2A transport integration
- Specialized for DALL-E, Midjourney, Stable Diffusion orchestration

### Video Builder Agent
- Video generation and editing workflows
- Multi-step video creation pipelines
- A2A compliant, streaming enabled

### Audio Builder Agent
- Audio generation and manipulation
- Music, voice, sound effects
- Same architectural pattern

## Implementation Phases

### Phase 1: Core Agent Builder
- [ ] Install Claude Agent SDK
- [ ] Create agent-builder module structure
- [ ] Implement Claude SDK wrapper service
- [ ] Build agent-builder service with BUILD action
- [ ] Add A2A controller endpoint
- [ ] Integrate StreamingService
- [ ] Test with simple agent creation

### Phase 2: Edit Functionality
- [ ] Add EDIT action support
- [ ] Load existing agent configs
- [ ] Generate update prompts for Claude
- [ ] Handle archive/activate operations
- [ ] Test update scenarios

### Phase 3: Frontend Integration
- [ ] Agent Builder UI page
- [ ] Individual agent edit UI components
- [ ] A2A client integration
- [ ] Streaming progress display
- [ ] Error handling and validation

### Phase 4: Polish & Documentation
- [ ] Add validation and error recovery
- [ ] Create system prompt templates
- [ ] Document agent schema for Claude
- [ ] Add examples and guidelines
- [ ] User documentation

## Open Questions

1. **Schema Definition**: How detailed should the agent schema provided to Claude be?
2. **Validation**: Should validation happen before or after Claude generation?
3. **Rollback**: How to handle failed updates? Keep previous JSON version?
4. **Permissions**: Who can create/edit agents? Role-based access?
5. **Versioning**: Should we maintain version history of agent configs?

## Success Metrics

- **Agent Creation Time**: < 30 seconds from prompt to active agent
- **Edit Accuracy**: Claude correctly interprets 95%+ of edit requests
- **User Satisfaction**: Natural language is preferred over manual editing
- **Error Rate**: < 5% of generated configs require manual fixes
- **Adoption**: 80%+ of new agents created via Claude Agent Builder

## Related Documents

- [[agent-builder-prd]] - Previous extensive PRD approach
- [[high-level]] - Original high-level design
- Agent configuration schema documentation (to be created)
- Claude Agent SDK documentation: https://docs.claude.com/en/api/agent-sdk/overview
