#!/bin/bash

echo "🔧 Setting up PII test data..."
echo "================================"

# Load environment variables
source .env

# API endpoint
API_URL="${VITE_API_BASE_URL:-http://localhost:3001}"

# First, login to get JWT token
echo "🔐 Logging in to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${SUPABASE_TEST_USER}\",
    \"password\": \"${SUPABASE_TEST_PASSWORD}\"
  }")

# Extract JWT token
JWT_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken // .access_token // .token // .data.token // .data.access_token // empty')

if [ -z "$JWT_TOKEN" ]; then
  echo "❌ Failed to get JWT token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Got JWT token"

# Add pseudonym dictionary entries
echo ""
echo "📝 Adding pseudonym dictionary entries..."

# Add Matthew Weber -> Matt Weber
echo "  Adding: Matthew Weber"
curl -s -X POST "${API_URL}/llm/sanitization/pseudonym/dictionary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "originalValue": "Matthew Weber",
    "pseudonym": "PERSON_001",
    "dataType": "person_name",
    "context": "test",
    "isActive": true
  }' | jq -r '.message // .error // "Entry added"'

curl -s -X POST "${API_URL}/llm/sanitization/pseudonym/dictionary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "originalValue": "Matt Weber",
    "pseudonym": "PERSON_001",
    "dataType": "person_name",
    "context": "test",
    "isActive": true
  }' | jq -r '.message // .error // "Entry added"'

# Add GolferGeek
echo "  Adding: GolferGeek"
curl -s -X POST "${API_URL}/llm/sanitization/pseudonym/dictionary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "originalValue": "GolferGeek",
    "pseudonym": "USERNAME_001",
    "dataType": "username",
    "context": "test",
    "isActive": true
  }' | jq -r '.message // .error // "Entry added"'

# Add Orchestrator AI
echo "  Adding: Orchestrator AI"
curl -s -X POST "${API_URL}/llm/sanitization/pseudonym/dictionary" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "originalValue": "Orchestrator AI",
    "pseudonym": "COMPANY_001",
    "dataType": "organization",
    "context": "test",
    "isActive": true
  }' | jq -r '.message // .error // "Entry added"'

echo ""
echo "🔍 Checking PII patterns configuration..."

# Get current PII patterns
PATTERNS=$(curl -s -X GET "${API_URL}/llm/sanitization/pii/patterns" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

echo "Current patterns count: $(echo $PATTERNS | jq -r '.patterns | length // 0')"

# Check if we have IP and URL patterns
HAS_IP=$(echo $PATTERNS | jq -r '.patterns[] | select(.name == "ipAddress") // empty')
HAS_URL=$(echo $PATTERNS | jq -r '.patterns[] | select(.name == "url") // empty')

if [ -z "$HAS_IP" ]; then
  echo "  ⚠️  No IP address pattern found - adding..."
  curl -s -X POST "${API_URL}/llm/sanitization/pii/patterns" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "ipAddress",
      "pattern": "\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b",
      "type": "ip_address",
      "description": "IP Address pattern",
      "isActive": true,
      "severity": "high"
    }' | jq -r '.message // .error // "Pattern added"'
else
  echo "  ✅ IP address pattern exists"
fi

if [ -z "$HAS_URL" ]; then
  echo "  ⚠️  No URL pattern found - adding..."
  curl -s -X POST "${API_URL}/llm/sanitization/pii/patterns" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "url",
      "pattern": "https?://[\\w.-]+(?:\\.[\\w\\.-]+)+[\\w\\-\\._~:/?#[\\]@!\\$&'"'"'\\(\\)\\*\\+,;=.]+",
      "type": "url",
      "description": "URL pattern",
      "isActive": true,
      "severity": "medium"
    }' | jq -r '.message // .error // "Pattern added"'
else
  echo "  ✅ URL pattern exists"
fi

echo ""
echo "🧪 Testing PII detection with our test prompt..."

TEST_PROMPT="Can you check the status of my server at 192.168.1.1? The documentation is at http://internal-docs.company.com/wiki/setup. I wrote a blog post about Matt Weber. He is sometimes known as GolferGeek. He is the owner of Orchestrator AI. It was a great post!"

# Test the sanitization endpoint
SANITIZE_RESULT=$(curl -s -X POST "${API_URL}/llm/sanitization/test" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": \"$TEST_PROMPT\",
    \"enableRedaction\": true,
    \"enablePseudonymization\": true
  }")

echo "Sanitization test result:"
echo "$SANITIZE_RESULT" | jq '.'

# Extract counts
REDACTIONS=$(echo "$SANITIZE_RESULT" | jq -r '.result.redactionResult.redactionCount // 0')
PSEUDONYMS=$(echo "$SANITIZE_RESULT" | jq -r '.result.pseudonymizationResult.pseudonyms | length // 0')

echo ""
echo "📊 Summary:"
echo "  - Redactions applied: $REDACTIONS (expected: 2 - IP and URL)"
echo "  - Pseudonyms used: $PSEUDONYMS (expected: 3 - Matt Weber, GolferGeek, Orchestrator AI)"

if [ "$REDACTIONS" -ge 2 ] && [ "$PSEUDONYMS" -ge 3 ]; then
  echo ""
  echo "✅ All PII detection tests passed!"
else
  echo ""
  echo "⚠️  PII detection not fully working yet"
  echo "  Please check the configuration and try again"
fi