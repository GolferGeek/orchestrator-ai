# Implementation Plan: Bidirectional n8n Workflow Sync

## Overview

This document provides the step-by-step implementation plan for the n8n workflow sync system described in [prd-bidirectional-workflow-sync.md](./prd-bidirectional-workflow-sync.md).

## Phase 1: Core Infrastructure

### Step 1.1: Create Migration Metadata Table

**File:** `apps/api/supabase/migrations/YYYYMMDDHHMMSS_create_migration_metadata.sql`

```sql
-- Track migration sources and workflow associations
CREATE TABLE IF NOT EXISTS migration_metadata (
  migration_file TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('dev', 'prod', 'staging')),
  workflow_id UUID REFERENCES n8n_workflows(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_migration_metadata_source ON migration_metadata(source);
CREATE INDEX idx_migration_metadata_workflow ON migration_metadata(workflow_id);
CREATE INDEX idx_migration_metadata_synced ON migration_metadata(synced_at);

COMMENT ON TABLE migration_metadata IS 'Tracks the source and metadata of n8n workflow migrations';
COMMENT ON COLUMN migration_metadata.source IS 'Origin of the migration: dev, prod, or staging';
COMMENT ON COLUMN migration_metadata.workflow_id IS 'References the n8n workflow this migration manages';
```

**Action Items:**
- [ ] Create migration file using `npx supabase migration new create_migration_metadata --workdir apps/api`
- [ ] Add SQL content above
- [ ] Test migration: `cd apps/api && npx supabase db reset`
- [ ] Verify table created: `psql ... -c "\d migration_metadata"`

### Step 1.2: Create migrate-up.sh Script

**File:** `apps/n8n/scripts/migrate-up.sh`

```bash
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Running n8n workflow migrations...${NC}"

# Detect environment
if [ -f "../../.env" ]; then
  source ../../.env
fi

# Determine Supabase connection
if [ -z "$DATABASE_URL" ]; then
  # Default to local Supabase
  DB_URL="postgresql://postgres:postgres@127.0.0.1:7012/postgres"
  echo -e "${BLUE}📍 Using local Supabase${NC}"
else
  DB_URL="$DATABASE_URL"
  echo -e "${BLUE}📍 Using environment DATABASE_URL${NC}"
fi

# Run migrations using Supabase CLI
cd ../../apps/api

if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ Error: npx not found. Please install Node.js${NC}"
  exit 1
fi

# Apply migrations
if npx supabase migration up 2>&1; then
  echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
  echo -e "${RED}❌ Migration failed${NC}"
  exit 1
fi

# Show migration status
echo -e "${BLUE}📊 Current migration status:${NC}"
psql "$DB_URL" -c "SELECT * FROM supabase_migrations ORDER BY version DESC LIMIT 5;"

echo -e "${GREEN}✅ n8n migration check complete${NC}"
```

**Action Items:**
- [ ] Create `apps/n8n/scripts/` directory if it doesn't exist
- [ ] Create `migrate-up.sh` file
- [ ] Make executable: `chmod +x apps/n8n/scripts/migrate-up.sh`
- [ ] Test: `cd apps/n8n && ./scripts/migrate-up.sh`

### Step 1.3: Create create-migration.sh Script

**File:** `apps/n8n/scripts/create-migration.sh`

```bash
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
  FROM n8n_workflows
  WHERE name = '$WORKFLOW_NAME'
  LIMIT 1;
" 2>&1)

if [ -z "$WORKFLOW_JSON" ] || [ "$WORKFLOW_JSON" = "" ]; then
  echo -e "${RED}❌ Workflow not found: $WORKFLOW_NAME${NC}"
  echo ""
  echo "Available workflows:"
  psql "$DB_URL" -c "SELECT name FROM n8n_workflows ORDER BY name;"
  exit 1
fi

# Clean up JSON (remove leading/trailing whitespace)
WORKFLOW_JSON=$(echo "$WORKFLOW_JSON" | tr -d '\n' | sed 's/^ *//;s/ *$//')

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

INSERT INTO n8n_workflows (
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
WHERE n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO migration_metadata (migration_file, source, workflow_id, notes)
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
```

**Action Items:**
- [ ] Create `create-migration.sh` file
- [ ] Make executable: `chmod +x apps/n8n/scripts/create-migration.sh`
- [ ] Install jq if not present: `brew install jq` (macOS) or `apt-get install jq` (Linux)
- [ ] Test with sample workflow: `./create-migration.sh "Test Workflow"`

