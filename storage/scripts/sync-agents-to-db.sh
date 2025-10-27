#!/bin/bash
# Sync all agent JSON files to database
# - Deletes agents from DB that don't have JSON files
# - Upserts agents that have JSON files

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

echo "🔄 Syncing agents from $AGENTS_DIR to database..."

export PGPASSWORD=postgres

# Get list of agent names from JSON files
echo "  Collecting agent names from JSON files..."
JSON_AGENT_NAMES=()
for agent_file in "$AGENTS_DIR"/*.json; do
  if [ -f "$agent_file" ]; then
    NAME=$(jq -r '.name' "$agent_file")
    JSON_AGENT_NAMES+=("$NAME")
  fi
done

if [ ${#JSON_AGENT_NAMES[@]} -eq 0 ]; then
  echo "⚠️  No JSON files found in $AGENTS_DIR"
  exit 0
fi

echo "  Found ${#JSON_AGENT_NAMES[@]} agent(s) in JSON files"

# Get list of agent names from database
DB_AGENT_NAMES=$(psql -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT name FROM public.agents ORDER BY name;")

# Delete agents from DB that don't have JSON files
echo "  Checking for agents to delete..."
DELETED=0
for db_name in $DB_AGENT_NAMES; do
  db_name=$(echo "$db_name" | xargs)
  found=false

  for json_name in "${JSON_AGENT_NAMES[@]}"; do
    if [ "$db_name" = "$json_name" ]; then
      found=true
      break
    fi
  done

  if [ "$found" = false ]; then
    echo "    Deleting: $db_name (no JSON file found)"
    psql -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "DELETE FROM public.agents WHERE name = '$db_name';" > /dev/null
    DELETED=$((DELETED + 1))
  fi
done

if [ $DELETED -gt 0 ]; then
  echo "  Deleted $DELETED agent(s)"
fi

# Import/update all agents from JSON files
echo "  Importing/updating agents from JSON files..."
IMPORTED=0
FAILED=0

for agent_file in "$AGENTS_DIR"/*.json; do
  if [ ! -f "$agent_file" ]; then
    continue
  fi

  # Read JSON and extract fields
  AGENT_JSON=$(cat "$agent_file")

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
    IMPORTED=$((IMPORTED + 1))
  else
    echo "    ❌ Failed to import $NAME"
    FAILED=$((FAILED + 1))
  fi
done

echo "✅ Sync complete:"
echo "   - Imported/updated: $IMPORTED agent(s)"
echo "   - Deleted: $DELETED agent(s)"
if [ $FAILED -gt 0 ]; then
  echo "   ⚠️  Failed: $FAILED agent(s)"
  exit 1
fi
