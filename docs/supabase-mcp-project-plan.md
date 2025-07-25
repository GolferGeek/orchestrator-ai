# Supabase MCP Implementation Project Plan

## 📋 Project Overview

This project plan implements the **Intelligent Supabase MCP System** as defined in the PRD, transforming MCPs into learning, multi-tool agents that provide natural language database operations with continuous improvement through context learning.

## 🎯 Project Objectives

### Primary Goals
- ✅ Create intelligent MCP servers with multiple specialized tools
- ✅ Implement context learning system for continuous improvement  
- ✅ Build unified UI that treats MCPs like multi-tool agents
- ✅ Support both internal and external MCP types
- ✅ Integrate flexible LLM selection per tool

### Success Criteria
- **User Experience**: 90%+ task completion rate for database operations
- **Learning Effectiveness**: 25%+ improvement in query success over 2 weeks
- **Performance**: <3s average response time for SQL generation
- **Adoption**: 80%+ of test users return within 7 days

## 🏗️ Technical Architecture Overview

### **LLM Configuration Architecture**

```typescript
// LLM Service Integration Structure
interface MCPToolLLMConfig {
  defaultProvider: LLMProvider;
  defaultModel: string;
  supportedProviders: LLMProvider[];
  roleOptimization: {
    [provider: string]: {
      fast: string;      // Fast, low-cost models
      balanced: string;  // Balanced performance/cost
      powerful: string;  // High-performance models
    };
  };
}

// Example Tool Configuration
const sqlGeneratorConfig: MCPToolLLMConfig = {
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-5-sonnet',
  supportedProviders: ['anthropic', 'openai', 'google'],
  roleOptimization: {
    anthropic: {
      fast: 'claude-3-haiku',
      balanced: 'claude-3-5-sonnet', 
      powerful: 'claude-3-opus'
    },
    openai: {
      fast: 'gpt-4o-mini',
      balanced: 'gpt-4o',
      powerful: 'gpt-4o'
    }
  }
};
```

### **Backend Components (Revised)**
```typescript
// Directory-based MCP Discovery Architecture
apps/api/src/mcp/
├── base/
│   ├── mcp-server-base.service.ts      // Abstract base for all MCPs
│   ├── intelligent-mcp.server.ts       // Internal MCP with learning
│   └── external-mcp.wrapper.ts         // External MCP adapter
├── registry/
│   ├── mcp-registry.service.ts         // Directory-based discovery
│   ├── mcp-discovery.service.ts        // Scan servers/* directories
│   └── external-mcp.service.ts         // YAML config loader
├── context/
│   ├── context-learning.service.ts     // Markdown file-based learning
│   └── context-hot-reload.service.ts   // File watch & reload
├── servers/supabase/
│   ├── supabase-mcp.server.ts          // Enhanced Supabase MCP
│   ├── services/
│   │   ├── simple-schema.service.ts    // Existing schema service
│   │   ├── sql-generator.service.ts    // Existing SQL generation
│   │   └── query-executor.service.ts   // Existing query execution
│   ├── tools/
│   │   ├── get-schema.tool.ts          // Existing schema tool
│   │   ├── generate-sql.tool.ts        // Enhanced with feedback tokens
│   │   ├── execute-sql.tool.ts         // Enhanced with tracking
│   │   ├── query-and-format.tool.ts    // Enhanced formatting
│   │   └── read-data.tool.ts           // Basic data reading
│   └── context/
│       └── supabase-sql-context.md     // Developer-managed context
├── feedback/
│   ├── feedback.controller.ts          // Feedback API endpoint
│   └── feedback.service.ts             // Feedback processing
└── external-mcps.yaml                  // External MCP configuration
```

### Frontend Components (Revised)
```vue
// Frontend MCP Interface (Mirror Agent Structure)
apps/web/src/components/MCP/
├── MCPAccordion.vue                    // Main MCP accordion (like AgentTreeView)
├── MCPServerCard.vue                   // Individual MCP server card
├── MCPHeader.vue                       // MCP server header with status
├── MCPToolGrid.vue                     // Tool selection grid
├── MCPExecutionPanel.vue               // Tool parameter input & execution
├── MCPLLMSelector.vue                  // Per-tool LLM model selection
├── MCPResultsDisplay.vue               // Results with feedback buttons
├── MCPFeedbackModal.vue                // Rating & comment collection
└── MCPErrorHandler.vue                 // Retry logic & manual fallback

// Store Management
apps/web/src/stores/mcp/
├── mcpStore.ts                         // Core MCP discovery & state
├── mcpExecutionStore.ts                // Tool execution & tracking
├── mcpFeedbackStore.ts                 // Feedback collection
└── mcpConfigStore.ts                   // Configuration management
```