### Step 1.4: Update Root package.json

**File:** `package.json`

Add these scripts:

```json
{
  "scripts": {
    "n8n:create-migration": "cd apps/n8n && ./scripts/create-migration.sh",
    "n8n:migrate-up": "cd apps/n8n && ./scripts/migrate-up.sh",
    "dev:api": "npm run n8n:migrate-up && npm run --workspace=nestjs start:dev"
  }
}
```

**Action Items:**
- [ ] Update `package.json` scripts section
- [ ] Test: `npm run n8n:migrate-up`
- [ ] Test: `npm run n8n:create-migration "Test Workflow"`
- [ ] Verify `dev:api` runs migrations before starting

### Step 1.5: Test Phase 1

**Test Scenarios:**

1. **Create and Export Workflow**
   ```bash
   # Create a test workflow in n8n UI
   # Export it
   npm run n8n:create-migration "Test Workflow"
   # Verify migration file created
   ls apps/api/supabase/migrations/*test_workflow.sql
   ```

2. **Apply Migration**
   ```bash
   npm run n8n:migrate-up
   # Verify workflow exists in database
   psql ... -c "SELECT name FROM n8n_workflows WHERE name = 'Test Workflow';"
   ```

3. **Auto-Apply on Dev Start**
   ```bash
   npm run dev:api
   # Should see migration output before server starts
   ```

**Acceptance Criteria:**
- [ ] Migration metadata table exists
- [ ] Can export local workflow to migration
- [ ] Can apply migrations manually
- [ ] Migrations run automatically on `npm run dev:api`
- [ ] Existing data is preserved during migration

---

## Phase 2: Production Sync

### Step 2.1: Create create-history-migration.sh Script

**File:** `apps/n8n/scripts/create-history-migration.sh`

```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📥 Exporting workflows from production...${NC}"

# Check for required environment variables
if [ -z "$PROD_SUPABASE_URL" ] || [ -z "$PROD_SUPABASE_KEY" ]; then
  echo -e "${RED}❌ Error: PROD_SUPABASE_URL and PROD_SUPABASE_KEY must be set${NC}"
  echo ""
  echo "Set them in your environment:"
  echo "  export PROD_SUPABASE_URL=https://xxx.supabase.co"
  echo "  export PROD_SUPABASE_KEY=eyJxxx"
  exit 1
fi

# Construct database URL
PROD_DB_URL=$(echo "$PROD_SUPABASE_URL" | sed 's|https://\([^.]*\)\.supabase\.co|postgresql://postgres:$PROD_SUPABASE_KEY@db.\1.supabase.co:5432/postgres|')

# Optional: specific workflow name
WORKFLOW_NAME="$1"

# Determine query
if [ -z "$WORKFLOW_NAME" ]; then
  # Export all workflows modified in last 7 days
  echo -e "${BLUE}📅 Exporting workflows modified in last 7 days${NC}"
  QUERY="SELECT * FROM n8n_workflows WHERE updated_at >= NOW() - INTERVAL '7 days' ORDER BY updated_at DESC;"
else
  echo -e "${BLUE}🔍 Exporting specific workflow: $WORKFLOW_NAME${NC}"
  QUERY="SELECT * FROM n8n_workflows WHERE name = '$WORKFLOW_NAME';"
fi

# Query workflows
WORKFLOWS=$(psql "$PROD_DB_URL" -t -A -F $'\t' -c "$QUERY" 2>&1)

if [ -z "$WORKFLOWS" ]; then
  echo -e "${YELLOW}⚠️  No workflows found${NC}"
  exit 0
fi

# Process each workflow
echo "$WORKFLOWS" | while IFS=$'\t' read -r id name active nodes connections settings created_at updated_at; do
  echo -e "${GREEN}📄 Processing: $name${NC}"

  # Generate migration filename
  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  SLUG=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '_' | tr -cd '[:alnum:]_')
  MIGRATION_FILE="../../apps/api/supabase/migrations/${TIMESTAMP}_prod_sync_${SLUG}.sql"

  # Escape for SQL
  NAME_ESCAPED=$(echo "$name" | sed "s/'/''/g")
  NODES_ESCAPED=$(echo "$nodes" | sed "s/'/''/g")
  CONNECTIONS_ESCAPED=$(echo "$connections" | sed "s/'/''/g")
  SETTINGS_ESCAPED=$(echo "$settings" | sed "s/'/''/g")

  # Create migration
  cat > "$MIGRATION_FILE" << EOF
-- Migration: Prod sync - $name
-- Source: prod
-- Workflow ID: $id
-- Last Updated in Prod: $updated_at
-- Auto-generated from production

INSERT INTO n8n_workflows (
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
  '$id'::uuid,
  '$NAME_ESCAPED',
  $active,
  '$NODES_ESCAPED'::jsonb,
  '$CONNECTIONS_ESCAPED'::jsonb,
  '$SETTINGS_ESCAPED'::jsonb,
  '$created_at'::timestamptz,
  '$updated_at'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO migration_metadata (migration_file, source, workflow_id, notes)
VALUES (
  '${TIMESTAMP}_prod_sync_${SLUG}.sql',
  'prod',
  '$id'::uuid,
  'Synced from production on $(date -u +"%Y-%m-%d")'
)
ON CONFLICT (migration_file) DO NOTHING;
EOF

  echo -e "${GREEN}✅ Created: ${MIGRATION_FILE}${NC}"
done

echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Review the generated migrations"
echo "2. Create a PR: git checkout -b sync/n8n-prod-workflows"
echo "3. Commit: git add apps/api/supabase/migrations/ && git commit -m 'chore: sync n8n workflows from prod'"
echo "4. Push: git push origin sync/n8n-prod-workflows"
echo "5. Create PR for team review"
```

