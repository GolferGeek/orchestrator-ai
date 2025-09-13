#!/bin/bash

echo "Testing Anthropic Thinking Extraction"
echo "======================================"
echo ""

# Load environment variables
source .env

# Test endpoint
API_URL="http://localhost:7100/llm/generate"

# Test 1: Simple thinking tags test
echo "Test 1: Testing with <thinking> tags"
echo "-------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a helpful assistant. Use <thinking> tags to show your reasoning process before giving your answer.",
    "userMessage": "What is 25 * 4? Show your work.",
    "options": {
      "temperature": 0.3,
      "maxTokens": 500,
      "includeMetadata": true
    }
  }' | jq '.'

echo ""
echo "Test 2: Testing with complex reasoning pattern"
echo "----------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a helpful assistant.",
    "userMessage": "Let me think about this problem: If a train travels 60 mph for 2 hours, then 80 mph for 3 hours, what is the total distance? First I need to calculate each segment.",
    "options": {
      "temperature": 0.3,
      "maxTokens": 500,
      "includeMetadata": true
    }
  }' | jq '.'

echo ""
echo "Test 3: Testing JSON response with thinking field"
echo "-------------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a helpful assistant. Always respond in JSON format with \"thinking\" and \"answer\" fields.",
    "userMessage": "What is the capital of France?",
    "options": {
      "temperature": 0.3,
      "maxTokens": 500,
      "includeMetadata": true
    }
  }' | jq '.'

echo ""
echo "Test 4: Testing Metrics Agent (should extract SQL thinking)"
echo "-----------------------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a SQL expert. Generate SQL queries based on user requests.",
    "userMessage": "Generate a SQL query to get all revenues by department from a sales table",
    "options": {
      "temperature": 0.1,
      "maxTokens": 1000,
      "includeMetadata": true
    }
  }' | jq '.metadata.thinking'

echo ""
echo "Test 5: Verify response content is clean (no thinking tags)"
echo "-----------------------------------------------------------"
curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "systemPrompt": "You are a helpful assistant. Use <thinking> tags to show your reasoning.",
    "userMessage": "What is 10 + 10?",
    "options": {
      "temperature": 0.3,
      "maxTokens": 200,
      "includeMetadata": true
    }
  }' | jq '.content'

echo ""
echo "Testing complete!"