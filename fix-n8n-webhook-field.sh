#!/bin/bash
# Fix n8n workflow to use statusWebhook instead of callback_url

set -e

echo "🔧 Fixing n8n workflow to use 'statusWebhook' field..."
echo ""

# Get the workflow
WORKFLOW=$(curl -s -X GET "http://localhost:5678/api/v1/workflows/Q08T7oMX2dZslqV4" \
  -H "Accept: application/json")

# Update all callback_url references to statusWebhook
UPDATED_WORKFLOW=$(echo "$WORKFLOW" | jq '
  .nodes |= map(
    if .type == "n8n-nodes-base.httpRequest" and .name | startswith("Send") then
      .parameters.url = "{{ $(\"Webhook Trigger\").item.json.statusWebhook || \"http://host.docker.internal:7100/webhooks/status\" }}"
    else
      .
    end
  )
')

# Save the updated workflow
echo "Updating workflow..."
curl -s -X PATCH "http://localhost:5678/api/v1/workflows/Q08T7oMX2dZslqV4" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$UPDATED_WORKFLOW" | jq '{id, name, active, updatedAt}'

echo ""
echo "✅ Workflow updated! All HTTP Request nodes now use 'statusWebhook' field."
echo ""
echo "📋 Field mapping:"
echo "   - statusWebhook → webhook URL for status updates"
echo "   - taskId → task identifier"
echo "   - conversationId → conversation identifier"
echo "   - userId → user identifier"
