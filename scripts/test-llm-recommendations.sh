#!/bin/bash

# Test LLM Recommendations Endpoint
# This script tests the /evaluation/agents/:agentIdentifier/llm-recommendations endpoint

API_URL=${API_URL:-"http://localhost:7100"}
AGENT_ID=${1:-"marketing_swarm"}
MIN_RATING=${2:-3}

echo "Testing LLM Recommendations for agent: $AGENT_ID"
echo "API URL: $API_URL"
echo "Minimum Rating: $MIN_RATING"
echo ""

# First, we need to authenticate
echo "Step 1: Authenticating..."

# Create a test user if needed (using Supabase direct API)
SUPABASE_URL="http://localhost:7010"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Try to sign up a test user (will fail if already exists)
echo "Creating/signing in test user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-llm-eval@example.com",
    "password": "TestPassword123!"
  }')

# Try to sign in
echo "Signing in..."
SIGNIN_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-llm-eval@example.com",
    "password": "TestPassword123!"
  }')

# Extract access token
ACCESS_TOKEN=$(echo $SIGNIN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "Failed to authenticate. Response:"
    echo $SIGNIN_RESPONSE | jq
    echo ""
    echo "Alternative: Use the API's auth endpoint directly"

    # Try the API's auth endpoint
    echo "Attempting API login..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "demo.user@playground.com",
        "password": "demo123"
      }')

    ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

    if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
        echo "Authentication failed. Please ensure you have a valid user account."
        echo "Response: $LOGIN_RESPONSE"
        exit 1
    fi
fi

echo "Successfully authenticated!"
echo ""

# Step 2: Call the LLM recommendations endpoint
echo "Step 2: Getting LLM recommendations for agent '$AGENT_ID'..."
echo ""

RESPONSE=$(curl -s -X GET "$API_URL/evaluation/agents/$AGENT_ID/llm-recommendations?minRating=$MIN_RATING" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json")

echo "Response:"
echo $RESPONSE | jq

# Check if the response is as expected
if echo $RESPONSE | jq -e '.[0].modelName' > /dev/null 2>&1; then
    echo ""
    echo "✅ Success! Found recommendations:"
    echo $RESPONSE | jq -r '.[] | "- \(.modelName // .modelId) (Provider: \(.providerName // .providerId)) - Rating: \(.averageRating) (\(.evaluationCount) evaluations)"'

    # Check for specific model
    if echo $RESPONSE | jq -e '.[] | select(.modelName == "ollama/gpt-oss:20b" or .modelId == "ollama/gpt-oss:20b")' > /dev/null 2>&1; then
        echo ""
        echo "✅ Found expected model: ollama/gpt-oss:20b"
    else
        echo ""
        echo "⚠️  Did not find expected model: ollama/gpt-oss:20b"
        echo "Models found:"
        echo $RESPONSE | jq -r '.[].modelName // .[].modelId' | sort -u
    fi
else
    echo ""
    echo "❌ Unexpected response format or error"
fi

echo ""
echo "Test complete!"