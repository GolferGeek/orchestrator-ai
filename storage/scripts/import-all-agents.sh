#!/bin/bash
# Import all agents from storage/snapshots/agents/ directory

set -e

AGENTS_DIR="storage/snapshots/agents"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ ! -d "$AGENTS_DIR" ]; then
  echo "❌ Error: Directory not found: $AGENTS_DIR"
  exit 1
fi

echo "📥 Importing all agents from: $AGENTS_DIR"

COUNT=0
FAILED=0

for agent_file in "$AGENTS_DIR"/*.json; do
  if [ ! -f "$agent_file" ]; then
    echo "⚠️  No JSON files found in $AGENTS_DIR"
    exit 0
  fi

  echo "  Importing: $(basename "$agent_file")"

  # Read JSON and extract fields
  AGENT_JSON=$(cat "$agent_file")

  # Extract individual fields using jq
  ID=$(echo "$AGENT_JSON" | jq -r '.id')
  NAME=$(echo "$AGENT_JSON" | jq -r '.name')
  DESCRIPTION=$(echo "$AGENT_JSON" | jq -r '.description // ""')
  SYSTEM_PROMPT=$(echo "$AGENT_JSON" | jq -r '.system_prompt // ""')
  MODEL_ID=$(echo "$AGENT_JSON" | jq -r '.model_id // null')
  TEMPERATURE=$(echo "$AGENT_JSON" | jq -r '.temperature // 0.7')
  MAX_TOKENS=$(echo "$AGENT_JSON" | jq -r '.max_tokens // 2000')

  # Escape single quotes for SQL
  DESCRIPTION=$(echo "$DESCRIPTION" | sed "s/'/''/g")
  SYSTEM_PROMPT=$(echo "$SYSTEM_PROMPT" | sed "s/'/''/g")

  # Handle NULL model_id
  if [ "$MODEL_ID" = "null" ]; then
    MODEL_ID_SQL="NULL"
  else
    MODEL_ID_SQL="'$MODEL_ID'::uuid"
  fi

  # Insert or update agent
  export PGPASSWORD=postgres
  if psql -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "
      INSERT INTO public.agents (
        id, name, description, system_prompt,
        model_id, temperature, max_tokens
      )
      VALUES (
        '$ID'::uuid,
        '$NAME',
        '$DESCRIPTION',
        '$SYSTEM_PROMPT',
        $MODEL_ID_SQL,
        $TEMPERATURE,
        $MAX_TOKENS
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        system_prompt = EXCLUDED.system_prompt,
        model_id = EXCLUDED.model_id,
        temperature = EXCLUDED.temperature,
        max_tokens = EXCLUDED.max_tokens,
        updated_at = NOW();
    " > /dev/null 2>&1; then
    COUNT=$((COUNT + 1))
  else
    echo "    ❌ Failed to import $NAME"
    FAILED=$((FAILED + 1))
  fi
done

echo "✅ Imported $COUNT agents successfully"
if [ $FAILED -gt 0 ]; then
  echo "⚠️  Failed to import $FAILED agents"
  exit 1
fi
