#!/bin/bash
# Sync all N8N workflow JSON files to database
# - Deletes workflows from DB that don't have JSON files
# - Upserts workflows that have JSON files

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

echo "🔄 Syncing N8N workflows from $N8N_DIR to database..."

export PGPASSWORD=postgres

# Get list of workflow IDs from JSON files
echo "  Collecting workflow IDs from JSON files..."
JSON_WORKFLOW_IDS=()
for workflow_file in "$N8N_DIR"/*.json; do
  if [ -f "$workflow_file" ]; then
    ID=$(jq -r '.id' "$workflow_file")
    JSON_WORKFLOW_IDS+=("$ID")
  fi
done

if [ ${#JSON_WORKFLOW_IDS[@]} -eq 0 ]; then
  echo "⚠️  No JSON files found in $N8N_DIR"
  exit 0
fi

echo "  Found ${#JSON_WORKFLOW_IDS[@]} workflow(s) in JSON files"

# Get list of workflow IDs from database
DB_WORKFLOW_IDS=$(psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT id FROM n8n.workflow_entity ORDER BY id;")

# Delete workflows from DB that don't have JSON files
echo "  Checking for workflows to delete..."
DELETED=0
for db_id in $DB_WORKFLOW_IDS; do
  db_id=$(echo "$db_id" | xargs)
  found=false

  for json_id in "${JSON_WORKFLOW_IDS[@]}"; do
    if [ "$db_id" = "$json_id" ]; then
      found=true
      break
    fi
  done

  if [ "$found" = false ]; then
    WORKFLOW_NAME=$(psql -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -t -c "SELECT name FROM n8n.workflow_entity WHERE id = '$db_id';")
    WORKFLOW_NAME=$(echo "$WORKFLOW_NAME" | xargs)

    echo "    Deleting: $WORKFLOW_NAME (no JSON file found)"
    psql -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "DELETE FROM n8n.workflow_entity WHERE id = '$db_id';" > /dev/null
    DELETED=$((DELETED + 1))
  fi
done

if [ $DELETED -gt 0 ]; then
  echo "  Deleted $DELETED workflow(s)"
fi

# Import/update all workflows from JSON files
echo "  Importing/updating workflows from JSON files..."
IMPORTED=0
FAILED=0

for workflow_file in "$N8N_DIR"/*.json; do
  if [ ! -f "$workflow_file" ]; then
    continue
  fi

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
    IMPORTED=$((IMPORTED + 1))
  else
    echo "    ❌ Failed to import workflow ID: $ID"
    FAILED=$((FAILED + 1))
  fi
done

echo "✅ Sync complete:"
echo "   - Imported/updated: $IMPORTED workflow(s)"
echo "   - Deleted: $DELETED workflow(s)"
if [ $FAILED -gt 0 ]; then
  echo "   ⚠️  Failed: $FAILED workflow(s)"
  exit 1
fi
