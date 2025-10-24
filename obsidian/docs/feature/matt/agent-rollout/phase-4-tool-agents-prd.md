# Phase 4: Tool Agents - PRD

## Overview

**Goal**: Build agent workflows that leverage MCP (Model Context Protocol) tools to perform specialized tasks. Start with Supabase MCP for database operations and investigate Obsidian MCP for knowledge base management.

**Success Criteria**:
- Supabase Tool Agent can execute database queries and return structured results
- Investigation complete on Obsidian MCP for managing /obsidian folder
- Tool agents can be composed into orchestrations (foundation for Phase 6)
- Clear patterns established for adding new MCP-based tool agents

## Phase Dependencies

**Depends On**:
- ✅ Phase 0: Aggressive Cleanup (workspace organized)
- ✅ Phase 1: Context Agents (conversation infrastructure, mode-based routing)

**Enables**:
- Phase 5: Agent Builder (UI to configure tool agents)
- Phase 6: Orchestration Examples (Finance Manager using Supabase agent)

## Background

Tool agents are specialized agents that wrap MCP tools to provide structured, conversational interfaces to external systems. Unlike general-purpose agents, tool agents:

1. **Single Responsibility**: Focus on one tool/system (e.g., Supabase, Obsidian)
2. **Structured Output**: Return data in predictable formats for composition
3. **Orchestration-Ready**: Designed to be called by orchestrator agents
4. **Error Handling**: Graceful failures with actionable error messages

## MCP Tools to Implement

### 1. Supabase MCP Tool Agent

**Purpose**: Execute database queries, retrieve metrics, manage data

**Capabilities**:
- Execute SELECT queries with filters
- Aggregate data (COUNT, SUM, AVG, GROUP BY)
- Join tables for complex queries
- Return results as JSON for downstream processing

**Example Use Cases**:
```typescript
// Query conversations by date range
const conversations = await supabaseAgent.query({
  table: 'agent_conversations',
  filters: { created_at: { gte: '2025-01-01' } },
  orderBy: { created_at: 'desc' }
});

// Aggregate metrics
const metrics = await supabaseAgent.aggregate({
  table: 'agent_tasks',
  groupBy: ['agent_name', 'status'],
  aggregates: { count: '*' }
});
```

**Integration**:
- Uses existing Supabase MCP server
- Wraps MCP calls in AgentRuntimeService
- Returns structured AgentResult with data payload

### 2. Obsidian MCP Tool Agent (Investigation)

**Purpose**: Manage markdown files in /obsidian folder as knowledge base

**Investigation Goals**:
- Can Obsidian MCP read/write files in specific folder?
- Can it search across notes by tags, frontmatter, content?
- Can it create bidirectional links between notes?
- Can it be used for agent-generated documentation?

**Potential Use Cases**:
```typescript
// Create agent documentation
await obsidianAgent.createNote({
  path: '/obsidian/agents/finance-manager.md',
  content: `# Finance Manager Agent\n\n## Purpose\n...`,
  tags: ['agent', 'orchestration', 'finance']
});

// Search knowledge base
const relatedNotes = await obsidianAgent.search({
  query: 'metrics dashboard',
  tags: ['agent', 'metrics']
});

// Link notes
await obsidianAgent.link({
  from: '/obsidian/agents/finance-manager.md',
  to: '/obsidian/agents/supabase-metrics.md',
  context: 'Uses for data retrieval'
});
```

**Decision Point**:
- ✅ If Obsidian MCP works → Build agent in Phase 4
- ❌ If limited functionality → Defer to later phase or use file system MCP

## Technical Implementation

### 1. MCP Integration Architecture

```typescript
// New: MCP Tool Adapter Pattern
interface MCPToolAdapter<TInput, TOutput> {
  toolName: string;
  mcpServer: string;

  // Convert agent input to MCP tool parameters
  prepareInput(agentInput: TInput): MCPToolParams;

  // Execute MCP tool call
  execute(params: MCPToolParams): Promise<MCPResult>;

  // Convert MCP result to agent output
  formatOutput(mcpResult: MCPResult): TOutput;

  // Error handling
  handleError(error: MCPError): AgentError;
}

// Supabase Tool Adapter
@Injectable()
export class SupabaseMCPAdapter implements MCPToolAdapter<QueryInput, QueryResult> {
  constructor(
    private readonly mcpClient: MCPClientService,
    private readonly logger: Logger
  ) {}

