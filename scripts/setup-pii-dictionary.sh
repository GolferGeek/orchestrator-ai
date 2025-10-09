#!/bin/bash

echo "🔧 Setting up PII Dictionary Entries..."
echo "======================================="

# Load environment variables
source .env

# Connect to database and insert dictionary entries
echo "📝 Adding pseudonym dictionary entries to database..."

PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << EOF

-- First, check if entries already exist
SELECT COUNT(*) as existing_count FROM pseudonym_dictionaries 
WHERE original_value IN ('Matthew Weber', 'Matt Weber', 'GolferGeek', 'Orchestrator AI');

-- Delete existing entries to avoid duplicates
DELETE FROM pseudonym_dictionaries 
WHERE original_value IN ('Matthew Weber', 'Matt Weber', 'GolferGeek', 'Orchestrator AI');

-- Insert the three entries we need
INSERT INTO pseudonym_dictionaries (
  original_value, 
  pseudonym, 
  data_type, 
  category, 
  is_active,
  created_at,
  updated_at
) VALUES 
  ('Matthew Weber', 'PERSON_001', 'person_name', 'test', true, NOW(), NOW()),
  ('Matt Weber', 'PERSON_001', 'person_name', 'test', true, NOW(), NOW()),
  ('GolferGeek', 'USERNAME_001', 'username', 'test', true, NOW(), NOW()),
  ('Orchestrator AI', 'COMPANY_001', 'organization', 'test', true, NOW(), NOW())
ON CONFLICT (original_value) DO UPDATE
SET 
  pseudonym = EXCLUDED.pseudonym,
  data_type = EXCLUDED.data_type,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = NOW();

-- Verify the entries were added
SELECT original_value, pseudonym, data_type, category, is_active 
FROM pseudonym_dictionaries 
WHERE original_value IN ('Matthew Weber', 'Matt Weber', 'GolferGeek', 'Orchestrator AI');

EOF

echo ""
echo "✅ Dictionary entries added successfully!"
echo ""
echo "Now testing with the API..."

# API endpoint
API_URL="${VITE_API_BASE_URL:-http://localhost:3001}"

# Login to get JWT token
echo "🔐 Logging in to get JWT token..."
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

# Test the sanitization
echo ""
echo "🧪 Testing PII detection with our test prompt..."

TEST_PROMPT="Can you check the status of my server at 192.168.1.1? The documentation is at http://internal-docs.company.com/wiki/setup. I wrote a blog post about Matt Weber. He is sometimes known as GolferGeek. He is the owner of Orchestrator AI. It was a great post!"

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

# Check if the sanitized text has replacements
SANITIZED_TEXT=$(echo "$SANITIZE_RESULT" | jq -r '.sanitizedText // ""')

echo ""
echo "🔍 Checking replacements in sanitized text:"
if [[ "$SANITIZED_TEXT" == *"[IP_ADDRESS_REDACTED]"* ]]; then
  echo "  ✅ IP address was redacted"
else
  echo "  ❌ IP address was NOT redacted"
fi

if [[ "$SANITIZED_TEXT" == *"[INTERNAL_URL_REDACTED]"* ]]; then
  echo "  ✅ Internal URL was redacted"
else
  echo "  ❌ Internal URL was NOT redacted"
fi

if [[ "$SANITIZED_TEXT" == *"PERSON_001"* ]]; then
  echo "  ✅ Matt Weber was replaced with PERSON_001"
else
  echo "  ❌ Matt Weber was NOT replaced"
fi

if [[ "$SANITIZED_TEXT" == *"USERNAME_001"* ]]; then
  echo "  ✅ GolferGeek was replaced with USERNAME_001"
else
  echo "  ❌ GolferGeek was NOT replaced"
fi

if [[ "$SANITIZED_TEXT" == *"COMPANY_001"* ]]; then
  echo "  ✅ Orchestrator AI was replaced with COMPANY_001"
else
  echo "  ❌ Orchestrator AI was NOT replaced"
fi

echo ""
if [ "$REDACTIONS" -ge 2 ] && [ "$PSEUDONYMS" -ge 3 ]; then
  echo "✅ All PII detection tests passed!"
else
  echo "⚠️  PII detection not fully working yet"
fi