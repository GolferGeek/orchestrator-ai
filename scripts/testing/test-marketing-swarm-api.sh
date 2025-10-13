#!/bin/bash
# Test Marketing Swarm via API endpoint
# This tests: Frontend → API → Agent → n8n → Webhook → WebSocket

set -e

echo "🧪 Testing Marketing Swarm via API..."
echo ""

# Load environment variables
source .env

# Step 1: Login and get token
echo "1️⃣  Logging in as ${SUPABASE_TEST_USER}..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:7100/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${SUPABASE_TEST_USER}\",
    \"password\": \"${SUPABASE_TEST_PASSWORD}\"
  }")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Step 2: Create or get a conversation
echo "2️⃣  Creating agent conversation..."
CONVERSATION_RESPONSE=$(curl -s -X POST http://localhost:7100/agent-conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "agentName": "Marketing Swarm",
    "agentType": "marketing",
    "metadata": {
      "test": true,
      "testType": "api-test"
    }
  }')

CONVERSATION_ID=$(echo "$CONVERSATION_RESPONSE" | jq -r '.id')

if [ "$CONVERSATION_ID" = "null" ] || [ -z "$CONVERSATION_ID" ]; then
  echo "❌ Failed to create conversation!"
  echo "$CONVERSATION_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Conversation created: $CONVERSATION_ID"
echo ""

# Step 3: Trigger the marketing-swarm agent
echo "3️⃣  Triggering marketing-swarm agent..."
echo "📝 Request: Create marketing content for AI automation launch"
echo ""

TASK_RESPONSE=$(curl -s -X POST "http://localhost:7100/agent-conversations/${CONVERSATION_ID}/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "method": "execute",
    "prompt": "Create marketing content for our revolutionary AI automation platform launch targeting developers and business leaders",
    "params": {
      "product": "OrchestratorAI",
      "target_audience": "developers and business leaders",
      "tone": "professional but exciting"
    }
  }')

TASK_ID=$(echo "$TASK_RESPONSE" | jq -r '.taskId')
AGENT_NAME=$(echo "$TASK_RESPONSE" | jq -r '.agentName')

echo "✅ Task created:"
echo "   Task ID: $TASK_ID"
echo "   Agent: $AGENT_NAME"
echo "   Conversation: $CONVERSATION_ID"
echo ""

# Step 4: Show what to expect
echo "4️⃣  Expected flow:"
echo "   ✓ Agent triggers n8n workflow"
echo "   ✓ n8n sends status updates to http://host.docker.internal:7100/webhooks/status"
echo "   ✓ Webhook broadcasts via WebSocket to room: task:${TASK_ID}"
echo "   ✓ UI receives real-time progress updates"
echo ""

echo "📊 Response from agent:"
echo "$TASK_RESPONSE" | jq '{
  taskId,
  conversationId,
  agentName,
  executionId: .metadata.executionId,
  status,
  statusUpdatesVia: .metadata.statusUpdatesVia
}'
echo ""

echo "🎯 To monitor WebSocket messages in real-time, use:"
echo "   wscat -c 'ws://localhost:7100/task-progress?token=$TOKEN'"
echo "   Then subscribe: {\"event\":\"subscribe_task\",\"data\":{\"taskId\":\"$TASK_ID\"}}"
echo ""

echo "✅ Test complete! Check your UI for real-time updates."