  async execute(input: QueryInput): Promise<QueryResult> {
    try {
      const params = this.prepareInput(input);
      const mcpResult = await this.mcpClient.callTool('supabase', 'query', params);
      return this.formatOutput(mcpResult);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  prepareInput(input: QueryInput): MCPToolParams {
    return {
      sql: this.buildSQL(input),
      parameters: input.filters || {}
    };
  }

  formatOutput(mcpResult: MCPResult): QueryResult {
    return {
      success: true,
      data: mcpResult.rows,
      rowCount: mcpResult.rows.length,
      executedAt: new Date().toISOString()
    };
  }
}
```

### 2. Tool Agent Configuration

```typescript
// apps/api/src/config/tool-agents.config.ts
export const TOOL_AGENTS = {
  'supabase-query': {
    name: 'supabase-query',
    namespace: 'system',
    type: 'tool',
    mcpServer: 'supabase',
    mcpTool: 'query',
    adapter: SupabaseMCPAdapter,
    config: {
      maxQueryComplexity: 100,
      timeout: 30000,
      allowedTables: ['agent_conversations', 'agent_tasks', 'deliverables', 'plans']
    }
  },

  'obsidian-notes': {
    name: 'obsidian-notes',
    namespace: 'system',
    type: 'tool',
    mcpServer: 'obsidian',
    mcpTool: 'manage_notes',
    adapter: ObsidianMCPAdapter,
    config: {
      basePath: '/obsidian',
      allowedOperations: ['read', 'write', 'search', 'link'],
      maxFileSize: 1024 * 1024 // 1MB
    }
  }
};
```

### 3. Tool Agent Runtime

```typescript
// apps/api/src/agent-runtime/tool-agent-runtime.service.ts
@Injectable()
export class ToolAgentRuntimeService {
  constructor(
    private readonly mcpClient: MCPClientService,
    private readonly adapters: Map<string, MCPToolAdapter>
  ) {}

  async execute(agentName: string, input: unknown): Promise<AgentResult> {
    const config = TOOL_AGENTS[agentName];
    if (!config) {
      throw new Error(`Unknown tool agent: ${agentName}`);
    }

    const adapter = this.adapters.get(agentName);
    if (!adapter) {
      throw new Error(`No adapter for tool agent: ${agentName}`);
    }

    // Execute tool through adapter
    const result = await adapter.execute(input);

    return {
      status: 'completed',
      output: result,
      metadata: {
        agentName,
        toolName: config.mcpTool,
        executedAt: new Date().toISOString()
      }
    };
  }
}
```

### 4. Integration with Tasks API

```typescript
// Tool agents accessible via mode='tool'
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'tool',
  toolAgent: 'supabase-query',
  input: {
    table: 'agent_tasks',
    filters: { status: 'completed' },
    aggregates: { count: '*' }
  }
}

// Backend routing
switch (mode) {
  case 'plan':   → PlansAdapter
  case 'build':  → DeliverablesAdapter
  case 'tool':   → ToolAgentRuntimeService  // NEW
  case 'converse': → No artifacts
}
```

## Database Schema

### Tool Agent Execution Log

```sql
-- Track tool agent executions for debugging and metrics
CREATE TABLE tool_agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  task_id UUID NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  status VARCHAR(50) NOT NULL, -- 'success', 'error', 'timeout'
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_tool_executions_conversation ON tool_agent_executions(conversation_id);
CREATE INDEX idx_tool_executions_agent ON tool_agent_executions(agent_name);
CREATE INDEX idx_tool_executions_created ON tool_agent_executions(created_at DESC);
```

## Obsidian MCP Investigation Tasks

### Research Questions

1. **File Operations**:
   - [ ] Can Obsidian MCP read files from specific folder path?
   - [ ] Can it write new files to /obsidian folder?
   - [ ] Can it update existing files (edit, append)?
   - [ ] Does it handle frontmatter (YAML metadata)?

2. **Search Capabilities**:
   - [ ] Can it search by content (full-text)?
   - [ ] Can it filter by tags?
   - [ ] Can it query frontmatter fields?
   - [ ] Does it support regex/advanced queries?

3. **Linking & Graph**:
   - [ ] Can it create [[wikilinks]] between notes?
   - [ ] Can it traverse note graph (get backlinks)?
   - [ ] Can it create folder structure?
   - [ ] Does it support aliases and redirects?

4. **Performance & Limits**:
   - [ ] What's max file size it can handle?
   - [ ] How many files can it search efficiently?
   - [ ] Does it support streaming for large results?
   - [ ] Are there rate limits or quotas?

### Investigation Approach

```typescript
// Test script: apps/api/scripts/test-obsidian-mcp.ts
import { MCPClientService } from '../src/mcp/mcp-client.service';

async function investigateObsidianMCP() {
  const client = new MCPClientService();

  // Test 1: List available tools
  const tools = await client.listTools('obsidian');
  console.log('Available Obsidian tools:', tools);

  // Test 2: Read file
  try {
    const file = await client.callTool('obsidian', 'read_file', {
      path: '/obsidian/test.md'
    });
    console.log('✅ Can read files:', file);
  } catch (error) {
    console.log('❌ Cannot read files:', error.message);
  }

  // Test 3: Write file
  try {
    await client.callTool('obsidian', 'write_file', {
      path: '/obsidian/agent-test.md',
      content: '# Test Note\n\nCreated by MCP test'
    });
    console.log('✅ Can write files');
  } catch (error) {
    console.log('❌ Cannot write files:', error.message);
  }

  // Test 4: Search
  try {
    const results = await client.callTool('obsidian', 'search', {
      query: 'agent',
      path: '/obsidian'
    });
    console.log('✅ Can search:', results.length, 'results');
  } catch (error) {
    console.log('❌ Cannot search:', error.message);
  }

  // Test 5: Create link
  try {
    await client.callTool('obsidian', 'create_link', {
      from: '/obsidian/agent-test.md',
      to: '/obsidian/test.md'
    });
    console.log('✅ Can create links');
  } catch (error) {
    console.log('❌ Cannot create links:', error.message);
  }
}
```

## Success Metrics

### Phase 4 Completion Criteria

1. **Supabase Tool Agent**:
   - [ ] Can execute SELECT queries with filters
   - [ ] Can aggregate data (COUNT, SUM, AVG, GROUP BY)
   - [ ] Returns structured JSON results
   - [ ] Handles errors gracefully
   - [ ] Logs executions to tool_agent_executions table

2. **Obsidian Investigation**:
   - [ ] All research questions answered
   - [ ] Test script results documented
   - [ ] Decision made: build agent or defer
   - [ ] If building: adapter implemented and tested

3. **Architecture**:
   - [ ] MCPToolAdapter pattern established
   - [ ] ToolAgentRuntimeService integrated with Tasks API
   - [ ] Tool agent config system in place
   - [ ] Documentation for adding new tool agents

4. **Testing**:
   - [ ] Unit tests for adapters
   - [ ] Integration tests for tool agent runtime
   - [ ] End-to-end test: conversation → tool agent → result
   - [ ] Performance test: 100 queries under 5 seconds

## Example: Supabase Metrics Query

```typescript
// Frontend request
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'tool',
  toolAgent: 'supabase-query',
  input: {
    description: 'Get task completion metrics by agent for last 30 days',
    query: {
      table: 'agent_tasks',
      filters: {
        status: 'completed',
        created_at: { gte: '2025-09-04' }
      },
      groupBy: ['agent_name'],
      aggregates: {
        total: { count: '*' },
        avg_duration: { avg: 'execution_time_ms' }
      },
      orderBy: { total: 'desc' }
    }
  }
}