## 📊 Database Schema Implementation

### Migration Scripts Required
```sql
-- 20250725000000_add_mcp_tracking_tables.sql
CREATE TABLE mcp_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_name VARCHAR NOT NULL,
  tool_name VARCHAR NOT NULL,
  agent_id UUID REFERENCES agents(id), -- NULLABLE
  user_id UUID REFERENCES auth.users(id),
  session_id UUID REFERENCES sessions(id), -- NULLABLE
  request_data JSONB,
  response_data JSONB,
  llm_provider VARCHAR,
  llm_model VARCHAR,
  execution_time_ms INTEGER,
  status VARCHAR,
  error_message TEXT,
  feedback_token UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mcp_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES mcp_executions(id),
  error_type VARCHAR,
  error_code VARCHAR,
  error_details JSONB,
  retry_attempt INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mcp_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_token UUID NOT NULL UNIQUE,
  execution_id UUID REFERENCES mcp_executions(id),
  user_id UUID REFERENCES auth.users(id),
  rating VARCHAR, -- 'up' | 'down'
  rating_score INTEGER CHECK (rating_score >= 1 AND rating_score <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mcp_executions_user_id ON mcp_executions(user_id);
CREATE INDEX idx_mcp_executions_agent_id ON mcp_executions(agent_id);
CREATE INDEX idx_mcp_executions_created_at ON mcp_executions(created_at);
```

## 🧪 Testing Strategy & Framework

### **Testing Philosophy**
**Rule: No UI testing until 90%+ tool-level test coverage is achieved.**

### **Test Infrastructure Setup**
```typescript
// Test Database Configuration
apps/api/test/
├── fixtures/
│   ├── test-schema.sql           // Sample database schema for testing
│   ├── test-data.sql            // Fixture data for all test scenarios
│   ├── context-examples/        // Sample context files for learning tests
│   └── expected-outputs/        // Expected SQL/results for validation
├── supabase-test/
│   ├── setup-test-db.ts         // Test database initialization
│   ├── tear-down-test-db.ts     // Test cleanup
│   └── test-data-manager.ts     // Test data management utilities
└── mcp/
    ├── tools/                   // Individual tool test suites
    ├── integration/             // Integration test suites
    └── performance/             // Performance test suites
```

### **Test Database Schema (Sample)**
```sql
-- test-schema.sql - Comprehensive test schema covering various SQL patterns
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  subscription_tier VARCHAR DEFAULT 'free',
  last_login_at TIMESTAMPTZ
);

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  capabilities JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_enabled BOOLEAN DEFAULT true
);

CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  user_id UUID REFERENCES users(id),
  session_id UUID,
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR DEFAULT 'active'
);

CREATE TABLE mcp_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_name VARCHAR NOT NULL,
  tool_name VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES agents(id),
  execution_time_ms INTEGER,
  status VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes, foreign keys, and complex relationships for testing
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_conversations_agent_user ON agent_conversations(agent_id, user_id);
```

---

## 📋 Tool-Specific Test Suites

### **1. Generate Schema Tool Tests**
```typescript
// apps/api/test/mcp/tools/generate-schema.tool.spec.ts
describe('GenerateSchemasTool', () => {
  describe('Basic Schema Generation', () => {
    test('should generate complete schema for all tables');
    test('should include relationships and foreign keys');
    test('should cache schema results properly');
    test('should handle refresh_cache parameter');
  });

  describe('Format Variations', () => {
    test('should generate JSON format schema');
    test('should generate Markdown format schema');
    test('should generate SQL DDL format schema');
  });

  describe('Error Handling', () => {
    test('should handle database connection errors');
    test('should handle invalid Supabase credentials');
    test('should provide meaningful error messages');
  });
});
```

