# Supabase MCP Product Requirements Document (PRD)

## 📋 Executive Summary

Transform the Orchestrator AI MCP (Model Context Protocol) system into **Intelligent Multi-Tool Agents** that combine specialized database operations with AI-powered learning and adaptation. The Supabase MCP will serve as the flagship implementation, demonstrating context learning, proactive setup, and seamless integration with both internal and external MCP systems.

## 🎯 Product Vision

Create a unified interface where MCP servers function as intelligent, learning agents with multiple specialized tools, providing users with natural language access to complex database operations while continuously improving through context learning.

## 🚀 Core Value Propositions

### For End Users
- **Natural Language Database Operations**: Write SQL, query data, and manage schemas using plain English
- **Progressive Learning**: System gets smarter with each interaction, learning user patterns and preferences
- **Unified Experience**: Same familiar interface as agents, but with multiple specialized tools
- **Proactive Intelligence**: Auto-generates schemas, suggests optimizations, handles retries automatically

### For Developers
- **Extensible Architecture**: Easy to add new MCP servers and tools
- **External MCP Integration**: Wrap and enhance third-party MCP servers
- **LLM Flexibility**: Choose optimal AI models for different tool functions
- **Context Preservation**: Learning persists across sessions and improves over time

## 📊 Target Users

### Primary Users
- **Business Analysts**: Need quick database insights without SQL expertise
- **Product Managers**: Require data analysis and reporting capabilities
- **Developers**: Want intelligent database management and query assistance

### Secondary Users
- **Data Scientists**: Benefit from AI-assisted query generation and optimization
- **System Administrators**: Use intelligent schema management and monitoring

## 🏗️ System Architecture - MCP COMPLIANCE WITH INTELLIGENCE

### MCP Discovery & Registry Architecture

```typescript
// ✅ Directory-based MCP Discovery (like agents)
class MCPRegistryService {
  private internalMCPs: Map<string, IMCPServer> = new Map();
  private externalMCPs: Map<string, ExternalMCPWrapper> = new Map();
  
  async discoverInternalMCPs(): Promise<void> {
    // Scan apps/api/src/mcp/servers/*/ directories
    // Load and register each MCP server
  }
  
  async loadExternalMCPs(): Promise<void> {
    // Load external-mcps.yaml configuration
    // Initialize external MCP wrappers
  }
}

// ✅ MCP-Compliant Base with Agent Integration
abstract class BaseMCPServer implements IMCPServer {
  abstract getServerInfo(): Promise<MCPServerInfo>;
  abstract listTools(): Promise<MCPListToolsResponse>;
  abstract callTool(request: MCPToolRequest): Promise<MCPToolResponse>;
  
  // Enhanced execution with tracking
  protected async executeWithTracking(
    request: MCPToolRequest,
    executor: () => Promise<MCPToolResponse>
  ): Promise<MCPToolResponse> {
    const startTime = Date.now();
    const executionId = generateUUID();
    
    try {
      const response = await executor();
      await this.logExecution(request, response, executionId, Date.now() - startTime);
      return {
        ...response,
        _meta: {
          ...response._meta,
          feedback_token: executionId
        }
      };
    } catch (error) {
      await this.logFailure(request, error, executionId);
      throw error;
    }
  }
}

// ✅ Internal MCP with Intelligence (Protocol Compliant)
class IntelligentSupabaseMCP extends BaseMCPServer {
  private contextLearning: ContextLearningService;
  private llmService: LLMService;
  
  async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    // All intelligence happens INSIDE standard MCP methods
    const context = await this.contextLearning.getContext(request.name);
    const llmModel = this.selectOptimalLLM(request);
    
    // Execute with enhancements, return standard response
    return this.executeToolWithIntelligence(request, context, llmModel);
  }
}
```

### Core Components (MCP-Compliant)

#### 1. Standard MCP Server Info
```typescript
async getServerInfo(): Promise<MCPServerInfo> {
  return {
    name: 'Intelligent Supabase MCP',
    version: '1.0.0',
    description: 'AI-powered database operations with context learning',
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
      logging: true
    },
    metadata: {
      intelligence_features: ['context_learning', 'auto_retry', 'llm_optimization'],
      supported_llms: ['claude-3-5-sonnet', 'gpt-4o', 'claude-3-haiku'],
      database_type: 'postgresql'
    }
  };
}
```

