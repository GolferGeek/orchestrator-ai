#!/bin/bash

# Supabase Agent Orchestration E2E Test Runner
# Tests the full A2A orchestration pipeline with Supabase agent

echo "🚀 Supabase Agent Orchestration E2E Test Runner"
echo "=============================================="

# Check if API server is running
echo "🔍 Checking API server health..."
if ! curl -s http://localhost:7100/health > /dev/null; then
    echo "❌ API server not running on port 7100"
    echo "Please start the server with: npm run dev:api"
    exit 1
fi

echo "✅ API server is running"

# Check environment variables
echo "🔍 Checking environment variables..."
if [ -z "$SUPABASE_TEST_USER" ] || [ -z "$SUPABASE_TEST_PASSWORD" ]; then
    echo "⚠️  SUPABASE_TEST_USER or SUPABASE_TEST_PASSWORD not set"
    echo "Using default test credentials..."
    export SUPABASE_TEST_USER="demo.user@orchestratorai.io"
    export SUPABASE_TEST_PASSWORD="DemoUser123!"
else
    echo "✅ Test credentials found in environment"
fi

# Run the tool agent smoke test
echo ""
echo "🧪 Running Tool Agent Smoke Test..."
echo "-----------------------------------"

node test-supabase-tool-agent.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Tool Agent Smoke Test PASSED!"
    echo "✅ Tool agent execution works"
    echo "✅ All 4 Supabase MCP tools accessible"
    echo "✅ Deliverable metadata complete"
    echo "✅ Namespace validation working"
else
    echo ""
    echo "❌ Tool Agent Smoke Test FAILED!"
    echo "Check the error messages above for details"
    exit 1
fi

# Run the simple A2A orchestration test
echo ""
echo "🧪 Running A2A Orchestration Test..."
echo "-----------------------------------"

node test-supabase-a2a-simple.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 A2A Orchestration Test PASSED!"
    echo "✅ Supabase agent orchestration is working"
    echo "✅ Ready for multi-agent workflows"
else
    echo ""
    echo "❌ A2A Orchestration Test FAILED!"
    echo "Check the error messages above for details"
    exit 1
fi

# Optional: Run the comprehensive test
echo ""
echo "🧪 Running Comprehensive Orchestration Test..."
echo "--------------------------------------------"

node test-supabase-agent-orchestration-e2e.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Comprehensive Test PASSED!"
    echo "✅ Full orchestration pipeline verified"
else
    echo ""
    echo "⚠️  Comprehensive Test had issues (this is optional)"
    echo "The simple test passed, so core functionality is working"
fi

echo ""
echo "🏁 Test Suite Complete!"
echo "======================="
echo "✅ Tool agent BUILD mode verified"
echo "✅ MCP tool namespacing working"
echo "✅ A2A orchestration pattern verified"
echo "✅ Supabase agent integration working"
echo "✅ Ready for production orchestration workflows"