### **2. Generate SQL Tool Tests (COMPREHENSIVE)**
```typescript
// apps/api/test/mcp/tools/generate-sql.tool.spec.ts
describe('GenerateSQLTool', () => {
  
  // ================== EASY LEVEL TESTS ==================
  describe('Easy SQL Generation', () => {
    const easyPrompts = [
      'Get all users',
      'Find users created today', 
      'Show active agents',
      'Count total users',
      'Get user by email',
      'List all agent types',
      'Find users with Gmail addresses',
      'Show recent conversations',
      'Get agents created this week',
      'Count active conversations'
    ];

    test.each(easyPrompts)('should generate correct SQL for: %s', async (prompt) => {
      const result = await generateSQLTool.execute({ prompt });
      expect(result.isError).toBe(false);
      expect(result.content.sql).toBeTruthy();
      expect(result.content.sql).toMatch(/^SELECT/i);
      // Validate SQL syntax
      await validateSQLSyntax(result.content.sql);
    });

    test('should generate simple WHERE clauses correctly', async () => {
      const prompt = 'Find users created after 2024-01-01';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toContain('WHERE');
      expect(result.content.sql).toMatch(/created_at\s*>\s*'2024-01-01'/i);
    });

    test('should handle basic sorting requests', async () => {
      const prompt = 'Get all users sorted by creation date';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toContain('ORDER BY');
      expect(result.content.sql).toMatch(/created_at/i);
    });
  });

  // ================== MID-LEVEL TESTS ==================
  describe('Mid-Level SQL Generation', () => {
    const midLevelPrompts = [
      'Show users with their agent counts',
      'Find conversations between two specific dates with user details',
      'Get average execution time by MCP tool',
      'Show users who have never logged in',
      'Find agents with more than 10 conversations',
      'Get monthly user registration trends',
      'Show top 5 most active users by conversation count',
      'Find users with agents but no conversations',
      'Get agents grouped by type with success rates',
      'Show daily MCP usage statistics'
    ];

    test.each(midLevelPrompts)('should generate correct SQL for: %s', async (prompt) => {
      const result = await generateSQLTool.execute({ prompt });
      expect(result.isError).toBe(false);
      expect(result.content.sql).toBeTruthy();
      await validateSQLSyntax(result.content.sql);
      // Should contain JOINs or aggregations
      expect(result.content.sql).toMatch(/(JOIN|GROUP BY|COUNT|AVG|SUM)/i);
    });

    test('should generate proper JOINs for related data', async () => {
      const prompt = 'Show all conversations with user and agent names';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toMatch(/JOIN.*users/i);
      expect(result.content.sql).toMatch(/JOIN.*agents/i);
      expect(result.content.sql).toContain('users.first_name');
      expect(result.content.sql).toContain('agents.name');
    });

    test('should handle GROUP BY with aggregations', async () => {
      const prompt = 'Count conversations by agent type';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toContain('GROUP BY');
      expect(result.content.sql).toMatch(/COUNT\(/i);
      expect(result.content.sql).toContain('agents.type');
    });
  });

  // ================== ADVANCED LEVEL TESTS ==================
  describe('Advanced SQL Generation', () => {
    const advancedPrompts = [
      'Show running total of user registrations by month with percentage change',
      'Find users whose conversation patterns are similar to user X using window functions',
      'Get complex cohort analysis of user retention by subscription tier',
      'Show agents with execution time percentiles and outlier detection',
      'Find conversation threads with recursive CTEs for nested responses',
      'Generate time-series analysis of MCP tool adoption rates',
      'Show advanced user segmentation based on usage patterns',
      'Find anomalous execution patterns using statistical functions',
      'Generate pivot table of agent performance metrics',
      'Show complex funnel analysis from registration to conversation'
    ];

    test.each(advancedPrompts)('should generate correct SQL for: %s', async (prompt) => {
      const result = await generateSQLTool.execute({ prompt });
      expect(result.isError).toBe(false);
      expect(result.content.sql).toBeTruthy();
      await validateSQLSyntax(result.content.sql);
      // Should contain advanced SQL features
      expect(result.content.sql).toMatch(/(CTE|WITH|WINDOW|PARTITION|PERCENTILE|RECURSIVE)/i);
    });

    test('should generate CTEs for complex queries', async () => {
      const prompt = 'Show user lifetime value with intermediate calculations';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toMatch(/WITH\s+\w+\s+AS/i);
    });

    test('should use window functions appropriately', async () => {
      const prompt = 'Rank users by conversation count within each subscription tier';
      const result = await generateSQLTool.execute({ prompt });
      expect(result.content.sql).toMatch(/RANK\(\)\s+OVER/i);
      expect(result.content.sql).toMatch(/PARTITION BY/i);
    });
  });

  // ================== CONTEXT LEARNING TESTS ==================
  describe('Context Learning Integration', () => {
    test('should improve after learning from successful patterns', async () => {
      // Setup context with successful pattern
      const contextContent = `
      ## Successful Query Patterns
      ### User Analytics Queries
      - For "active users", always use "is_active = true"
      - For "recent", use "created_at >= NOW() - INTERVAL '7 days'"
      `;
      await setupTestContext(contextContent);

      const prompt = 'Show active users from recent period';
      const result = await generateSQLTool.execute({ prompt, use_context: true });
      
      expect(result.content.sql).toContain('is_active = true');
      expect(result.content.sql).toMatch(/created_at >= NOW\(\) - INTERVAL '7 days'/);
    });

    test('should avoid patterns marked as errors in context', async () => {
      const contextContent = `
      ## Common Error Patterns & Fixes
      ### Column Name Issues
      **Error**: Using "created_date" 
      **Fix**: Use "created_at" instead
      `;
      await setupTestContext(contextContent);

      const prompt = 'Find users created today';
      const result = await generateSQLTool.execute({ prompt, use_context: true });
      
      expect(result.content.sql).toContain('created_at');
      expect(result.content.sql).not.toContain('created_date');
    });
  });

  // ================== RETRY LOGIC TESTS ==================
  describe('Smart Retry Logic', () => {
    test('should retry on SQL syntax errors', async () => {
      // Mock LLM to return invalid SQL first, then valid SQL
      mockLLMService
        .mockResolvedValueOnce('INVALID SQL SYNTAX')
        .mockResolvedValueOnce('SELECT * FROM users');

      const result = await generateSQLTool.execute({ 
        prompt: 'Get all users',
        max_retries: 3 
      });

      expect(result.isError).toBe(false);
      expect(result.content.sql).toBe('SELECT * FROM users');
      expect(result._meta.retry_count).toBe(1);
    });

    test('should provide fallback after max retries', async () => {
      // Mock LLM to always return invalid SQL
      mockLLMService.mockResolvedValue('INVALID SQL');

      const result = await generateSQLTool.execute({ 
        prompt: 'Complex query',
        max_retries: 2 
      });

      expect(result.isError).toBe(true);
      expect(result.error_code).toBe('EXCEEDED_RETRIES');
      expect(result.content.last_attempted_sql).toBe('INVALID SQL');
      expect(result._meta.retry_count).toBe(2);
    });
  });

  // ================== LLM MODEL TESTS ==================
  describe('LLM Model Selection', () => {
    test('should use specified LLM provider and model', async () => {
      await generateSQLTool.execute({ 
        prompt: 'Test query',
        llm_provider: 'openai',
        llm_model: 'gpt-4o-mini'
      });

      expect(mockLLMService.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o-mini'
        })
      );
    });

    test('should fall back to default model if specified model fails', async () => {
      mockLLMService
        .mockRejectedValueOnce(new Error('Model unavailable'))
        .mockResolvedValueOnce('SELECT * FROM users');

      const result = await generateSQLTool.execute({ 
        prompt: 'Test query',
        llm_provider: 'anthropic',
        llm_model: 'claude-3-opus' // Expensive model that might fail
      });

      expect(result.isError).toBe(false);
      expect(result._meta.fallback_used).toBe(true);
    });
  });
});
```