// Supabase adapter executes:
SELECT
  agent_name,
  COUNT(*) as total,
  AVG(execution_time_ms) as avg_duration
FROM agent_tasks
WHERE status = 'completed'
  AND created_at >= '2025-09-04'
GROUP BY agent_name
ORDER BY total DESC;

// Returns:
{
  status: 'completed',
  output: {
    success: true,
    data: [
      { agent_name: 'blog-writer', total: 142, avg_duration: 3421 },
      { agent_name: 'code-reviewer', total: 89, avg_duration: 2156 },
      { agent_name: 'research-agent', total: 67, avg_duration: 5234 }
    ],
    rowCount: 3,
    executedAt: '2025-10-04T20:15:00Z'
  }
}
```

## Next Steps After Phase 4

With tool agents in place, we can:

1. **Phase 5 - Agent Builder**: UI to configure tool agents, test queries, preview results
2. **Phase 6 - Orchestration Examples**: Finance Manager orchestrator that uses Supabase agent
3. **Future Phases**: Add more MCP tool agents (GitHub, Slack, Calendar, etc.)

## Open Questions

1. Should tool agents be created via UI or config files only?
2. How do we handle tool agent versioning (config changes)?
3. Should tool agents support streaming responses?
4. Do we need a tool agent marketplace/registry?
5. How do we secure tool agent access (permissions, rate limits)?