## 🛠️ MCP Discovery & Configuration Architecture

### Internal MCP Discovery
* **Directory-based discovery**: MCPs discovered via `apps/api/src/mcp/servers/*/` directory structure
* **No database table needed**: MCP metadata comes from code structure and server info
* **Supabase credentials**: Read from `.env` variables (`SUPABASE_URL`, `SUPABASE_KEY`)

### External MCP Configuration (Foundation)
* **YAML Configuration**: `external-mcps.yaml` defines external MCP servers
* **Environment Variables**: Credentials stored in `.env` file
* **Future Enhancement**: UI for external MCP management

#### External MCP YAML Structure
```yaml
# external-mcps.yaml
mcps:
  github:
    name: "GitHub MCP"
    url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github"
    type: "external"
    credentials:
      api_key_env: "GITHUB_MCP_API_KEY"
      org_env: "GITHUB_MCP_ORG"
    capabilities:
      - "repository_access"
      - "issue_management"
      - "pull_requests"
      
  slack:
    name: "Slack MCP"
    url: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack"
    type: "external"
    credentials:
      token_env: "SLACK_MCP_TOKEN"
      workspace_env: "SLACK_MCP_WORKSPACE"
    capabilities:
      - "message_sending"
      - "channel_management"
```

---

## 📣 Feedback Capture & Review

Each AI-powered tool response includes a `_meta.feedback_token` allowing the UI to POST feedback:
```json
POST /mcp/feedback
{
  "feedback_token": "uuid",
  "rating": "up" | "down",
  "comment": "optional free-text"
}
```
Feedback is written to `mcp_feedback` table with links to tool, attempt, user & timestamp.

### UI Pattern
* After every execution the result footer shows 👍 / 👎 and an optional text field.
* After **three consecutive failures** (`EXCEEDED_RETRIES`) the feedback modal opens automatically.

---

## 📚 Context Learning System

### Developer-Managed Context Learning
* **Manual curation**: Developer updates `supabase-sql-context.md` based on AI suggestions
* **Structured format**: Markdown file with successful patterns, error fixes, and optimization insights
* **Hot-reload capability**: File changes trigger in-memory context refresh
* **No UI required initially**: Direct file editing workflow

### Context File Structure
```markdown
# Supabase SQL Context Learning

## Database Schema Overview
<!-- Auto-generated section -->

## Successful Query Patterns
### Agent Analytics Queries
[SQL examples with context]

## Common Error Patterns & Fixes
### Column Name Issues
**Error**: `column "created_date" does not exist`
**Fix**: Use `created_at` instead

## Query Optimization Insights
### Effective Patterns
- Time filtering best practices
- Join optimization techniques

## Model Performance Notes
### claude-3-5-sonnet
- **Strengths**: Complex joins, business logic
- **Best For**: Analytics and reporting
```

### AI Admin Workflow
1. **Nightly export**: `mcp_feedback` + `mcp_failures` data to CSV
2. **Developer review**: Analyze patterns and update context file
3. **Hot-reload**: Context changes immediately available to MCP tools

---

## 🔐 Security Considerations

* All SQL generated by `generate_sql` is **parsed** to determine intent.
* `execute_sql` now supports `dry_run` (default **true**).  In dry-run it performs `EXPLAIN` only and returns warning plus `confirmation_token` if a write is detected.
* UI must POST the `confirmation_token` with `dry_run:false` before the query can modify data.
* Permission check for destructive queries is **independent** from the tool that generated the SQL.

---

## 🗄️ Database Schema (Revised)

### Core Tracking Tables