### **3. Execute SQL Tool Tests**
```typescript
// apps/api/test/mcp/tools/execute-sql.tool.spec.ts
describe('ExecuteSQLTool', () => {
  describe('Read Operations', () => {
    test('should execute SELECT queries successfully');
    test('should respect timeout parameters');
    test('should handle large result sets');
  });

  describe('Write Operations Security', () => {
    test('should detect INSERT/UPDATE/DELETE operations');
    test('should require confirmation_token for writes');
    test('should default to dry_run=true');
    test('should perform EXPLAIN for dry runs');
  });

  describe('SQL Injection Prevention', () => {
    test('should reject malicious SQL patterns');
    test('should sanitize inputs properly');
  });
});
```

### **4. Response Formatting Tests**
```typescript
// apps/api/test/mcp/tools/format-results.tool.spec.ts
describe('FormatResultsTool', () => {
  describe('Data Format Conversion', () => {
    const testResults = [
      { id: 1, name: 'Test', created_at: '2024-01-01' },
      { id: 2, name: 'Test2', created_at: '2024-01-02' }
    ];

    test('should format as markdown table', async () => {
      const result = await formatResultsTool.execute({
        data: testResults,
        format: 'markdown'
      });
      expect(result.content).toContain('| id | name | created_at |');
      expect(result.content).toContain('| 1 | Test | 2024-01-01 |');
    });

    test('should format as CSV', async () => {
      const result = await formatResultsTool.execute({
        data: testResults,
        format: 'csv'
      });
      expect(result.content).toContain('id,name,created_at');
      expect(result.content).toContain('1,Test,2024-01-01');
    });

    test('should format as JSON with proper structure', async () => {
      const result = await formatResultsTool.execute({
        data: testResults,
        format: 'json'
      });
      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toHaveProperty('id', 1);
    });
  });

  describe('Large Dataset Handling', () => {
    test('should handle datasets with 1000+ rows');
    test('should implement pagination for large results');
    test('should provide summary statistics');
  });
});
```

