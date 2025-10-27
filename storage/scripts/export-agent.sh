#!/bin/bash
# Export a single agent to JSON file

set -e

AGENT_NAME="$1"
OUTPUT_DIR="storage/snapshots/agents"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$AGENT_NAME" ]; then
  echo "Usage: npm run db:export-agent <agent-name>"
  echo "Example: npm run db:export-agent demo_supabase_agent"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting agent: $AGENT_NAME"

# Export agent as JSON
export PGPASSWORD=postgres
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
    WHERE name = '$AGENT_NAME';
  " | jq '.' > "$OUTPUT_DIR/${AGENT_NAME}.json"

if [ -f "$OUTPUT_DIR/${AGENT_NAME}.json" ]; then
  echo "✅ Agent exported to: $OUTPUT_DIR/${AGENT_NAME}.json"
else
  echo "❌ Error: Failed to export agent"
  exit 1
fi
