#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Usage
if [ -z "$1" ]; then
  echo -e "${YELLOW}Usage: ./create-migration.sh \"Workflow Name\"${NC}"
  echo ""
  echo "Example: ./create-migration.sh \"Agent Webhook Handler\""
  echo ""
  echo "This script will:"
  echo "1. Query your local n8n_workflows table for the workflow"
  echo "2. Generate a Supabase migration file"
  echo "3. Create the migration in apps/api/supabase/migrations/"
  exit 1
fi

WORKFLOW_NAME="$1"
echo -e "${BLUE}🔍 Searching for workflow: ${WORKFLOW_NAME}${NC}"

# Database connection
if [ -f "../../.env" ]; then
  source ../../.env
fi
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:7012/postgres}"

# Query workflow from database
WORKFLOW_JSON=$(psql "$DB_URL" -t -c "
  SELECT json_build_object(
    'id', id::text,
    'name', name,
    'active', active,
    'nodes', nodes,
    'connections', connections,
    'settings', settings,
    'created_at', created_at,
    'updated_at', updated_at
  )::text
  FROM n8n.n8n_workflows
  WHERE name = '$WORKFLOW_NAME'
  LIMIT 1;
" 2>&1)

if [ -z "$WORKFLOW_JSON" ] || [ "$WORKFLOW_JSON" = "" ] || [[ "$WORKFLOW_JSON" == *"ERROR"* ]]; then
  echo -e "${RED}❌ Workflow not found: $WORKFLOW_NAME${NC}"
  echo ""
  echo "Available workflows:"
  psql "$DB_URL" -c "SELECT name, active, created_at FROM n8n.n8n_workflows ORDER BY name;"
  echo ""
  echo -e "${BLUE}💡 To create a workflow:${NC}"
  echo "1. Open http://localhost:5678"
  echo "2. Create your workflow"
  echo "3. Save it with the exact name: $WORKFLOW_NAME"
  echo "4. Run this script again"
  exit 1
fi

# Clean up JSON (remove leading/trailing whitespace)
WORKFLOW_JSON=$(echo "$WORKFLOW_JSON" | tr -d '\n' | sed 's/^ *//;s/ *$//')

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ Error: jq is required but not installed${NC}"
  echo ""
  echo "Install jq:"
  echo "  macOS: brew install jq"
  echo "  Ubuntu: apt-get install jq"
  exit 1
fi

# Extract workflow data
WORKFLOW_ID=$(echo "$WORKFLOW_JSON" | jq -r '.id')
WORKFLOW_ACTIVE=$(echo "$WORKFLOW_JSON" | jq -r '.active')
WORKFLOW_NODES=$(echo "$WORKFLOW_JSON" | jq -c '.nodes')
WORKFLOW_CONNECTIONS=$(echo "$WORKFLOW_JSON" | jq -c '.connections')
WORKFLOW_SETTINGS=$(echo "$WORKFLOW_JSON" | jq -c '.settings')

echo -e "${GREEN}✅ Found workflow: $WORKFLOW_NAME (ID: $WORKFLOW_ID)${NC}"

# Generate migration filename
TIMESTAMP=$(date +%Y%m%d%H%M%S)
SLUG=$(echo "$WORKFLOW_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd '[:alnum:]_')
MIGRATION_FILE="../../apps/api/supabase/migrations/${TIMESTAMP}_add_n8n_${SLUG}.sql"

# Escape single quotes in JSON for SQL
NODES_ESCAPED=$(echo "$WORKFLOW_NODES" | sed "s/'/''/g")
CONNECTIONS_ESCAPED=$(echo "$WORKFLOW_CONNECTIONS" | sed "s/'/''/g")
SETTINGS_ESCAPED=$(echo "$WORKFLOW_SETTINGS" | sed "s/'/''/g")
NAME_ESCAPED=$(echo "$WORKFLOW_NAME" | sed "s/'/''/g")

# Create migration file
cat > "$MIGRATION_FILE" << EOF
-- Migration: Add n8n workflow - $WORKFLOW_NAME
-- Source: dev
-- Workflow ID: $WORKFLOW_ID
-- Created: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

INSERT INTO n8n.n8n_workflows (
  id,
  name,
  active,
  nodes,
  connections,
  settings,
  created_at,
  updated_at
)
VALUES (
  '$WORKFLOW_ID'::uuid,
  '$NAME_ESCAPED',
  $WORKFLOW_ACTIVE,
  '$NODES_ESCAPED'::jsonb,
  '$CONNECTIONS_ESCAPED'::jsonb,
  '$SETTINGS_ESCAPED'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n.n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO n8n.migration_metadata (migration_file, source, workflow_id, notes)
VALUES (
  '${TIMESTAMP}_add_n8n_${SLUG}.sql',
  'dev',
  '$WORKFLOW_ID'::uuid,
  'Exported from dev environment'
)
ON CONFLICT (migration_file) DO NOTHING;
EOF

echo -e "${GREEN}✅ Created migration: ${MIGRATION_FILE}${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the migration file"
echo "2. Commit to Git: git add apps/api/supabase/migrations/ && git commit -m 'feat: add n8n workflow ${WORKFLOW_NAME}'"
echo "3. Push to remote: git push"
echo "4. Other team members will get it automatically with 'npm run dev:api'"
