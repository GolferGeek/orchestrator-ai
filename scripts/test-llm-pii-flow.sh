#!/bin/bash

echo "🧪 Testing LLM PII Flow End-to-End"
echo "==================================="

# Load environment variables
source .env

# API endpoint
API_URL="${VITE_API_BASE_URL:-http://localhost:3001}"

# Login to get JWT token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${SUPABASE_TEST_USER}\",
    \"password\": \"${SUPABASE_TEST_PASSWORD}\"
  }")

JWT_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .access_token // .token // empty')

if [ -z "$JWT_TOKEN" ]; then
  echo "❌ Failed to get JWT token"
  exit 1
fi

echo "✅ Got JWT token"
echo ""

# Test prompt with all 5 PII items
TEST_PROMPT="Can you check the status of my server at 192.168.1.1? The documentation is at http://internal-docs.company.com/wiki/setup. I wrote a blog post about Matt Weber. He is sometimes known as GolferGeek. He is the owner of Orchestrator AI."

echo "📝 Test prompt:"
echo "$TEST_PROMPT"
echo ""

# Call the LLM directly
echo "🤖 Calling LLM with PII in prompt..."
echo ""

LLM_RESPONSE=$(curl -s -X POST "${API_URL}/llm/generate" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"systemPrompt\": \"You are a helpful assistant. Be very concise.\",
    \"userPrompt\": \"$TEST_PROMPT\",
    \"options\": {
      \"provider\": \"openai\",
      \"providerName\": \"openai\",
      \"modelName\": \"gpt-4o-mini\",
      \"maxTokens\": 50,
      \"temperature\": 0.1,
      \"callerType\": \"pii-test\",
      \"callerName\": \"test-script\"
    }
  }")

# Check if we got an error
if echo "$LLM_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ LLM call failed:"
  echo "$LLM_RESPONSE" | jq '.'
  exit 1
fi

# Extract and display the response
echo "📤 LLM Response:"
echo "$LLM_RESPONSE" | jq -r '.content // .response // .data.content // "No content found"'
echo ""

# Check PII metadata
echo "🔍 PII Metadata:"
PII_METADATA=$(echo "$LLM_RESPONSE" | jq '.piiMetadata // .metadata.piiMetadata // {}')

if [ "$PII_METADATA" != "{}" ]; then
  echo "$PII_METADATA" | jq '.'
  
  # Extract specific values
  PII_DETECTED=$(echo "$PII_METADATA" | jq -r '.piiDetected // false')
  FLAGGINGS=$(echo "$PII_METADATA" | jq -r '.flaggings // []')
  PSEUDONYMS=$(echo "$PII_METADATA" | jq -r '.pseudonymsApplied // .pseudonyms // []')
  
  echo ""
  echo "📊 Summary:"
  echo "  - PII Detected: $PII_DETECTED"
  echo "  - Flaggings: $(echo "$FLAGGINGS" | jq 'length') items"
  echo "  - Pseudonyms Applied: $(echo "$PSEUDONYMS" | jq 'length') items"
  
  if [ "$(echo "$FLAGGINGS" | jq 'length')" -gt 0 ]; then
    echo ""
    echo "  🚩 Flagged items:"
    echo "$FLAGGINGS" | jq -r '.[] | "    - \(.type): \(.value)"'
  fi
  
  if [ "$(echo "$PSEUDONYMS" | jq 'length')" -gt 0 ]; then
    echo ""
    echo "  🎭 Pseudonymized items:"
    echo "$PSEUDONYMS" | jq -r '.[] | "    - \(.original) → \(.pseudonym)"'
  fi
else
  echo "⚠️  No PII metadata found in response"
fi

echo ""
echo "🔍 Checking usage metadata:"
USAGE=$(echo "$LLM_RESPONSE" | jq '.metadata.usage // {}')
if [ "$USAGE" != "{}" ]; then
  echo "  - PII Detected: $(echo "$USAGE" | jq -r '.piiDetected // "N/A"')"
  echo "  - PII Types: $(echo "$USAGE" | jq -r '.piiTypes // [] | join(", ")')"
  echo "  - Pseudonyms Used: $(echo "$USAGE" | jq -r '.pseudonymsUsed // 0')"
  echo "  - Redactions Applied: $(echo "$USAGE" | jq -r '.redactionsApplied // 0')"
fi