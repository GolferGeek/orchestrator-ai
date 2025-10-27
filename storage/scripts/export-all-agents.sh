#!/bin/bash
# Export all agents to individual JSON files

set -e

OUTPUT_DIR="storage/snapshots/agents"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting all agents..."

# Get all agent names
export PGPASSWORD=postgres
AGENT_NAMES=$(psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT name FROM public.agents ORDER BY name;")

COUNT=0
for name in $AGENT_NAMES; do
  # Trim whitespace
  name=$(echo "$name" | xargs)

  echo "  Exporting: $name"

  # Export agent as JSON
  psql -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "
      SELECT json_build_object(
        'id', id,
        'name', name,
        'description', description,
        'system_prompt', system_prompt,
        'model_id', model_id,
        'temperature', temperature,
        'max_tokens', max_tokens,
        'created_at', created_at,
        'updated_at', updated_at
      )
      FROM public.agents
      WHERE name = '$name';
    " | jq '.' > "$OUTPUT_DIR/${name}.json"

  COUNT=$((COUNT + 1))
done

echo "✅ Exported $COUNT agents to: $OUTPUT_DIR"
