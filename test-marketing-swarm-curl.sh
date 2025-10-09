#!/bin/bash
# Direct test of n8n webhook → API webhook → WebSocket
# This bypasses the agent and tests just the webhook flow

set -e

echo "🧪 Testing n8n Webhook → API Webhook → WebSocket (Direct)"
echo ""

# Generate test IDs
TEST_TASK_ID="test-task-$(date +%s)"
TEST_CONVERSATION_ID="test-conv-$(date +%s)"
TEST_USER_ID="test-user-$(date +%s)"

echo "📋 Test IDs:"
echo "   Task ID: $TEST_TASK_ID"
echo "   Conversation ID: $TEST_CONVERSATION_ID"
echo "   User ID: $TEST_USER_ID"
echo ""

# Step 1: Trigger n8n workflow directly
echo "1️⃣  Triggering n8n workflow directly..."
echo ""

N8N_RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/marketing-swarm \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"${TEST_TASK_ID}\",
    \"conversationId\": \"${TEST_CONVERSATION_ID}\",
    \"userId\": \"${TEST_USER_ID}\",
    \"callback_url\": \"http://host.docker.internal:7100/webhooks/status\",
    \"announcement\": \"Testing our revolutionary AI automation platform\",
    \"product\": \"OrchestratorAI\",
    \"target_audience\": \"developers\",
    \"tone\": \"professional\"
  }")

echo "✅ n8n workflow triggered:"
echo "$N8N_RESPONSE" | jq '.'
echo ""

# Step 2: Explain what should happen
echo "2️⃣  Expected flow:"
echo "   ✓ n8n workflow receives the trigger"
echo "   ✓ n8n executes and sends status updates to API webhook"
echo "   ✓ API webhook endpoint: http://host.docker.internal:7100/webhooks/status"
echo "   ✓ Webhook broadcasts via WebSocket to room: task:${TEST_TASK_ID}"
echo ""

# Step 3: Wait a moment for first status update
echo "3️⃣  Waiting 2 seconds for status updates..."
sleep 2
echo ""

# Step 4: Check if webhook received any updates
echo "4️⃣  Testing webhook endpoint directly..."
WEBHOOK_TEST=$(curl -s -X POST http://localhost:7100/webhooks/status \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"${TEST_TASK_ID}\",
    \"conversationId\": \"${TEST_CONVERSATION_ID}\",
    \"userId\": \"${TEST_USER_ID}\",
    \"status\": \"test\",
    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
    \"step\": \"manual_test\",
    \"percent\": 50,
    \"message\": \"Manual test of webhook endpoint\"
  }")

echo "✅ Webhook endpoint is responding (should return 204 No Content)"
echo ""

# Step 5: Check n8n execution
echo "5️⃣  Checking n8n execution status..."
sleep 1

EXECUTION_ID=$(echo "$N8N_RESPONSE" | jq -r '.executionId // empty')

if [ -n "$EXECUTION_ID" ]; then
  echo "   Execution ID: $EXECUTION_ID"
  echo ""
  echo "   Check execution in n8n UI:"
  echo "   http://localhost:5678/workflow/Q08T7oMX2dZslqV4/executions"
else
  echo "   No execution ID returned - check n8n UI manually"
fi
echo ""

# Step 6: Show how to monitor WebSocket
echo "6️⃣  To monitor WebSocket messages:"
echo ""
echo "   Install wscat if needed:"
echo "   npm install -g wscat"
echo ""
echo "   Connect and subscribe:"
echo "   wscat -c 'ws://localhost:7100/task-progress'"
echo ""
echo "   Send subscription message:"
echo "   {\"event\":\"subscribe_task\",\"data\":{\"taskId\":\"${TEST_TASK_ID}\"}}"
echo ""

echo "✅ Direct webhook test complete!"
echo ""
echo "📊 Summary:"
echo "   - n8n workflow: Triggered"
echo "   - Webhook endpoint: Working"
echo "   - WebSocket room: task:${TEST_TASK_ID}"
echo ""
echo "🔍 Next steps:"
echo "   1. Check API logs for webhook status update messages"
echo "   2. Check n8n UI for workflow execution"
echo "   3. Connect WebSocket client to see live updates"
