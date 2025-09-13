#!/bin/bash

# Test script for Metrics Agent SQL Generation
# This script authenticates with Supabase and tests the metrics agent

echo "🚀 Starting Metrics Agent SQL Generation Test"
echo "============================================"

# Load environment variables from project root
if [ -f ../../.env ]; then
  source ../../.env
  echo "✅ Loaded .env from project root"
else
  echo "⚠️ Warning: .env file not found"
fi

# Set test credentials
TEST_EMAIL="${SUPABASE_TEST_USER:-testuser@golfergeek.com}"
TEST_PASSWORD="${SUPABASE_TEST_PASSWORD:-testuser01!}"
API_BASE_URL="http://localhost:7100"

echo "📧 Test Email: $TEST_EMAIL"
echo "🌐 API URL: $API_BASE_URL"
echo ""

# Step 1: Authenticate and get JWT token
echo "🔐 Step 1: Authenticating with Supabase..."
AUTH_RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

# Extract access token using jq or grep
if command -v jq &> /dev/null; then
  AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.accessToken')
else
  AUTH_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$AUTH_TOKEN" ] || [ "$AUTH_TOKEN" = "null" ]; then
  echo "❌ Authentication failed!"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✅ Authentication successful!"
echo "Token: ${AUTH_TOKEN:0:20}..."
echo ""

# Step 2: Call Metrics Agent with revenue query
echo "📊 Step 2: Calling Metrics Agent with revenue query..."
TASK_RESPONSE=$(curl -s -X POST "$API_BASE_URL/agents/finance/metrics/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "method": "process",
    "prompt": "Give me all of the revenues by department",
    "conversationHistory": [],
    "llmSelection": {
      "providerName": "anthropic",
      "modelName": "claude-3-5-sonnet-20241022"
    },
    "metadata": {
      "userId": "test-user",
      "source": "bash-test"
    }
  }')

# Extract task ID
if command -v jq &> /dev/null; then
  TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.taskId')
  TASK_STATUS=$(echo "$TASK_RESPONSE" | jq -r '.status')
else
  TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"taskId":"[^"]*' | cut -d'"' -f4)
  TASK_STATUS=$(echo "$TASK_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
  echo "❌ Failed to create task!"
  echo "Response: $TASK_RESPONSE"
  exit 1
fi

echo "✅ Task created successfully!"
echo "Task ID: $TASK_ID"
echo "Initial Status: $TASK_STATUS"
echo ""

# Step 3: Poll for task completion
echo "⏳ Step 3: Waiting for task completion..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  sleep 2
  
  STATUS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/tasks/$TASK_ID" \
    -H "Authorization: Bearer $AUTH_TOKEN")
  
  if command -v jq &> /dev/null; then
    CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    RESPONSE_TEXT=$(echo "$STATUS_RESPONSE" | jq -r '.response')
  else
    CURRENT_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    RESPONSE_TEXT=$(echo "$STATUS_RESPONSE" | grep -o '"response":"[^"]*' | cut -d'"' -f4)
  fi
  
  echo -n "."
  
  if [ "$CURRENT_STATUS" = "completed" ] || [ "$CURRENT_STATUS" = "failed" ]; then
    echo ""
    echo "Final Status: $CURRENT_STATUS"
    break
  fi
  
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "📋 Step 4: Analyzing Response..."
echo "================================"

# Check if response contains SQL
if echo "$RESPONSE_TEXT" | grep -qi "SELECT"; then
  echo "✅ SQL found in response!"
  echo ""
  echo "Generated SQL:"
  echo "--------------"
  # Try to extract and format SQL
  SQL=$(echo "$RESPONSE_TEXT" | grep -o "SELECT[^;]*" | head -1)
  if [ ! -z "$SQL" ]; then
    echo "$SQL"
  else
    echo "$RESPONSE_TEXT"
  fi
else
  echo "⚠️ No SQL found in response"
  echo "Response: $RESPONSE_TEXT"
fi

echo ""
echo "🔍 Step 5: Validating SQL Structure..."
echo "======================================"

# Check for required SQL components
CHECKS_PASSED=0
TOTAL_CHECKS=6

# Check 1: Contains SELECT
if echo "$RESPONSE_TEXT" | grep -qi "SELECT"; then
  echo "✅ Contains SELECT statement"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing SELECT statement"
fi

# Check 2: Contains departments table
if echo "$RESPONSE_TEXT" | grep -qi "departments"; then
  echo "✅ References departments table"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing departments table"
fi

# Check 3: Contains kpi_data table
if echo "$RESPONSE_TEXT" | grep -qi "kpi_data"; then
  echo "✅ References kpi_data table"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing kpi_data table"
fi

# Check 4: Contains aggregation (SUM/COUNT)
if echo "$RESPONSE_TEXT" | grep -Ei "SUM\(|COUNT\("; then
  echo "✅ Contains aggregation function"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing aggregation function"
fi

# Check 5: Contains GROUP BY
if echo "$RESPONSE_TEXT" | grep -qi "GROUP BY"; then
  echo "✅ Contains GROUP BY clause"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing GROUP BY clause"
fi

# Check 6: Contains JOIN
if echo "$RESPONSE_TEXT" | grep -qi "JOIN"; then
  echo "✅ Contains JOIN clause"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo "❌ Missing JOIN clause"
fi

echo ""
echo "======================================"
echo "📊 Test Results: $CHECKS_PASSED/$TOTAL_CHECKS checks passed"

if [ $CHECKS_PASSED -eq $TOTAL_CHECKS ]; then
  echo "🎉 SUCCESS: All SQL validation checks passed!"
  echo ""
  echo "Expected revenue data:"
  echo "- Enterprise Accounts: 154775.0"
  echo "- Professional Services: 154775.0"
  echo "- Sales: 187185.0"
  exit 0
else
  echo "⚠️ WARNING: Some SQL validation checks failed"
  echo ""
  echo "Expected SQL structure should include:"
  echo "- SELECT with department name and revenue aggregation"
  echo "- FROM departments table"
  echo "- JOIN with kpi_data and kpi_metrics tables"
  echo "- WHERE clause filtering for revenue metrics"
  echo "- GROUP BY department"
  echo ""
  echo "Full Response:"
  echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
  exit 1
fi