**Action Items:**
- [ ] Create `create-history-migration.sh` file
- [ ] Make executable: `chmod +x apps/n8n/scripts/create-history-migration.sh`
- [ ] Test with prod credentials (safely!)
- [ ] Verify migration files created with `prod_sync_` prefix

### Step 2.2: Create TypeScript Prod Export Tool

**File:** `scripts/n8n/export-prod-workflows.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: any;
  connections: any;
  settings: any;
  created_at: string;
  updated_at: string;
}

const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL;
const PROD_SUPABASE_KEY = process.env.PROD_SUPABASE_SERVICE_KEY;
const DAYS_BACK = parseInt(process.env.SYNC_DAYS_BACK || '7', 10);

async function exportProdWorkflows() {
  if (!PROD_SUPABASE_URL || !PROD_SUPABASE_KEY) {
    console.error('❌ Error: PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_KEY must be set');
    process.exit(1);
  }

  console.log(`📥 Exporting workflows from production...`);
  console.log(`📅 Looking for workflows modified in last ${DAYS_BACK} days`);

  const client = createClient(PROD_SUPABASE_URL, PROD_SUPABASE_KEY);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DAYS_BACK);

  const { data: workflows, error } = await client
    .from('n8n_workflows')
    .select('*')
    .gte('updated_at', cutoffDate.toISOString())
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching workflows:', error.message);
    process.exit(1);
  }

  if (!workflows || workflows.length === 0) {
    console.log('⚠️  No workflows found');
    return;
  }

  console.log(`📄 Found ${workflows.length} workflow(s)`);

  for (const workflow of workflows as N8nWorkflow[]) {
    console.log(`\n📝 Processing: ${workflow.name}`);

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const slug = workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `${timestamp}_prod_sync_${slug}.sql`;
    const filepath = resolve(__dirname, '../../apps/api/supabase/migrations', filename);

    const migration = generateMigrationSQL(workflow, filename);

    writeFileSync(filepath, migration);
    console.log(`✅ Created: ${filename}`);
  }

  console.log('\n📋 Next steps:');
  console.log('1. Review the generated migrations');
  console.log('2. Create a PR for team review');
  console.log('3. git add apps/api/supabase/migrations/');
  console.log('4. git commit -m "chore: sync n8n workflows from prod"');
  console.log('5. git push');
}

function generateMigrationSQL(workflow: N8nWorkflow, filename: string): string {
  const escapeSingleQuotes = (str: string) => str.replace(/'/g, "''");

  const nameEscaped = escapeSingleQuotes(workflow.name);
  const nodesJSON = JSON.stringify(workflow.nodes);
  const connectionsJSON = JSON.stringify(workflow.connections);
  const settingsJSON = JSON.stringify(workflow.settings);

  return `-- Migration: Prod sync - ${workflow.name}
