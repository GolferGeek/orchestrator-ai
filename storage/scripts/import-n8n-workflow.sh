#!/bin/bash
# Import a single N8N workflow from JSON file

set -e

WORKFLOW_FILE="$1"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$WORKFLOW_FILE" ]; then
  echo "Usage: npm run db:import-n8n <path-to-workflow.json>"
  echo "Example: npm run db:import-n8n storage/snapshots/n8n/helper-llm-task.json"
  exit 1
fi

if [ ! -f "$WORKFLOW_FILE" ]; then
  echo "❌ Error: File not found: $WORKFLOW_FILE"
  exit 1
fi

echo "📥 Importing N8N workflow from: $WORKFLOW_FILE"

# Read JSON and extract fields
WORKFLOW_JSON=$(cat "$WORKFLOW_FILE")

ID=$(echo "$WORKFLOW_JSON" | jq -r '.id')
NAME=$(echo "$WORKFLOW_JSON" | jq -r '.name')
ACTIVE=$(echo "$WORKFLOW_JSON" | jq -r '.active')
NODES=$(echo "$WORKFLOW_JSON" | jq -c '.nodes')
CONNECTIONS=$(echo "$WORKFLOW_JSON" | jq -c '.connections')
SETTINGS=$(echo "$WORKFLOW_JSON" | jq -c '.settings // {}')
STATIC_DATA=$(echo "$WORKFLOW_JSON" | jq -c '.staticData // {}')
PIN_DATA=$(echo "$WORKFLOW_JSON" | jq -c '.pinData // null')
VERSION_ID=$(echo "$WORKFLOW_JSON" | jq -r '.versionId // null')
TRIGGER_COUNT=$(echo "$WORKFLOW_JSON" | jq -r '.triggerCount // 0')
META=$(echo "$WORKFLOW_JSON" | jq -c '.meta // null')

# Escape single quotes in JSON strings for SQL
NAME=$(echo "$NAME" | sed "s/'/''/g")
NODES=$(echo "$NODES" | sed "s/'/''/g")
CONNECTIONS=$(echo "$CONNECTIONS" | sed "s/'/''/g")
SETTINGS=$(echo "$SETTINGS" | sed "s/'/''/g")
STATIC_DATA=$(echo "$STATIC_DATA" | sed "s/'/''/g")

if [ "$PIN_DATA" != "null" ]; then
  PIN_DATA=$(echo "$PIN_DATA" | sed "s/'/''/g")
  PIN_DATA_SQL="'$PIN_DATA'::json"
else
  PIN_DATA_SQL="NULL"
fi

if [ "$META" != "null" ]; then
  META=$(echo "$META" | sed "s/'/''/g")
  META_SQL="'$META'::json"
else
  META_SQL="NULL"
fi

if [ "$VERSION_ID" = "null" ]; then
  VERSION_ID_SQL="NULL"
else
  VERSION_ID_SQL="'$VERSION_ID'"
fi

# Insert or update workflow
export PGPASSWORD=postgres
psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "
    INSERT INTO n8n.workflow_entity (
      id, name, active, nodes, connections,
      settings, \"staticData\", \"pinData\", \"versionId\",
      \"triggerCount\", meta
    )
    VALUES (
      '$ID',
      '$NAME',
      $ACTIVE,
      '$NODES'::json,
      '$CONNECTIONS'::json,
      '$SETTINGS'::json,
      '$STATIC_DATA'::json,
      $PIN_DATA_SQL,
      $VERSION_ID_SQL,
      $TRIGGER_COUNT,
      $META_SQL
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      active = EXCLUDED.active,
      nodes = EXCLUDED.nodes,
      connections = EXCLUDED.connections,
      settings = EXCLUDED.settings,
      \"staticData\" = EXCLUDED.\"staticData\",
      \"pinData\" = EXCLUDED.\"pinData\",
      \"versionId\" = EXCLUDED.\"versionId\",
      \"triggerCount\" = EXCLUDED.\"triggerCount\",
      meta = EXCLUDED.meta,
      \"updatedAt\" = NOW();
  "

echo "✅ Workflow imported successfully: $NAME"
