#!/bin/bash
# Export all N8N workflows to individual JSON files

set -e

OUTPUT_DIR="storage/snapshots/n8n"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting all N8N workflows..."

# Get all workflow names and IDs
export PGPASSWORD=postgres
WORKFLOWS=$(psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT id, name FROM n8n.workflow_entity ORDER BY name;")

COUNT=0
while IFS='|' read -r id name; do
  # Trim whitespace
  id=$(echo "$id" | xargs)
  name=$(echo "$name" | xargs)

  if [ -z "$id" ]; then
    continue
  fi

  echo "  Exporting: $name"

  # Sanitize workflow name for filename
  FILENAME=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g' | sed 's/[^a-z0-9\-]//g')

  # Export workflow as JSON
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
      WHERE id = '$id';
    " | jq '.' > "$OUTPUT_DIR/${FILENAME}.json"

  COUNT=$((COUNT + 1))
done <<< "$WORKFLOWS"

echo "✅ Exported $COUNT workflows to: $OUTPUT_DIR"
