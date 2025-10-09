#!/bin/bash
# Fix n8n workflow expressions to properly read webhook trigger data

set -e

source apps/n8n/.env

echo "🔧 Fixing Marketing Swarm workflow expressions..."
echo ""

# Get the current workflow
WORKFLOW=$(curl -s -X GET "http://localhost:5678/api/v1/workflows/Q08T7oMX2dZslqV4" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Accept: application/json")

# Update the workflow using jq to fix all the expression references
FIXED_WORKFLOW=$(echo "$WORKFLOW" | jq '
  .nodes |= map(
    if .name == "Status: Started" then
      .parameters.assignments.assignments |= map(
        if .name == "taskId" then
          .value = "={{ $input.first().json.taskId }}"
        elif .name == "conversationId" then
          .value = "={{ $input.first().json.conversationId }}"
        elif .name == "userId" then
          .value = "={{ $input.first().json.userId }}"
        else
          .
        end
      )
    elif .name == "Status: Web Post Done" then
      .parameters.assignments.assignments |= map(
        if .name == "taskId" then
          .value = "={{ $input.first().json.taskId }}"
        elif .name == "conversationId" then
          .value = "={{ $input.first().json.conversationId }}"
        elif .name == "userId" then
          .value = "={{ $input.first().json.userId }}"
        else
          .
        end
      )
    elif .name == "Status: SEO Done" then
      .parameters.assignments.assignments |= map(
        if .name == "taskId" then
          .value = "={{ $input.first().json.taskId }}"
        elif .name == "conversationId" then
          .value = "={{ $input.first().json.conversationId }}"
        elif .name == "userId" then
          .value = "={{ $input.first().json.userId }}"
        else
          .
        end
      )
    elif .name == "Status: Social Done" then
      .parameters.assignments.assignments |= map(
        if .name == "taskId" then
          .value = "={{ $input.first().json.taskId }}"
        elif .name == "conversationId" then
          .value = "={{ $input.first().json.conversationId }}"
        elif .name == "userId" then
          .value = "={{ $input.first().json.userId }}"
        else
          .
        end
      )
    elif .name == "Final Output" then
      .parameters.assignments.assignments |= map(
        if .name == "taskId" then
          .value = "={{ $input.first().json.taskId }}"
        else
          .
        end
      )
    else
      .
    end
  )
')

# Update the workflow via API
echo "📤 Updating workflow via n8n API..."
curl -s -X PATCH "http://localhost:5678/api/v1/workflows/Q08T7oMX2dZslqV4" \
  -H "X-N8N-API-KEY: ${N8N_API_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$FIXED_WORKFLOW" | jq '{id, name, updatedAt, active}'

echo ""
echo "✅ Workflow expressions fixed!"
echo ""
echo "📋 Changes made:"
echo "   - Status: Started → Fixed taskId, conversationId, userId"
echo "   - Status: Web Post Done → Fixed taskId, conversationId, userId"
echo "   - Status: SEO Done → Fixed taskId, conversationId, userId"
echo "   - Status: Social Done → Fixed taskId, conversationId, userId"
echo "   - Final Output → Fixed taskId"
echo ""
echo "🧪 Test the workflow:"
echo "   ./test-marketing-swarm-curl.sh"
