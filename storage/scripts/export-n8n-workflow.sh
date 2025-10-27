#!/bin/bash
# Export a single N8N workflow to JSON file

set -e

WORKFLOW_NAME="$1"
OUTPUT_DIR="storage/snapshots/n8n"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$WORKFLOW_NAME" ]; then
  echo "Usage: npm run db:export-n8n <workflow-name>"
  echo "Example: npm run db:export-n8n 'Helper: LLM Task'"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting N8N workflow: $WORKFLOW_NAME"

# Sanitize workflow name for filename (replace spaces and special chars)
FILENAME=$(echo "$WORKFLOW_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9\-]//g')

# Export workflow as JSON
export PGPASSWORD=postgres
psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "
    SELECT json_build_object(
      'id', id,
      'name', name,
      'active', active,
      'nodes', nodes,
      'connections', connections,
      'settings', settings,
      'staticData', \"staticData\",
      'pinData', \"pinData\",
      'versionId', \"versionId\",
      'triggerCount', \"triggerCount\",
      'meta', meta
    )
    FROM n8n.workflow_entity
    WHERE name = '$WORKFLOW_NAME';
  " | jq '.' > "$OUTPUT_DIR/${FILENAME}.json"

if [ -f "$OUTPUT_DIR/${FILENAME}.json" ]; then
  echo "✅ Workflow exported to: $OUTPUT_DIR/${FILENAME}.json"
else
  echo "❌ Error: Failed to export workflow"
  exit 1
fi
