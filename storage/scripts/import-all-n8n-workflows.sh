#!/bin/bash
# Import all N8N workflows from storage/snapshots/n8n/ directory

set -e

N8N_DIR="storage/snapshots/n8n"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ ! -d "$N8N_DIR" ]; then
  echo "❌ Error: Directory not found: $N8N_DIR"
  exit 1
fi

echo "📥 Importing all N8N workflows from: $N8N_DIR"

COUNT=0
FAILED=0

for workflow_file in "$N8N_DIR"/*.json; do
  if [ ! -f "$workflow_file" ]; then
    echo "⚠️  No JSON files found in $N8N_DIR"
    exit 0
  fi

  echo "  Importing: $(basename "$workflow_file")"

  # Read JSON and extract fields
  WORKFLOW_JSON=$(cat "$workflow_file")

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
  if psql -h "$DB_HOST" \
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
    " > /dev/null 2>&1; then
    COUNT=$((COUNT + 1))
  else
    echo "    ❌ Failed to import workflow"
    FAILED=$((FAILED + 1))
  fi
done

echo "✅ Imported $COUNT workflows successfully"
if [ $FAILED -gt 0 ]; then
  echo "⚠️  Failed to import $FAILED workflows"
  exit 1
fi
