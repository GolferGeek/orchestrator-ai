# MCP Supabase Server Test Suite

This directory contains a comprehensive test suite for the Supabase MCP server implementation. It tests the complete MCP protocol flow using HTTP transport.

## Overview

The test suite includes:
- **HTTP Server Controller** (`supabase-mcp.controller.ts`) - Exposes MCP server via REST endpoints
- **Test Client** (`test-client.ts`) - Uses MCPClientService to test all functionality  
- **Test Runner** (`run-tests.ts`) - Orchestrates the complete test process

## What Gets Tested

### ✅ Core MCP Protocol
- Server registration and connection
- Tool discovery and execution
- Resource and prompt management
- Health monitoring
- Error handling and validation

### ✅ All 5 Supabase Tools
- `get-schema` - Database schema introspection
- `generate-sql` - Natural language to SQL (if LLM configured)
- `execute-sql` - Safe SQL query execution  
- `query-and-format` - Complete workflow tool
- `read-data` - Simple data reading with filters

### ✅ Transport Layer
- HTTP request/response handling
- Progress tracking via callbacks
- Authentication (if configured)
- Timeout and retry logic

## Prerequisites

### Environment Variables
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"

# Optional
export MCP_TEST_PORT="3001"
```

### Database Setup
Ensure your Supabase database has at least one table (e.g., `users`) for testing. The tests will:
- Read schema information
- Execute simple queries
- Test data retrieval

## Running the Tests

### Option 1: Full Test Suite (Recommended)
```bash
# From the API root directory
npm run ts-node src/mcp/servers/supabase/test/run-tests.ts
```

### Option 2: Manual Testing
```bash
# Terminal 1: Start the server
npm run ts-node src/mcp/servers/supabase/test/supabase-mcp.controller.ts

# Terminal 2: Run the test client  
npm run ts-node src/mcp/servers/supabase/test/test-client.ts
```

### Option 3: Individual Components

#### Test just the HTTP controller
```bash
curl -X POST http://localhost:3001/mcp/supabase/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "supabaseUrl": "your-url",
    "supabaseKey": "your-key",
    "enableCaching": true,
    "cacheTTL": 300000,
    "maxQueryTimeout": 30000,
    "sqlModels": ["gpt-4"]
  }'
```

#### Test a specific tool
```bash
curl -X POST http://localhost:3001/mcp/supabase/tools/get-schema \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"format": "summary"}}'
```

## Expected Output

### Successful Test Run
```
🧪 MCP SUPABASE SERVER TEST SUITE
════════════════════════════════════════════════════════════
🚀 Starting test server...
✅ Test server running on http://localhost:3001

🚀 Starting MCP Test Suite...

📡 Setting up MCP server connection...
✅ Server initialized: Supabase MCP Server initialized successfully

📋 Testing server info and capabilities...
  📊 Server info: { name: 'Test Supabase MCP Server', state: 'connected', health: 'healthy' }
  💚 Health check passed

🔧 Testing MCP tools...
  📊 Get Schema - Success
  📖 Read Data - Success
  🤖 Generate SQL - Expected failure (LLM not configured)
  ⚡ Execute SQL - Success

📁 Testing resources...
  📁 List Resources - Tested

💭 Testing prompts...
  💭 List Prompts - Tested

⚠️  Testing error handling...
  ✅ Invalid tool correctly rejected
  ✅ Invalid arguments correctly handled

📊 Test Results Summary:
══════════════════════════════════════════════════════════
✅ PASS server_setup (1250ms)
✅ PASS server_info (45ms)
✅ PASS health_check (23ms)
✅ PASS tool_get_schema (156ms)
✅ PASS tool_read_data (89ms)
✅ PASS tool_generate_sql (12ms)
✅ PASS tool_execute_sql (67ms)
✅ PASS invalid_tool (8ms)
✅ PASS invalid_arguments (34ms)
══════════════════════════════════════════════════════════
📈 Summary: 9 passed, 0 failed
🎉 All tests passed! MCP implementation is working correctly.
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Check if your Supabase project is active
- Ensure the anon key has appropriate permissions

#### Tool Execution Failures
- `generate-sql` will fail without proper LLM service configuration (this is expected)
- `read-data` requires at least one table in your database
- `execute-sql` requires basic query permissions

#### Port Conflicts
- Change `MCP_TEST_PORT` if port 3001 is in use
- Update the client URL accordingly

### Debug Mode
Add debug logging by setting:
```bash
export DEBUG="mcp:*"
```

## Integration Testing

This test suite validates that:
- ✅ MCP protocol implementation is correct
- ✅ HTTP transport layer works properly  
- ✅ Supabase integration functions correctly
- ✅ Error handling is robust
- ✅ All tools execute without crashing

Once these tests pass, you can confidently integrate the MCP system with actual agents knowing the foundational layer works correctly.

## Next Steps

After successful testing:
1. Integrate MCP client into `FunctionAgentBaseService`
2. Convert Metrics Agent to use MCP for database operations
3. Add authentication and production configuration
4. Create additional MCP servers for other data sources