-- Source: prod
-- Workflow ID: ${workflow.id}
-- Last Updated in Prod: ${workflow.updated_at}
-- Auto-generated from production

INSERT INTO n8n_workflows (
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
  '${workflow.id}'::uuid,
  '${nameEscaped}',
  ${workflow.active},
  '${escapeSingleQuotes(nodesJSON)}'::jsonb,
  '${escapeSingleQuotes(connectionsJSON)}'::jsonb,
  '${escapeSingleQuotes(settingsJSON)}'::jsonb,
  '${workflow.created_at}'::timestamptz,
  '${workflow.updated_at}'::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO migration_metadata (migration_file, source, workflow_id, notes)
VALUES (
  '${filename}',
  'prod',
  '${workflow.id}'::uuid,
  'Synced from production on ${new Date().toISOString().split('T')[0]}'
)
ON CONFLICT (migration_file) DO NOTHING;
`;
}

exportProdWorkflows().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
```

**Action Items:**
- [ ] Create `scripts/n8n/` directory
- [ ] Create `export-prod-workflows.ts` file
- [ ] Install dependencies: `npm install @supabase/supabase-js --save-dev`
- [ ] Test: `PROD_SUPABASE_URL=... PROD_SUPABASE_SERVICE_KEY=... tsx scripts/n8n/export-prod-workflows.ts`

### Step 2.3: Update Root package.json (Phase 2)

Add to `package.json`:

```json
{
  "scripts": {
    "n8n:create-history": "tsx scripts/n8n/export-prod-workflows.ts",
    "n8n:sync-from-prod": "npm run n8n:create-history && git add apps/api/supabase/migrations && git status"
  }
}
```

**Action Items:**
- [ ] Update `package.json`
- [ ] Test: `npm run n8n:create-history`
- [ ] Test: `npm run n8n:sync-from-prod`

### Step 2.4: Test Phase 2

**Test Scenarios:**

1. **Export Single Prod Workflow**
   ```bash
   cd apps/n8n
   PROD_SUPABASE_URL=xxx PROD_SUPABASE_KEY=xxx ./scripts/create-history-migration.sh "Prod Workflow"
   # Verify migration created with prod_sync_ prefix
   ```

2. **Export All Recent Prod Workflows**
   ```bash
   PROD_SUPABASE_URL=xxx PROD_SUPABASE_KEY=xxx npm run n8n:create-history
   # Verify multiple migrations created
   ```

3. **Apply Prod Migrations Locally**
   ```bash
   npm run n8n:migrate-up
   # Verify prod workflows now exist locally
   ```

**Acceptance Criteria:**
- [ ] Can export single prod workflow
- [ ] Can export multiple prod workflows
- [ ] Migrations have `prod_sync_` prefix
- [ ] Migrations include source tracking
- [ ] Can apply prod migrations to local environment

---

## Phase 3: Automation

### Step 3.1: Update Production Scripts

**File:** `package.json`

Add production scripts:

```json
{
  "scripts": {
    "prod:start": "npm run n8n:migrate-up && cd apps/api && npm run start:prod",
    "prod:restart": "npm run n8n:migrate-up && pm2 restart orchestrator-api"
  }
}
```

**Action Items:**
- [ ] Update `package.json`
- [ ] Test on staging server first
- [ ] Deploy to production
- [ ] Verify migrations run on restart

### Step 3.2: Create GitHub Actions Workflow

**File:** `.github/workflows/sync-n8n-from-prod.yml`

```yaml
name: Sync n8n Workflows from Production

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2am UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Export workflows from prod
        env:
          PROD_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          PROD_SUPABASE_SERVICE_KEY: ${{ secrets.PROD_SUPABASE_SERVICE_KEY }}
          SYNC_DAYS_BACK: 7
        run: npm run n8n:create-history

      - name: Check for changes
        id: check_changes
        run: |
          if git diff --quiet apps/api/supabase/migrations/; then
            echo "has_changes=false" >> $GITHUB_OUTPUT
          else
            echo "has_changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Create Pull Request
        if: steps.check_changes.outputs.has_changes == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: 'chore: sync n8n workflows from production'
          title: 'Sync n8n Workflows from Production'
          body: |
            🤖 Auto-generated PR to sync n8n workflows from production.

            ## Changes
            This PR includes workflow changes from production that were modified in the last 7 days.

            ## Review Checklist
            - [ ] Review each workflow for sensitive data
            - [ ] Verify workflow logic is correct
            - [ ] Check for any breaking changes
            - [ ] Ensure credentials are not included

            ## Next Steps
            After merging, team members will receive these workflows automatically on next `npm run dev:api`.
          branch: sync/n8n-prod-workflows
          labels: n8n, automation, prod-sync
          delete-branch: true
```

**Action Items:**
- [ ] Create `.github/workflows/` directory if needed
- [ ] Create `sync-n8n-from-prod.yml` file
- [ ] Add GitHub secrets: `PROD_SUPABASE_URL`, `PROD_SUPABASE_SERVICE_KEY`
- [ ] Test manual trigger first
- [ ] Enable scheduled runs

### Step 3.3: Create PR Template

**File:** `.github/PULL_REQUEST_TEMPLATE/n8n-sync.md`

```markdown
## n8n Workflow Sync

### Source
- [ ] Dev → Prod (manual export)
- [ ] Prod → Dev (automated sync)

### Workflow Changes
List workflows added/modified:
-

### Security Review
- [ ] No credentials included
- [ ] No sensitive data in workflow nodes
- [ ] No hardcoded API keys or secrets
- [ ] Webhook URLs reviewed

### Testing
- [ ] Tested workflow locally
- [ ] Verified workflow executes correctly
- [ ] Checked for breaking changes

### Notes
Additional context about these workflows:

```

**Action Items:**
- [ ] Create `.github/PULL_REQUEST_TEMPLATE/` directory
- [ ] Create `n8n-sync.md` template
- [ ] Test by creating a PR with `?template=n8n-sync`

### Step 3.4: Test Phase 3

**Test Scenarios:**

1. **Automated Prod Sync**
   ```bash
   # Trigger GitHub Action manually
   # Verify PR is created
   # Review PR contents
   # Merge PR
   # Pull changes locally
   # Verify workflows applied
   ```

2. **Production Restart**
   ```bash
   # On prod server
   npm run prod:restart
   # Verify migrations ran
   # Verify app restarted successfully
   ```

**Acceptance Criteria:**
- [ ] GitHub Action runs weekly
- [ ] PR is created automatically
- [ ] PR template is used
- [ ] Migrations run on prod restart
- [ ] Team is notified of new workflows

---

## Phase 4: Polish

### Step 4.1: Add Migration Validation

**File:** `apps/n8n/scripts/validate-migration.sh`

```bash
#!/bin/bash
# Validates a migration file before applying

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ File not found: $MIGRATION_FILE"
  exit 1
fi

echo "🔍 Validating migration: $MIGRATION_FILE"

# Check for credentials
if grep -qi "credential" "$MIGRATION_FILE"; then
  echo "⚠️  Warning: File contains 'credential' - review carefully"
fi

# Check for API keys
if grep -E "(api[_-]?key|secret[_-]?key|password)" "$MIGRATION_FILE" -i; then
  echo "⚠️  Warning: File may contain sensitive data"
fi

# Validate SQL syntax (basic)
if ! psql -d postgres -c "\i $MIGRATION_FILE" --dry-run 2>/dev/null; then
  echo "❌ SQL syntax appears invalid"
  exit 1
fi

echo "✅ Validation passed"
```

**Action Items:**
- [ ] Create `validate-migration.sh`
- [ ] Make executable
- [ ] Integrate into create-migration scripts
- [ ] Add to pre-commit hook (optional)

### Step 4.2: Create Rollback Documentation

**File:** `docs/feature/matt/n8n/rollback-guide.md`

```markdown
# n8n Workflow Migration Rollback Guide

## Quick Rollback

If a migration causes issues:

1. **Revert the migration file:**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Manually remove workflow (if needed):**
   ```sql
   DELETE FROM n8n_workflows WHERE id = '<workflow-id>';
   DELETE FROM migration_metadata WHERE workflow_id = '<workflow-id>';
   ```

3. **Restart services:**
   ```bash
   npm run dev:api  # or prod:restart
   ```

## Selective Rollback

To rollback a specific workflow without affecting others:

```sql
-- Restore previous version (if you have a backup)
UPDATE n8n_workflows
SET nodes = '<previous-nodes>'::jsonb,
    connections = '<previous-connections>'::jsonb
WHERE id = '<workflow-id>';
```

## Nuclear Option

If everything is broken, restore from database backup:

```bash
# Stop services
npm run stop

# Restore database from backup
psql ... < backup.sql

# Restart services
npm run dev:api
```
```

**Action Items:**
- [ ] Create rollback guide
- [ ] Test rollback procedures
- [ ] Add to team documentation

### Step 4.3: Create Team Documentation

**File:** `docs/feature/matt/n8n/team-guide.md`

```markdown
# n8n Workflow Sync - Team Guide

## For Developers

### Creating a New Workflow

1. Create workflow in n8n UI (http://localhost:5678)
2. Export to migration:
   ```bash
   npm run n8n:create-migration "My Workflow Name"
   ```
3. Review migration file
4. Commit and push:
   ```bash
   git add apps/api/supabase/migrations/
   git commit -m "feat: add n8n workflow - My Workflow"
   git push
   ```

### Getting Latest Workflows

Workflows are applied automatically when you start the dev server:
```bash
npm run dev:api
```

Or manually:
```bash
npm run n8n:migrate-up
```

### Updating a Workflow

Same as creating - export creates an upsert migration that updates if the workflow exists.

## For Admins

### Syncing from Production

1. Set environment variables:
   ```bash
   export PROD_SUPABASE_URL=https://xxx.supabase.co
   export PROD_SUPABASE_SERVICE_KEY=eyJxxx
   ```

2. Export workflows:
   ```bash
   npm run n8n:create-history
   ```

3. Review generated migrations
4. Create PR for team review
5. Merge after approval

### Automated Sync

GitHub Action runs weekly to sync from prod. Review and merge the PR when it's created.

## Troubleshooting

### Migration Failed

Check the error message and:
1. Verify database is running
2. Check migration SQL syntax
3. Look for conflicts with existing workflows

### Workflow Not Appearing

1. Check migration was applied: `npm run n8n:migrate-up`
2. Verify workflow in database: `psql ... -c "SELECT name FROM n8n_workflows;"`
3. Restart n8n: `docker-compose restart n8n`
```

**Action Items:**
- [ ] Create team guide
- [ ] Share with team in Slack/email
- [ ] Add to onboarding docs

### Step 4.4: Create Video Walkthrough

**Action Items:**
- [ ] Record screen demo showing:
  - Creating workflow in n8n
  - Exporting to migration
  - Committing to Git
  - Other team member receiving workflow
  - Prod sync process
- [ ] Upload to internal wiki/Loom
- [ ] Share with team

---

## Completion Checklist

### Phase 1: Core Infrastructure
- [ ] Migration metadata table created
- [ ] `migrate-up.sh` script working
- [ ] `create-migration.sh` script working
- [ ] Root scripts added to package.json
- [ ] Dev server auto-runs migrations
- [ ] All tests passing

### Phase 2: Production Sync
- [ ] `create-history-migration.sh` script working
- [ ] TypeScript prod export tool working
- [ ] Can export single prod workflow
- [ ] Can export multiple prod workflows
- [ ] Migrations have correct prefix and metadata

### Phase 3: Automation
- [ ] Production scripts run migrations
- [ ] GitHub Action created and tested
- [ ] PR template created
- [ ] Weekly sync is working

### Phase 4: Polish
- [ ] Migration validation added
- [ ] Rollback guide created
- [ ] Team guide created
- [ ] Video walkthrough created
- [ ] Team trained on system

---

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Review prod-sync PRs
- [ ] Check for migration conflicts
- [ ] Update team on new workflows

**Monthly:**
- [ ] Review migration metadata
- [ ] Clean up old migrations (optional)
- [ ] Check for workflow duplication

**Quarterly:**
- [ ] Review and update documentation
- [ ] Collect team feedback
- [ ] Improve automation based on usage

### Monitoring

Add alerts for:
- Failed migrations
- GitHub Action failures
- Large migrations (>100KB)
- Migrations with credentials detected

---

## Success Metrics

Track these metrics after implementation:

- Number of workflows synced per week
- Time saved vs manual export/import
- Migration failures per month
- Team adoption rate
- Production incidents related to workflows

Target:
- ✅ Zero manual workflow transfers
- ✅ <5 minutes from creation to team availability
- ✅ <1% migration failure rate
- ✅ 100% team adoption in 2 weeks
