#!/bin/bash
# Import a single agent from JSON file

set -e

AGENT_FILE="$1"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$AGENT_FILE" ]; then
  echo "Usage: npm run db:import-agent <path-to-agent.json>"
  echo "Example: npm run db:import-agent storage/snapshots/agents/demo_supabase_agent.json"
  exit 1
fi

if [ ! -f "$AGENT_FILE" ]; then
  echo "❌ Error: File not found: $AGENT_FILE"
  exit 1
fi

echo "📥 Importing agent from: $AGENT_FILE"

# Read JSON and extract fields
AGENT_JSON=$(cat "$AGENT_FILE")

# Extract individual fields using jq
ID=$(echo "$AGENT_JSON" | jq -r '.id')
NAME=$(echo "$AGENT_JSON" | jq -r '.name')
DESCRIPTION=$(echo "$AGENT_JSON" | jq -r '.description')
SYSTEM_PROMPT=$(echo "$AGENT_JSON" | jq -r '.system_prompt')
MODEL_ID=$(echo "$AGENT_JSON" | jq -r '.model_id')
TEMPERATURE=$(echo "$AGENT_JSON" | jq -r '.temperature')
MAX_TOKENS=$(echo "$AGENT_JSON" | jq -r '.max_tokens')

# Escape single quotes for SQL
DESCRIPTION=$(echo "$DESCRIPTION" | sed "s/'/''/g")
SYSTEM_PROMPT=$(echo "$SYSTEM_PROMPT" | sed "s/'/''/g")

# Insert or update agent
export PGPASSWORD=postgres
psql -h "$DB_HOST" \
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
      '$MODEL_ID'::uuid,
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
  "

echo "✅ Agent imported successfully: $NAME"
