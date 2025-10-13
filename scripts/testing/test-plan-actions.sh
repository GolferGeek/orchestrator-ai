#!/bin/bash

# Test all 9 Plan actions for blog_post_writer
# Prerequisites: API running on localhost:7100

ORG="my-org"
AGENT="blog_post_writer"
API_URL="http://localhost:7100"
CONVERSATION_ID=""

echo "🧪 Testing Plan Actions for $AGENT"
echo "=================================="

# Get auth token
echo ""
echo "🔐 Getting auth token..."
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  \
  -d @login.json | jq -r '.accessToken')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi
echo "✅ Got auth token"

# 0. Create Conversation First
echo ""
echo "0️⃣  Creating conversation..."
CONV_RESPONSE=$(curl -s -X POST "$API_URL/agent-conversations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"agentName\": \"$AGENT\",
    \"agentType\": \"context\",
    \"namespace\": \"$ORG\"
  }")
echo "Conversation response: $CONV_RESPONSE"
CONVERSATION_ID=$(echo $CONV_RESPONSE | jq -r '.id')
echo "Conversation ID: $CONVERSATION_ID"

if [ -z "$CONVERSATION_ID" ] || [ "$CONVERSATION_ID" == "null" ]; then
  echo "❌ Failed to create conversation"
  exit 1
fi

# 1. Create Plan
echo ""
echo "1️⃣  Testing: Plan Create"
RESPONSE=$(curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"mode\": \"plan\",
    \"action\": \"create\",
    \"conversationId\": \"$CONVERSATION_ID\",
    \"message\": \"Create a blog post about AI testing strategies\"
  }")
echo "Response: $RESPONSE" | jq '.'
PLAN_ID=$(echo $RESPONSE | jq -r '.payload.content.plan.id // .plan.id // .planId // empty')
echo "Plan ID: $PLAN_ID"

# Verify plan was created
if [ -z "$PLAN_ID" ] || [ "$PLAN_ID" == "null" ]; then
  echo "❌ No plan ID returned, cannot continue"
  exit 1
fi

# 2. List Plans
echo ""
echo "2️⃣  Testing: Plan List"
curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"mode\": \"plan\",
    \"action\": \"list\",
    \"conversationId\": \"$CONVERSATION_ID\"
  }" | jq '.'

# 3. Get Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "3️⃣  Testing: Plan Get"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"get\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\"
    }" | jq '.'
fi

# 4. Update Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "4️⃣  Testing: Plan Update"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"update\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\",
      \"message\": \"Add more details about unit testing\"
    }" | jq '.'
fi

# 5. Approve Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "5️⃣  Testing: Plan Approve"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"approve\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\"
    }" | jq '.'
fi

# 6. Reject Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "6️⃣  Testing: Plan Reject"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"reject\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\",
      \"message\": \"Too complex, simplify\"
    }" | jq '.'
fi

# 7. Archive Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "7️⃣  Testing: Plan Archive"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"archive\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\"
    }" | jq '.'
fi

# 8. Restore Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "8️⃣  Testing: Plan Restore"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"restore\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\"
    }" | jq '.'
fi

# 9. Delete Plan
if [ -n "$PLAN_ID" ]; then
  echo ""
  echo "9️⃣  Testing: Plan Delete"
  curl -s -X POST "$API_URL/agent-to-agent/$ORG/$AGENT/tasks" \
    -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"mode\": \"plan\",
      \"action\": \"delete\",
      \"conversationId\": \"$CONVERSATION_ID\",
      \"planId\": \"$PLAN_ID\"
    }" | jq '.'
fi

echo ""
echo "✅ Test complete!"