#### `mcp_executions` - Universal execution tracking
```sql
CREATE TABLE mcp_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_name VARCHAR NOT NULL, -- 'supabase', 'github', etc.
  tool_name VARCHAR NOT NULL,
  agent_id UUID REFERENCES agents(id), -- NULLABLE - for agent-initiated calls
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES sessions(id), -- NULLABLE
  request_data JSONB, -- Tool arguments
  response_data JSONB, -- Tool response
  llm_provider VARCHAR, -- 'anthropic', 'openai', etc.
  llm_model VARCHAR, -- 'claude-3-5-sonnet', etc.
  execution_time_ms INTEGER,
  status VARCHAR, -- 'success' | 'error' | 'timeout'
  error_message TEXT,
  feedback_token UUID, -- For user feedback
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `mcp_failures` - Generic failure tracking
```sql
CREATE TABLE mcp_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES mcp_executions(id),
  error_type VARCHAR, -- 'sql_error', 'llm_timeout', 'validation_error'
  error_code VARCHAR,
  error_details JSONB,
  retry_attempt INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `mcp_feedback` - Dual rating system
```sql
CREATE TABLE mcp_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_token UUID NOT NULL UNIQUE,
  execution_id UUID REFERENCES mcp_executions(id),
  user_id UUID REFERENCES auth.users(id),
  rating VARCHAR, -- 'up' | 'down' (quick feedback)
  rating_score INTEGER CHECK (rating_score >= 1 AND rating_score <= 5), -- 1-5 detailed rating
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 2. MCP-Compliant Tool Definitions
```typescript
// ✅ Standard MCP Tool Definitions with Intelligence Options
const SUPABASE_TOOLS: MCPToolDefinition[] = [
  {
    name: "generate_schema",
    description: "Auto-generate and cache database schema with AI analysis",
    inputSchema: {
      type: "object",
      properties: {
        refresh_cache: { type: "boolean", default: false },
        format: { type: "string", enum: ["json", "markdown", "sql"], default: "markdown" },
        include_relationships: { type: "boolean", default: true },
        llm_provider: { type: "string", enum: ["anthropic", "openai", "google"], default: "anthropic" },
        llm_model: { type: "string", default: "claude-3-haiku" }
      }
    }
  },
  {
    name: "generate_sql",
    description: "Convert natural language to SQL with context learning",
    inputSchema: {
      type: "object", 
      properties: {
        prompt: { type: "string", description: "Natural language query description" },
        llm_provider: { type: "string", enum: ["anthropic", "openai", "google"], default: "anthropic" },
        llm_model: { type: "string", default: "claude-3-5-sonnet" },
        use_context: { type: "boolean", default: true },
        max_retries: { type: "number", default: 3 }
      },
      required: ["prompt"]
    }
  },
  {
    name: "execute_sql", 
    description: "Execute SQL queries with safety validation",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to execute" },
        dry_run: { type: "boolean", default: true },
        read_only: { type: "boolean", default: true },
        confirmation_token: { type: "string", description: "Returned token required to run write queries", nullable: true },
        timeout: { type: "number", default: 30000 }
      },
      required: ["sql"]
    }
  },
  {
    name: "format_results",
    description: "Format query results with AI-powered presentation",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Raw query results" },
        format: { type: "string", enum: ["table", "chart", "summary", "csv", "json"] },
        llm_provider: { type: "string", enum: ["anthropic", "openai", "google"], default: "openai" },
        llm_model: { type: "string", default: "gpt-4o-mini" }
      },
      required: ["data", "format"]
    }
  },
  {
    name: "add_records",
    description: "Intelligent data insertion with field mapping",
    inputSchema: {
      type: "object", 
      properties: {
        table: { type: "string", description: "Target table name" },
        data: { type: "object", description: "Data to insert" },
        validate_fields: { type: "boolean", default: true },
        bulk_insert: { type: "boolean", default: false }
      },
      required: ["table", "data"]
    }
  }
];
```

*(Tool enums keep `google` but supply example model `gemini-pro` in metadata list.)*

---

### Manual Fallback Flow (Generate SQL Tool)
* After `max_retries` the MCP returns `error_code:"EXCEEDED_RETRIES"` plus the last attempted SQL.
* UI opens an SQL editor pre-filled with that statement; user may edit & send directly to `execute_sql`.
* Feedback modal is shown concurrently to capture user notes.

### Agent Integration
* **Agent-initiated executions**: `agent_id` populated in `mcp_executions` table
* **User-initiated executions**: `agent_id` remains NULL for direct user interactions
* **Analytics capability**: Track which agents use which MCP tools most effectively
* **MCP Accordion UI**: Mirror agent accordion structure for consistent UX

### LLM Selection Architecture
```typescript
// Default LLM configuration per tool
interface MCPToolLLMConfig {
  defaultProvider: 'anthropic' | 'openai' | 'google';
  defaultModel: string;
  supportedProviders: string[];
}

