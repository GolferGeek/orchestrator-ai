#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔄 Syncing workflows from n8n to Supabase...${NC}"

# Load environment
if [ -f ".env" ]; then
  source .env
fi

# Database connection - use Docker exec for psql
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:7012/postgres}"
DOCKER_PSQL="/Applications/Docker.app/Contents/Resources/bin/docker exec -i supabase_db_api-dev psql -U postgres -d postgres"

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ Error: jq is required but not installed${NC}"
  echo "Install: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

# Get workflows from n8n API
echo -e "${BLUE}📡 Fetching workflows from n8n API...${NC}"

if [ -z "$N8N_API_KEY" ]; then
  echo -e "${RED}❌ Error: N8N_API_KEY not set${NC}"
  echo "Set it in apps/n8n/.env or export N8N_API_KEY=your-key"
  exit 1
fi

N8N_URL="${N8N_API_URL:-http://localhost:5678}"
WORKFLOWS_JSON=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows")

if [[ "$WORKFLOWS_JSON" == *"unauthorized"* ]] || [[ "$WORKFLOWS_JSON" == *"error"* ]]; then
  echo -e "${RED}❌ Error fetching workflows: $WORKFLOWS_JSON${NC}"
  exit 1
fi

# Parse workflows
WORKFLOW_COUNT=$(echo "$WORKFLOWS_JSON" | jq -r '.data | length')
echo -e "${GREEN}✅ Found $WORKFLOW_COUNT workflow(s) in n8n${NC}"

if [ "$WORKFLOW_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  No workflows to sync${NC}"
  exit 0
fi

# Process each workflow
echo "$WORKFLOWS_JSON" | jq -c '.data[]' | while read -r workflow; do
  # Extract workflow data
  WORKFLOW_ID=$(echo "$workflow" | jq -r '.id')
  WORKFLOW_NAME=$(echo "$workflow" | jq -r '.name')
  WORKFLOW_ACTIVE=$(echo "$workflow" | jq -r '.active')
  WORKFLOW_NODES=$(echo "$workflow" | jq -c '.nodes')
  WORKFLOW_CONNECTIONS=$(echo "$workflow" | jq -c '.connections')
  WORKFLOW_SETTINGS=$(echo "$workflow" | jq -c '.settings // {}')
  WORKFLOW_CREATED=$(echo "$workflow" | jq -r '.createdAt')
  WORKFLOW_UPDATED=$(echo "$workflow" | jq -r '.updatedAt')

  echo -e "${BLUE}📝 Processing: $WORKFLOW_NAME${NC}"

  # Create temporary SQL file with proper escaping
  TEMP_SQL=$(mktemp)
  cat > "$TEMP_SQL" << EOF
INSERT INTO n8n.n8n_workflows (
  id, name, active, nodes, connections, settings, created_at, updated_at
) VALUES (
  '$WORKFLOW_ID',
  \$\$${WORKFLOW_NAME}\$\$,
  $WORKFLOW_ACTIVE,
  \$\$${WORKFLOW_NODES}\$\$::jsonb,
  \$\$${WORKFLOW_CONNECTIONS}\$\$::jsonb,
  \$\$${WORKFLOW_SETTINGS}\$\$::jsonb,
  '$WORKFLOW_CREATED'::timestamptz,
  '$WORKFLOW_UPDATED'::timestamptz
) ON CONFLICT (name) DO UPDATE SET
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n.n8n_workflows.updated_at < EXCLUDED.updated_at;
EOF

  if $DOCKER_PSQL < "$TEMP_SQL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Synced: $WORKFLOW_NAME${NC}"
  else
    echo -e "${RED}❌ Failed to sync: $WORKFLOW_NAME${NC}"
    # Show error for debugging
    $DOCKER_PSQL < "$TEMP_SQL" 2>&1 | head -3
  fi
  
  # Clean up temp file
  rm -f "$TEMP_SQL"
done

echo ""
echo -e "${GREEN}🎉 Sync complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Check synced workflows: psql ... -c \"SELECT name, active FROM n8n.n8n_workflows;\""
echo "2. Create migrations: npm run n8n:create-migration \"Workflow Name\""
echo "3. Commit for team: git add apps/api/supabase/migrations/ && git commit"
