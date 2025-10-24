# Supabase Agent Orchestration E2E Tests

This directory contains E2E tests that demonstrate the full orchestration pipeline using A2A (Agent-to-Agent) calls with the Supabase tool agent.

## Test Overview

The orchestration tests simulate a complete workflow:

1. **Authentication** → Get JWT token using `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD`
2. **Schema Discovery** → A2A call to get database schema
3. **SQL Generation** → A2A call to generate SQL from natural language
4. **SQL Execution** → A2A call to execute the generated SQL
5. **Result Analysis** → A2A call to analyze and summarize results

## Test Files

### `test-supabase-a2a-simple.js`
- **Purpose**: Core A2A orchestration pattern test
- **Focus**: Essential A2A calls with minimal complexity
- **Duration**: ~30 seconds
- **Use Case**: Quick verification of orchestration pipeline

### `test-supabase-agent-orchestration-e2e.js`
- **Purpose**: Comprehensive orchestration test
- **Focus**: Full pipeline with error handling, SSE streaming, metadata tracking
- **Duration**: ~60 seconds
- **Use Case**: Complete validation of orchestration capabilities

### `run-supabase-orchestration-test.sh`
- **Purpose**: Test runner script
- **Features**: Health checks, environment validation, comprehensive reporting
- **Use Case**: Automated testing and CI/CD integration

## Prerequisites

### Environment Variables
```bash
# Required in .env file
SUPABASE_TEST_USER=demo.user@playground.com
SUPABASE_TEST_PASSWORD=demouser
```

### Server Requirements
- API server running on `http://localhost:3001`
- Supabase agent loaded in `demo` organization
- Database accessible with test credentials

## Running the Tests

### Quick Test (Recommended)
```bash
cd apps/api/testing
node test-supabase-a2a-simple.js
```

### Comprehensive Test
```bash
cd apps/api/testing
node test-supabase-agent-orchestration-e2e.js
```

### Automated Test Suite
```bash
cd apps/api/testing
./run-supabase-orchestration-test.sh
```

## Test Scenarios

### Scenario 1: User Count Query
**Query**: "How many users do we have in the system?"

**Expected Flow**:
1. Schema discovery identifies user tables
2. SQL generation creates `SELECT COUNT(*) FROM users`
3. SQL execution returns user count
4. Analysis provides stakeholder summary

### Scenario 2: Complex Analytics
**Query**: "Show me the top 10 most active users this month"

**Expected Flow**:
1. Schema discovery identifies user activity tables
2. SQL generation creates complex JOIN query
3. SQL execution returns ranked results
4. Analysis provides business insights

## A2A Call Structure

Each A2A call follows this pattern:

```javascript
const request = {
  jsonrpc: '2.0',
  id: uuidv4(),
  method: 'execute_task',
  params: {
    mode: 'build',
    conversationId: conversationId,
    payload: {
      action: 'action_name',
      // action-specific parameters
    },
    userMessage: 'Human-readable description',
    metadata: {
      testType: 'orchestration',
      step: 'step_name'
    }
  }
};
```

## Expected Results

### Successful Test Output
```
🚀 A2A Orchestration Test: "How many users do we have?"
==================================================

1️⃣ Authentication...
✅ JWT obtained

2️⃣ A2A Call: Get Schema
✅ Schema retrieved

3️⃣ A2A Call: Generate SQL
✅ SQL generated: SELECT COUNT(*) as user_count FROM users...

4️⃣ A2A Call: Execute SQL
✅ SQL executed
Results: {"user_count": 42}

5️⃣ A2A Call: Analyze Results
✅ Analysis complete
Summary: "The system currently has 42 users..."

🎉 A2A Orchestration Complete!
==================================================
✅ All 5 A2A calls successful
✅ Full orchestration pipeline working
✅ Ready for multi-agent workflows
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check `SUPABASE_TEST_USER` and `SUPABASE_TEST_PASSWORD` in `.env`
   - Verify Supabase server is running

2. **Agent Not Found**
   - Ensure Supabase agent is loaded in `demo` organization
   - Check agent slug is `supabase-agent`

3. **Database Connection Issues**
   - Verify Supabase environment variables
   - Check database accessibility

4. **A2A Call Failures**
   - Verify API server is running on port 3001
   - Check agent configuration and MCP tools

### Debug Mode
```bash
DEBUG=true node test-supabase-a2a-simple.js
```

## Integration with Orchestration System

These tests validate the core patterns that will be used in the orchestration system:

- **Multi-Agent Workflows**: Chaining multiple A2A calls
- **Context Passing**: Maintaining conversation context across calls
- **Error Handling**: Graceful failure and recovery
- **Metadata Tracking**: Full observability of orchestration flow
- **SSE Streaming**: Real-time progress updates

## Future Enhancements

- **Parallel Execution**: Test multiple agents simultaneously
- **Conditional Logic**: Test branching based on results
- **Error Recovery**: Test retry mechanisms
- **Performance Metrics**: Measure orchestration latency
- **Load Testing**: Test orchestration under load

## Related Documentation

- [A2A Protocol Documentation](../../obsidian/efforts/Matt/agent-roles/agent-expertise/agent2agent-protocol.md)
- [Tool Agent PRD](../../obsidian/efforts/Matt/current/tool%20agent/tool-agent-prd.md)
- [Supabase MCP Documentation](../../apps/api/src/mcp/services/supabase/)