// Tool-specific defaults
const TOOL_LLM_DEFAULTS = {
  'generate-schema': {
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-haiku', // Fast for schema analysis
    supportedProviders: ['anthropic', 'openai']
  },
  'generate-sql': {
    defaultProvider: 'anthropic', 
    defaultModel: 'claude-3-5-sonnet', // Best for complex SQL
    supportedProviders: ['anthropic', 'openai', 'google']
  },
  'format-results': {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini', // Cost-effective for formatting
    supportedProviders: ['openai', 'anthropic']
  }
};
```

#### 3. Context Learning (Internal Implementation)
```typescript
// ✅ Context learning that works within MCP boundaries
class MCPContextLearningService {
  private contextFile = 'supabase-sql-context.md';
  
  async enhancePrompt(toolName: string, userPrompt: string): Promise<string> {
    const context = await this.loadContext(toolName);
    
    // Build contextual prompt internally
    return `
# Database Context
${context.schemaInfo}

# Successful Query Patterns  
${context.successfulPatterns}

# Common Error Fixes
${context.errorPatterns}

# User Request
${userPrompt}
    `.trim();
  }

  async updateContext(toolName: string, request: MCPToolRequest, response: MCPToolResponse): Promise<void> {
    // Update learning context after successful executions
    if (!response.isError) {
      await this.recordSuccess(toolName, request, response);
    } else {
      await this.recordError(toolName, request, response);
    }
  }
}
```

## 🛠️ Supabase MCP Tool Specifications - REVISED

### 1. Generate Schema Tool (MCP-Compliant)
```typescript
async executeGenerateSchema(args: any): Promise<MCPToolResponse> {
  const { 
    refresh_cache = false, 
    format = "markdown",
    llm_provider = "anthropic",
    llm_model = "claude-3-haiku"
  } = args;
  
  if (!refresh_cache && this.schemaCache) {
    return {
      content: [{ type: "text", text: this.formatSchema(this.schemaCache, format) }],
      _meta: { cached: true, generated_at: this.schemaCacheTime }
    }; 
  }

  // Auto-generate schema with LLM analysis
  const schema = await this.discoverSchema();
  const analysisPrompt = `Analyze this database schema and provide insights:\n${JSON.stringify(schema)}`;
  const analysis = await this.llmService.generateResponse({
    provider: llm_provider,
    model: llm_model,
    prompt: analysisPrompt,
    temperature: 0.1, // Low temperature for consistent analysis
    systemPrompt: 'You are a database schema expert. Provide clear, structured analysis.'
  });

  this.schemaCache = { schema, analysis };
  this.schemaCacheTime = new Date().toISOString();

  return {
    content: [
      { type: "text", text: this.formatSchema(this.schemaCache, format) }
    ],
    _meta: { 
      tables_found: schema.tables.length,
      analysis_provider: llm_provider,
      analysis_model: llm_model,
      cached: false 
    }
  };
}
```

### 2. Generate SQL Tool with Context Learning
```typescript
async executeGenerateSQL(args: any): Promise<MCPToolResponse> {
  const { 
    prompt, 
    llm_provider = "anthropic",
    llm_model = "claude-3-5-sonnet", 
    use_context = true, 
    max_retries = 3 
  } = args;
  
  let enhancedPrompt = prompt;
  if (use_context) {
    enhancedPrompt = await this.contextLearning.enhancePrompt('generate_sql', prompt);
  }

  // Try multiple times with context refinement
  for (let attempt = 1; attempt <= max_retries; attempt++) {
    try {
      const sqlResult = await this.llmService.generateResponse({
        provider: llm_provider,
        model: llm_model,
        prompt: enhancedPrompt,
        temperature: 0.2, // Low temperature for consistent SQL
        systemPrompt: 'You are an expert SQL generator. Return only valid, executable SQL.'
      });

      // Validate SQL before returning
      const validation = await this.validateSQL(sqlResult);
      if (validation.valid) {
        // Update context with success
        await this.contextLearning.updateContext('generate_sql', 
          { name: 'generate_sql', arguments: args } as MCPToolRequest,
          { content: [{ type: 'text', text: sqlResult }] } as MCPToolResponse
        );

        return {
          content: [
            { 
              type: "text", 
              text: `\`\`\`sql\n${sqlResult}\n\`\`\`` 
            }
          ],
          _meta: {
            provider_used: llm_provider,
            model_used: llm_model,
            attempt: attempt,
            context_applied: use_context,
            validation: validation
          }
        };
      } else if (attempt < max_retries) {
        // Refine prompt for retry
        enhancedPrompt += `\n\nPrevious attempt failed: ${validation.error}. Please fix and try again.`;
      }
    } catch (error) {
      if (attempt === max_retries) {
        return {
          content: [{ type: "text", text: `SQL generation failed after ${max_retries} attempts: ${error.message}` }],
          isError: true,
          _meta: { 
            attempts: max_retries, 
            provider_used: llm_provider,
            model_used: llm_model 
          }
        };
      }
    }
  }
}
```

## 🔗 External MCP Integration - REVISED

### MCP-Compliant External Wrapper
```typescript
// ✅ External MCP wrapper that maintains protocol compliance
class ExternalMCPWrapper implements IMCPServer {
  constructor(private externalConfig: ExternalMCPConfig) {}