---

## 🚀 Updated Implementation Phases (With Testing)

### **Phase 1: Foundation & Testing Infrastructure (Week 1)**

#### **Days 1-2: Test Infrastructure Setup**
- [ ] **1.1 Test Database & Fixtures**
  - Create comprehensive test schema covering all SQL patterns
  - Build test data manager with realistic fixture data
  - Setup test database initialization and cleanup
  - Create expected output fixtures for validation

- [ ] **1.2 Test Framework Configuration** 
  - Configure Jest with custom matchers for SQL validation
  - Setup test database connection and transaction management
  - Create test utilities for LLM mocking and context management
  - Build SQL syntax validation helpers

#### **Days 3-4: Enhanced MCP Server Base (Test-Driven)**
- [ ] **1.3 Base MCP Server (TDD)**
  - Write tests for `executeWithTracking()` method first
  - Implement feedback token generation with tests
  - Add execution logging with comprehensive test coverage
  - Test error handling and retry mechanisms

- [ ] **1.4 Context Learning Service (TDD)**
  - Write tests for context file parsing and enhancement
  - Test hot-reload capability with file watching
  - Implement context-enhanced prompt generation with tests
  - Test context learning integration

---

### **Phase 2: Tool Implementation & Testing (Week 2)**

#### **Days 5-6: SQL Generation Tool (Test-Heavy)**
- [ ] **2.1 Generate SQL Tool Test Suite**
  - Implement all 30+ easy level test cases
  - Implement all 20+ mid-level test cases  
  - Implement all 15+ advanced level test cases
  - **Target: 95%+ test coverage before UI implementation**

- [ ] **2.2 Generate SQL Tool Implementation**
  - Implement tool to pass easy level tests
  - Enhance to pass mid-level tests
  - Add advanced SQL generation capabilities
  - **No UI work until all tests pass**

#### **Days 7-8: Remaining Tools (Test-First)**
- [ ] **2.3 All Other Tools Test Suites**
  - Schema generation: 15+ test cases
  - SQL execution: 20+ test cases (security focus)
  - Result formatting: 10+ test cases
  - **Each tool needs 90%+ coverage**

- [ ] **2.4 Integration Testing**
  - Tool execution pipeline tests
  - Context learning integration tests
  - LLM provider fallback tests
  - Database transaction tests

---

### **Phase 3: UI Implementation (Only After Tool Coverage) (Week 3)**

#### **Days 9-10: Frontend Components (Test-Backed)**
- [ ] **3.1 MCP Accordion Implementation**
  - Build UI components backed by tested tools
  - Integration testing with real tool execution
  - Error handling UI with tested error scenarios

#### **Days 11-12: Advanced Features**
- [ ] **3.2 Feedback System**
  - UI for feedback collection
  - Integration with tested feedback processing
  - Analytics dashboard for test results

---

## 📊 Testing Quality Gates

### **Phase Gate Requirements**
- **Phase 1 → 2**: 100% infrastructure test coverage
- **Phase 2 → 3**: 95%+ tool test coverage, all SQL complexity levels passing
- **Phase 3 → Production**: 90%+ integration test coverage

### **Continuous Testing Strategy**
```typescript
// Automated test execution
npm run test:tools          // Run all tool tests
npm run test:sql:easy       // Run easy SQL generation tests only
npm run test:sql:mid        // Run mid-level SQL tests only  
npm run test:sql:advanced   // Run advanced SQL tests only
npm run test:integration    // Run integration tests
npm run test:performance    // Run performance tests
npm run test:coverage       // Generate coverage report
```

This comprehensive testing strategy ensures we never have to rely on UI testing for core functionality. The SQL generation tool gets the most thorough testing since it's the most complex and error-prone component.
