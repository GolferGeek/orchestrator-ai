#!/bin/bash

# Test direct call to metrics agent - no auth required for testing
echo "🚀 Testing Direct Metrics Agent Call"
echo "====================================="
echo ""

# Test without auth - let's see what happens
echo "📊 Calling metrics agent at /agents/finance/metrics/tasks..."
echo ""

RESPONSE=$(curl -s -X POST "http://localhost:7100/agents/finance/metrics/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "method": "process",
    "prompt": "Give me all of the revenues by department",
    "conversationId": "test-conversation-123",
    "conversationHistory": [],
    "metadata": {
      "providerName": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022"
    }
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "====================================="
echo "Note: If you get 401 Unauthorized, you need a valid auth token"
echo "The key finding is whether the agent is properly registered at this endpoint"