  async getServerInfo(): Promise<MCPServerInfo> {
    const externalInfo = await this.fetchExternalServerInfo();
    
    // Add our enhancement metadata while keeping core info
    return {
      ...externalInfo,
      name: `${externalInfo.name} (Enhanced)`,
      metadata: {
        ...externalInfo.metadata,
        orchestrator_enhancements: ['retry_logic', 'response_formatting', 'error_translation'],
        external_endpoint: this.externalConfig.endpoint
      }
    };
  }

  async callTool(request: MCPToolRequest): Promise<MCPToolResponse> {
    // Add retry logic and error translation
    try {
      const externalResponse = await this.callExternalTool(request);
      
      // Enhance response formatting while maintaining MCP compliance
      return {
        content: this.formatExternalResponse(externalResponse.content),
        _meta: {
          ...externalResponse._meta,
          enhanced_by: 'orchestrator',
          response_time: Date.now()
        }
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: this.translateExternalError(error) 
        }],
        isError: true,
        _meta: { external_error: true, original_error: error.message }
      };
    }
  }
}
```

## 🎨 Frontend Integration

### MCP Accordion Component Structure
```vue
<!-- Mirror agent accordion structure -->
<MCPAccordion>
  <MCPServerCard v-for="mcp in mcps" :key="mcp.name">
    <MCPHeader :name="mcp.name" :status="mcp.status" />
    <MCPToolGrid :tools="mcp.tools" @tool-selected="handleToolSelection" />
    <MCPExecutionPanel 
      v-if="selectedTool" 
      :tool="selectedTool"
      :llm-options="getLLMOptions(selectedTool)"
      @execute="executeTool"
    />
    <MCPResultsDisplay 
      v-if="lastResult" 
      :result="lastResult"
      @feedback="submitFeedback"
    />
  </MCPServerCard>
</MCPAccordion>
```

### UI Integration Points
* **MCP Selection**: Dropdown/accordion matching agent UI patterns
* **Tool Execution**: Parameter input with LLM model selection
* **Feedback Collection**: Thumbs up/down + 1-5 star rating + comments
* **Results Display**: Formatted output with export options
* **Error Handling**: Retry prompts and manual fallback editing

This revised architecture ensures we stay **100% compliant** with the MCP protocol while achieving all intelligent features through internal implementation details and maintaining consistency with the existing agent UI patterns. 