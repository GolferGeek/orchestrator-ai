# Database Snapshot Management for Interns

## Problem Statement

The current migration workflow creates friction between the lead developer and interns:

1. **Pace Mismatch**: Lead developer moves faster than interns can keep up with migrations
2. **Git Proficiency Gap**: Interns struggle with Git, leading to migrations in wrong locations
3. **Schema Complexity**: Multiple schemas (public, n8n, company, observability) make manual sync difficult
4. **Data Synchronization**: Reference data (agents, providers, models) needs to be shared consistently

### Current Pain Points

- Interns don't know where to place migration files
- Manual migration tracking is error-prone
- Git conflicts and merge issues slow down development
- Database state divergence between lead and intern environments
- No easy way to "reset" to a known good state

## Objectives

Create a simplified database distribution system that:

1. ✅ Exports complete database state (4 schemas) to a single migration file
2. ✅ Exports seed data (agents, providers, models) to a separate file
3. ✅ Maintains individual JSON files for agents and N8N workflows as source of truth
4. ✅ Provides simple, Git-independent application scripts for interns
5. ✅ Maintains timestamped snapshots for version history
6. ✅ Includes validation to verify successful application
7. ✅ Enables granular updates of individual agents and workflows without full database snapshots

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Lead Developer                           │
│                                                              │
│  Full Snapshot:                                              │
│  1. Makes changes to database                                │
│  2. Runs: npm run db:export-snapshot                         │
│  3. Shares storage/snapshots/latest/ directory               │
│                                                              │
│  Granular Updates:                                           │
│  1. Modifies/creates an agent or N8N workflow                │
│  2. Runs: npm run db:export-agent <name> OR                  │
│          npm run db:export-n8n-workflow <name>               │
│  3. Shares individual JSON file from agents/ or n8n/         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Shared Directory/Storage                    │
│                                                              │
│  storage/snapshots/                                          │
│  ├── latest/                                                 │
│  │   ├── schema.sql          (4 schemas combined)            │
│  │   └── seed.sql            (agents, providers, models)     │
│  ├── agents/                (Source of truth for agents)     │
│  │   ├── blog-post-writer.json                               │
│  │   └── marketing-swarm.json                                │
│  └── n8n/                   (Source of truth for workflows)  │
│      ├── marketing-workflow.json                             │
│      └── automation-helper.json                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Interns                               │
│                                                              │
│  Full Synchronization:                                       │
│  1. Receives latest/ directory (Dropbox/Drive/USB/etc)      │
│  2. Runs: npm run db:apply-snapshot                          │
│  3. Database is synchronized to lead's state                 │
│                                                              │
│  Granular Updates:                                           │
│  1. Receives single agent or workflow JSON file              │
│  2. Runs: npm run db:import-agent <file> OR                  │
│          npm run db:import-n8n-workflow <file>               │
│  3. Specific agent/workflow updated without full sync        │
└─────────────────────────────────────────────────────────────┘
```

### Schema Export Strategy

Use `pg_dump` to export all 4 schemas into a single consolidated file:

- **public**: Core application tables
- **n8n**: n8n workflow data and configuration
- **company**: Company-specific data and models
- **observability**: Observability events and metrics

**Key Features**:
- Include `DROP SCHEMA IF EXISTS ... CASCADE` for clean reinstall
- Include `CREATE SCHEMA IF NOT EXISTS` for idempotency
- Export schema structure only (no data except for seed data)
- Maintain foreign key relationships and constraints
- Include indexes, triggers, and functions

### Seed Data Strategy

Export reference data from specific tables that should be shared:

**Tables to Export**:
- `agents`: AI agent configurations
- `providers`: LLM provider configurations
- `models`: Available model definitions

**Key Features**:
- Use `TRUNCATE ... CASCADE` followed by `INSERT` statements
- Include `ON CONFLICT` clauses for upsert behavior
- Maintain referential integrity during import
- Small, curated dataset (not full production data)

### Agent and N8N Workflow Management Strategy

**Philosophy**: Individual JSON files serve as the source of truth for agents and workflows, enabling:
- Granular updates without affecting other configurations
- Easy distribution and synchronization between team members
- Ability to recreate database tables from JSON files
- No Git knowledge required for updates

**Agent Management** (`storage/snapshots/agents/`):
- Each agent stored as a separate JSON file (e.g., `blog-post-writer.json`)
- JSON files can be inserted into or deleted/reinserted from the database
- Interns can update individual agent configurations by replacing JSON files
- Database `agents` table can be fully reconstructed from these files

**N8N Workflow Management** (`storage/snapshots/n8n/`):
- Each N8N workflow exported as a separate JSON file (N8N native export format)
- JSON files can be imported directly into N8N instances
- Workflows can be version-controlled through simple file replacement
- Database `n8n` schema can be synchronized with these workflow files

**Update Workflow**:
1. Intern/developer modifies an agent or workflow
2. Export to corresponding JSON file in `storage/snapshots/agents/` or `storage/snapshots/n8n/`
3. Share the updated JSON file(s) with team
4. Team members import/apply the JSON file(s) to their local databases
5. No need to understand full database snapshots or Git workflows

### File Structure

```
storage/
└── snapshots/
    ├── latest/                    # Symlink or copy of most recent
    │   ├── schema.sql
    │   ├── seed.sql
    │   └── metadata.json          # Timestamp, version info
    ├── agents/                    # Individual agent JSON files
    │   ├── blog-post-writer.json
    │   ├── marketing-swarm.json
    │   └── research-assistant.json
    ├── n8n/                       # Individual N8N workflow JSON files
    │   ├── marketing-workflow.json
    │   ├── automation-helper.json
    │   └── data-sync.json
    ├── 2025-01-27-143022/         # Timestamped snapshots
    │   ├── schema.sql
    │   ├── seed.sql
    │   └── metadata.json
    └── 2025-01-26-092015/
        ├── schema.sql
        ├── seed.sql
        └── metadata.json
```

**Note**: Individual JSON files for agents and N8N workflows serve as the source of truth and allow for granular version control and updates without Git knowledge.

## Implementation Guide

### Phase 1: Export Script Creation

**File**: `scripts/db/export-snapshot.sh`

```bash
#!/bin/bash
# Export database snapshot for intern distribution

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="storage/snapshots/$TIMESTAMP"
LATEST_DIR="storage/snapshots/latest"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

# Create snapshot directory
mkdir -p "$SNAPSHOT_DIR"

echo "📸 Creating database snapshot: $TIMESTAMP"

# Export schemas (structure only)
echo "📦 Exporting schemas: public, n8n, company, observability..."
PGPASSWORD=postgres pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=public \
  --schema=n8n \
  --schema=company \
  --schema=observability \
  --schema-only \
  --no-owner \
  --no-acl \
  -f "$SNAPSHOT_DIR/schema.sql"

# Add drop statements at the beginning
echo "🧹 Adding cleanup statements..."
cat > "$SNAPSHOT_DIR/schema.tmp" << 'EOF'
-- Database Snapshot
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Schemas: public, n8n, company, observability

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS observability CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
-- Note: public schema is not dropped as it's required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS observability;

EOF

cat "$SNAPSHOT_DIR/schema.sql" >> "$SNAPSHOT_DIR/schema.tmp"
mv "$SNAPSHOT_DIR/schema.tmp" "$SNAPSHOT_DIR/schema.sql"

# Export seed data
echo "🌱 Exporting seed data..."
PGPASSWORD=postgres pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table=public.agents \
  --table=public.providers \
  --table=public.models \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  -f "$SNAPSHOT_DIR/seed.sql"

# Add truncate statements at the beginning
cat > "$SNAPSHOT_DIR/seed.tmp" << 'EOF'
-- Seed Data Export
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Tables: agents, providers, models

-- Clear existing data
TRUNCATE TABLE public.agents CASCADE;
TRUNCATE TABLE public.providers CASCADE;
TRUNCATE TABLE public.models CASCADE;

EOF

cat "$SNAPSHOT_DIR/seed.sql" >> "$SNAPSHOT_DIR/seed.tmp"
mv "$SNAPSHOT_DIR/seed.tmp" "$SNAPSHOT_DIR/seed.sql"

# Create metadata file
cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "schemas": ["public", "n8n", "company", "observability"],
  "seed_tables": ["agents", "providers", "models"],
  "db_host": "$DB_HOST",
  "db_port": "$DB_PORT"
}
EOF

# Update 'latest' symlink/directory
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"

echo "✅ Snapshot created successfully!"
echo "📂 Location: $SNAPSHOT_DIR"
echo "🔗 Latest: $LATEST_DIR"
echo ""
echo "📤 Share the 'storage/snapshots/latest' directory with interns"
```

**Add to package.json**:
```json
{
  "scripts": {
    "db:export-snapshot": "bash scripts/db/export-snapshot.sh"
  }
}
```

### Phase 2: Apply Script Creation

**File**: `scripts/db/apply-snapshot.sh`

```bash
#!/bin/bash
# Apply database snapshot (for interns)

set -e  # Exit on error

# Configuration
SNAPSHOT_DIR="${1:-storage/snapshots/latest}"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔄 Applying database snapshot from: $SNAPSHOT_DIR"
echo ""

# Check if snapshot exists
if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo -e "${RED}❌ Error: Snapshot directory not found: $SNAPSHOT_DIR${NC}"
  exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/schema.sql" ]; then
  echo -e "${RED}❌ Error: schema.sql not found in snapshot${NC}"
  exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/seed.sql" ]; then
  echo -e "${RED}❌ Error: seed.sql not found in snapshot${NC}"
  exit 1
fi

# Display metadata if available
if [ -f "$SNAPSHOT_DIR/metadata.json" ]; then
  echo "📋 Snapshot Info:"
  cat "$SNAPSHOT_DIR/metadata.json" | grep -E "(timestamp|created_at)" || true
  echo ""
fi

# Confirmation prompt
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your current database schemas!${NC}"
echo -e "${YELLOW}   - All data in: public, n8n, company, observability will be DELETED${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "❌ Aborted by user"
  exit 0
fi

# Apply schema
echo ""
echo "🔧 Applying schema migration..."
PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$SNAPSHOT_DIR/schema.sql" \
  -v ON_ERROR_STOP=1

echo -e "${GREEN}✅ Schema applied successfully${NC}"

# Apply seed data
echo ""
echo "🌱 Applying seed data..."
PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$SNAPSHOT_DIR/seed.sql" \
  -v ON_ERROR_STOP=1

echo -e "${GREEN}✅ Seed data applied successfully${NC}"

# Success message
echo ""
echo -e "${GREEN}🎉 Database snapshot applied successfully!${NC}"
echo ""
echo "📊 Next steps:"
echo "  1. Verify your application is working correctly"
echo "  2. Run any additional setup scripts if needed"
echo "  3. Start developing!"
```

**Add to package.json**:
```json
{
  "scripts": {
    "db:apply-snapshot": "bash scripts/db/apply-snapshot.sh",
    "db:apply-snapshot:specific": "bash scripts/db/apply-snapshot.sh"
  }
}
```

### Phase 3: Validation Script

**File**: `scripts/db/verify-snapshot.sh`

```bash
#!/bin/bash
# Verify database matches expected snapshot state

set -e

DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

echo "🔍 Verifying database state..."
echo ""

# Check schemas exist
echo "📂 Checking schemas..."
SCHEMAS=$(PGPASSWORD=postgres psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT schema_name
  FROM information_schema.schemata
  WHERE schema_name IN ('public', 'n8n', 'company', 'observability')
  ORDER BY schema_name;
")

EXPECTED=("company" "n8n" "observability" "public")
FOUND=($SCHEMAS)

for schema in "${EXPECTED[@]}"; do
  if [[ " ${FOUND[@]} " =~ " ${schema} " ]]; then
    echo "  ✅ $schema"
  else
    echo "  ❌ $schema (missing)"
  fi
done

# Check seed tables exist and have data
echo ""
echo "🌱 Checking seed data tables..."

for table in "agents" "providers" "models"; do
  COUNT=$(PGPASSWORD=postgres psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT COUNT(*) FROM public.$table;
  " | xargs)

  if [ "$COUNT" -gt 0 ]; then
    echo "  ✅ $table ($COUNT rows)"
  else
    echo "  ⚠️  $table (0 rows - might be empty)"
  fi
done

echo ""
echo "✅ Verification complete!"
```

**Add to package.json**:
```json
{
  "scripts": {
    "db:verify": "bash scripts/db/verify-snapshot.sh"
  }
}
```

### Phase 4: Distribution Process Documentation

**File**: `docs/intern-database-setup.md`

```markdown
# Intern Database Setup Guide

## Getting Your Database Synchronized

### Prerequisites

1. Supabase CLI installed and running locally
2. Project cloned or downloaded
3. Access to the `storage/snapshots/latest` directory

### Step-by-Step Instructions

#### 1. Ensure Supabase is Running

```bash
# Start Supabase (if not already running)
npx supabase start
```

Wait for it to finish starting up. You should see output indicating services are ready.

#### 2. Apply the Database Snapshot

```bash
# From project root directory
npm run db:apply-snapshot
```

**What this does:**
- Replaces your local database with the latest snapshot from the lead developer
- Includes all schemas: public, n8n, company, observability
- Includes seed data: agents, providers, models

**Important**: This will DELETE your current database data. Make sure you don't have any important local changes.

#### 3. Verify Everything Worked

```bash
npm run db:verify
```

You should see checkmarks (✅) for all schemas and seed tables.

#### 4. Start Development

Your database is now synchronized with the lead developer's state. You can start working on your assigned tasks.

### Getting Updates

When the lead developer tells you there's a new database snapshot:

1. Get the updated `storage/snapshots/latest` directory (via Dropbox, Google Drive, USB, etc.)
2. Run `npm run db:apply-snapshot` again
3. Continue development

### Troubleshooting

**Error: "Snapshot directory not found"**
- Make sure you have the `storage/snapshots/latest` directory in your project
- Check that it contains `schema.sql` and `seed.sql` files

**Error: "Connection refused"**
- Supabase might not be running. Run `npx supabase start`
- Check that Supabase is running on port 7012: `lsof -i :7012`

**Error: "Permission denied"**
- On Mac/Linux, you might need to make scripts executable:
  ```bash
  chmod +x scripts/db/*.sh
  ```

**Something looks wrong after applying**
- Try stopping and restarting Supabase:
  ```bash
  npx supabase stop
  npx supabase start
  npm run db:apply-snapshot
  ```

### Need Help?

Contact the lead developer if:
- The scripts fail with unexpected errors
- Your application doesn't work after applying the snapshot
- You're not sure if your database is in the right state
```

## Potential Challenges & Solutions

### Challenge 1: Large Database Size

**Problem**: Snapshots become too large to share easily

**Solutions**:
- Compress snapshot directories: `tar -czf snapshot.tar.gz storage/snapshots/latest/`
- Use cloud storage (Dropbox, Google Drive) for automatic sync
- Consider excluding large blob/file storage tables from snapshots
- Implement a snapshot size check in export script

### Challenge 2: Schema Dependencies

**Problem**: Foreign keys and dependencies cause import failures

**Solutions**:
- Use `--schema-only` first, then data-only imports
- Explicitly order schema creation (n8n → company → observability)
- Temporarily disable triggers during import: `SET session_replication_role = replica;`
- Use CASCADE in DROP statements

### Challenge 3: Supabase Not Running

**Problem**: Interns forget to start Supabase before applying

**Solutions**:
- Add Supabase status check to apply script
- Auto-start Supabase if not running
- Clear error messages with remediation steps

**Implementation**:
```bash
# Check if Supabase is running
if ! lsof -i :7012 > /dev/null 2>&1; then
  echo "⚠️  Supabase is not running!"
  echo "Starting Supabase..."
  npx supabase start
fi
```

### Challenge 4: Partial Application Failures

**Problem**: Schema applies but seed data fails, leaving DB in inconsistent state

**Solutions**:
- Wrap all operations in a transaction where possible
- Create backup before apply
- Implement rollback mechanism
- Add `--single-transaction` flag to psql

### Challenge 5: Data Conflicts on Seed Import

**Problem**: Seed data has ID conflicts with existing data

**Solutions**:
- Use `TRUNCATE` before INSERT to clear existing data
- Use `ON CONFLICT DO UPDATE` for upsert behavior
- Reset sequences after import: `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));`

## Testing Strategy

### Unit Tests

Test individual script components:

```bash
# Test 1: Export creates required files
test_export() {
  npm run db:export-snapshot
  assert_file_exists "storage/snapshots/latest/schema.sql"
  assert_file_exists "storage/snapshots/latest/seed.sql"
  assert_file_exists "storage/snapshots/latest/metadata.json"
}

# Test 2: Schema file contains all schemas
test_schema_content() {
  local schema_file="storage/snapshots/latest/schema.sql"
  assert_file_contains "$schema_file" "CREATE SCHEMA IF NOT EXISTS n8n"
  assert_file_contains "$schema_file" "CREATE SCHEMA IF NOT EXISTS company"
  assert_file_contains "$schema_file" "CREATE SCHEMA IF NOT EXISTS observability"
}

# Test 3: Seed file contains all tables
test_seed_content() {
  local seed_file="storage/snapshots/latest/seed.sql"
  assert_file_contains "$seed_file" "TRUNCATE TABLE public.agents"
  assert_file_contains "$seed_file" "INSERT INTO public.agents"
  assert_file_contains "$seed_file" "INSERT INTO public.providers"
  assert_file_contains "$seed_file" "INSERT INTO public.models"
}
```

### Integration Tests

Test full workflow:

```bash
# Test 4: Full export-apply cycle
test_full_cycle() {
  # Export from source DB
  npm run db:export-snapshot

  # Reset DB to blank state
  npx supabase db reset

  # Apply snapshot
  npm run db:apply-snapshot

  # Verify
  npm run db:verify
  assert_exit_code 0
}

# Test 5: Idempotency - applying twice should work
test_idempotency() {
  npm run db:apply-snapshot
  npm run db:apply-snapshot  # Apply again
  npm run db:verify
  assert_exit_code 0
}
```

### Manual Testing Checklist

- [ ] Export snapshot from development database
- [ ] Create fresh Supabase instance
- [ ] Apply snapshot to fresh instance
- [ ] Verify all schemas exist
- [ ] Verify all seed tables have data
- [ ] Run application and verify functionality
- [ ] Test with intern on their machine
- [ ] Verify process takes < 5 minutes
- [ ] Confirm error messages are clear and actionable

## Success Criteria

### Functional Requirements

- ✅ Single command exports all 4 schemas to one file
- ✅ Single command exports seed data to separate file
- ✅ Single command applies both schema and seed data
- ✅ Validation command verifies successful application
- ✅ Process works without Git knowledge
- ✅ Clear error messages and troubleshooting guidance

### Performance Requirements

- ✅ Export completes in < 60 seconds
- ✅ Apply completes in < 120 seconds
- ✅ Snapshot size < 50MB uncompressed (adjust based on actual size)

### Usability Requirements

- ✅ Intern can complete process with zero errors on first try
- ✅ Process documented with step-by-step instructions
- ✅ Clear confirmation messages at each step
- ✅ Dangerous operations require explicit confirmation

### Reliability Requirements

- ✅ Scripts handle edge cases gracefully
- ✅ Failed applies don't leave database in broken state
- ✅ Scripts are idempotent (can run multiple times safely)
- ✅ All operations use transactions where possible

## Agent and N8N Workflow Tooling

### Export Individual Agent to JSON

**File**: `scripts/db/export-agent.sh`

```bash
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
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting agent: $AGENT_NAME"

# Export agent as JSON
PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
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

echo "✅ Agent exported to: $OUTPUT_DIR/${AGENT_NAME}.json"
```

**Add to package.json**:
```json
{
  "scripts": {
    "db:export-agent": "bash scripts/db/export-agent.sh",
    "db:import-agent": "bash scripts/db/import-agent.sh"
  }
}
```

### Import Individual Agent from JSON

**File**: `scripts/db/import-agent.sh`

```bash
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
  exit 1
fi

if [ ! -f "$AGENT_FILE" ]; then
  echo "❌ Error: File not found: $AGENT_FILE"
  exit 1
fi

echo "📥 Importing agent from: $AGENT_FILE"

# Read JSON and insert/update agent
AGENT_JSON=$(cat "$AGENT_FILE")

PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "
    INSERT INTO public.agents (
      id, name, description, system_prompt,
      model_id, temperature, max_tokens
    )
    SELECT
      (data->>'id')::uuid,
      data->>'name',
      data->>'description',
      data->>'system_prompt',
      (data->>'model_id')::uuid,
      (data->>'temperature')::numeric,
      (data->>'max_tokens')::integer
    FROM json_array_elements('[$AGENT_JSON]'::json) AS data
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      system_prompt = EXCLUDED.system_prompt,
      model_id = EXCLUDED.model_id,
      temperature = EXCLUDED.temperature,
      max_tokens = EXCLUDED.max_tokens,
      updated_at = NOW();
  "

echo "✅ Agent imported successfully"
```

### Export All Agents to JSON Files

**File**: `scripts/db/export-all-agents.sh`

```bash
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
AGENT_NAMES=$(PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "SELECT name FROM public.agents ORDER BY name;")

COUNT=0
for name in $AGENT_NAMES; do
  npm run db:export-agent "$name"
  COUNT=$((COUNT + 1))
done

echo "✅ Exported $COUNT agents to: $OUTPUT_DIR"
```

### Export N8N Workflow to JSON

**File**: `scripts/db/export-n8n-workflow.sh`

```bash
#!/bin/bash
# Export a single N8N workflow to JSON file

set -e

WORKFLOW_NAME="$1"
OUTPUT_DIR="storage/snapshots/n8n"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$WORKFLOW_NAME" ]; then
  echo "Usage: npm run db:export-n8n-workflow <workflow-name>"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

echo "📤 Exporting N8N workflow: $WORKFLOW_NAME"

# Export workflow as JSON (N8N native format)
PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -t -c "
    SELECT data
    FROM n8n.workflow_entity
    WHERE name = '$WORKFLOW_NAME';
  " | jq '.' > "$OUTPUT_DIR/${WORKFLOW_NAME}.json"

echo "✅ Workflow exported to: $OUTPUT_DIR/${WORKFLOW_NAME}.json"
```

### Import N8N Workflow from JSON

**File**: `scripts/db/import-n8n-workflow.sh`

```bash
#!/bin/bash
# Import a single N8N workflow from JSON file

set -e

WORKFLOW_FILE="$1"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

if [ -z "$WORKFLOW_FILE" ]; then
  echo "Usage: npm run db:import-n8n-workflow <path-to-workflow.json>"
  exit 1
fi

if [ ! -f "$WORKFLOW_FILE" ]; then
  echo "❌ Error: File not found: $WORKFLOW_FILE"
  exit 1
fi

echo "📥 Importing N8N workflow from: $WORKFLOW_FILE"

# Read JSON and insert/update workflow
WORKFLOW_JSON=$(cat "$WORKFLOW_FILE" | jq -c '.')

# Note: This requires the N8N schema structure - adjust based on actual schema
PGPASSWORD=postgres psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "
    INSERT INTO n8n.workflow_entity (data)
    VALUES ('$WORKFLOW_JSON'::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data;
  "

echo "✅ Workflow imported successfully"
```

**Add to package.json**:
```json
{
  "scripts": {
    "db:export-all-agents": "bash scripts/db/export-all-agents.sh",
    "db:export-n8n-workflow": "bash scripts/db/export-n8n-workflow.sh",
    "db:import-n8n-workflow": "bash scripts/db/import-n8n-workflow.sh",
    "db:export-all-n8n": "bash scripts/db/export-all-n8n-workflows.sh"
  }
}
```

## Future Enhancements

### Phase 5: Web UI for Distribution (Optional)

Create a simple web interface for snapshot management:

```
http://localhost:3000/snapshots
  - List available snapshots
  - One-click download latest
  - One-click apply (with confirmation)
  - View metadata and diff between versions
```

### Phase 6: Automated Distribution (Optional)

Integrate with file sharing services:

- Automatic upload to Dropbox/Google Drive after export
- Notification system (email/Slack) when new snapshot available
- Download snapshots directly from cloud storage

### Phase 7: Differential Snapshots (Optional)

Only export changes since last snapshot:

- Reduce snapshot size
- Faster application
- Track history of specific schema changes

### Phase 8: Snapshot Comparison Tool (Optional)

Help interns understand what changed:

```bash
npm run db:diff-snapshot <old> <new>
```

Shows:
- New tables/columns
- Removed tables/columns
- Data changes in seed tables

## Implementation Plan

### Phase 1: Create Directory Structure & Copy Existing Files
**Estimated Time**: 1 hour

1. Create new directory structure:
   ```bash
   mkdir -p storage/snapshots/agents
   mkdir -p storage/snapshots/n8n
   mkdir -p storage/scripts
   ```

2. Copy existing TypeScript agent scripts from `initial-agent-building/scripts/` to `storage/scripts/`:
   - Copy (not move) these scripts as reference:
     - `list-agents.ts`
     - `export-agent.ts`
     - `load-agent.ts`
     - `delete-agent.ts`
     - `export-all-agents.ts`
   - These will serve as reference for creating new bash scripts
   - Keep originals in `initial-agent-building/` for now

3. Copy existing agent JSON files to new location:
   - Copy `initial-agent-building/working/demo_supabase_agent.json` to `storage/snapshots/agents/`
   - Copy `initial-agent-building/exported/demo_supabase-agent.json` to `storage/snapshots/agents/`
   - Ensure consistent naming convention (e.g., use underscores or hyphens consistently)

4. Export current N8N workflows to JSON:
   - Export the 3 existing N8N workflows from N8N instance/database
   - Save them to `storage/snapshots/n8n/`
   - Use descriptive filenames matching workflow names

**Deliverables**:
- `storage/snapshots/agents/` populated with existing agent JSON files
- `storage/snapshots/n8n/` populated with 3 workflow JSON files
- `storage/scripts/` containing copied TypeScript scripts as reference
- Directory structure ready for new scripts

### Phase 2: Create Database Management Scripts
**Estimated Time**: 5-6 hours

Create NEW bash scripts in `storage/scripts/` (using TypeScript scripts from `initial-agent-building/scripts/` as reference):

1. **Agent Management** (CREATE NEW bash scripts based on existing TypeScript logic):
   - `export-agent.sh` - Export single agent to JSON from public.agents table
   - `import-agent.sh` - Import/upsert agent from JSON to public.agents table
   - `export-all-agents.sh` - Export all agents to individual JSON files
   - `import-all-agents.sh` - Import all agents from storage/snapshots/agents/
   - `sync-agents-to-db.sh` - Sync all JSON files to database (delete missing, upsert existing)

   **Note**: Reference the TypeScript implementations but create new bash scripts that:
   - Use psql/PGPASSWORD for direct database access
   - Use jq for JSON manipulation
   - Support upsert operations (INSERT ON CONFLICT UPDATE)
   - Work without requiring TypeScript/Node.js runtime

2. **N8N Workflow Management** (CREATE ALL NEW - no existing scripts):
   - `export-n8n-workflow.sh` - Export single workflow to JSON from n8n schema
   - `import-n8n-workflow.sh` - Import/upsert workflow to n8n schema from JSON
   - `export-all-n8n-workflows.sh` - Export all workflows to individual JSON files
   - `import-all-n8n-workflows.sh` - Import all workflows from storage/snapshots/n8n/
   - `sync-n8n-to-db.sh` - Sync all workflow JSON files to database

   **Note**: N8N scripts need to:
   - Query the `n8n.workflow_entity` table (or equivalent - need to verify actual table structure)
   - Handle N8N's native JSON workflow format
   - Preserve workflow IDs, connections, and node configurations
   - Support upsert operations for updating existing workflows

3. **Combined Operations** (NEW):
   - `sync-all.sh` - Sync both agents and N8N workflows to database
   - `export-all.sh` - Export both agents and N8N workflows to JSON files

**Deliverables**:
- All new bash scripts created in `storage/scripts/`
- Scripts support upsert operations (INSERT ON CONFLICT UPDATE)
- Clear error messages and validation
- Scripts work independently of TypeScript/Node.js
- NPM scripts added to root package.json for easy access

### Phase 3: Create Full Snapshot Scripts
**Estimated Time**: 2-3 hours

1. Create `storage/scripts/export-snapshot.sh`:
   - Export all 4 schemas (public, n8n, company, observability)
   - Export seed data (agents, providers, models)
   - Create timestamped snapshot directory
   - Update `latest/` symlink

2. Create `storage/scripts/apply-snapshot.sh`:
   - Apply schema.sql with confirmation prompt
   - Apply seed.sql
   - Validate successful application

**Deliverables**:
- `storage/scripts/export-snapshot.sh`
- `storage/scripts/apply-snapshot.sh`
- NPM scripts for easy execution

### Phase 4: Create Validation & Verification Scripts
**Estimated Time**: 1-2 hours

1. Create `storage/scripts/verify-snapshot.sh`:
   - Verify all schemas exist
   - Check seed tables have data
   - Validate schema structure

2. Create `storage/scripts/verify-agents.sh`:
   - Count agents in database vs JSON files
   - List any mismatches
   - Validate JSON structure

3. Create `storage/scripts/verify-n8n.sh`:
   - Count workflows in database vs JSON files
   - List any mismatches
   - Validate workflow JSON structure

**Deliverables**:
- Verification scripts for all components
- Clear output showing status of each component

### Phase 5: Update Package.json & Documentation
**Estimated Time**: 1-2 hours

1. Add all NPM scripts to root `package.json`:
   ```json
   {
     "scripts": {
       "db:export-snapshot": "bash storage/scripts/export-snapshot.sh",
       "db:apply-snapshot": "bash storage/scripts/apply-snapshot.sh",
       "db:verify": "bash storage/scripts/verify-snapshot.sh",

       "db:export-agent": "bash storage/scripts/export-agent.sh",
       "db:import-agent": "bash storage/scripts/import-agent.sh",
       "db:export-all-agents": "bash storage/scripts/export-all-agents.sh",
       "db:import-all-agents": "bash storage/scripts/import-all-agents.sh",
       "db:sync-agents": "bash storage/scripts/sync-agents-to-db.sh",
       "db:verify-agents": "bash storage/scripts/verify-agents.sh",

       "db:export-n8n": "bash storage/scripts/export-n8n-workflow.sh",
       "db:import-n8n": "bash storage/scripts/import-n8n-workflow.sh",
       "db:export-all-n8n": "bash storage/scripts/export-all-n8n-workflows.sh",
       "db:import-all-n8n": "bash storage/scripts/import-all-n8n-workflows.sh",
       "db:sync-n8n": "bash storage/scripts/sync-n8n-to-db.sh",
       "db:verify-n8n": "bash storage/scripts/verify-n8n.sh",

       "db:sync-all": "bash storage/scripts/sync-all.sh",
       "db:export-all": "bash storage/scripts/export-all.sh"
     }
   }
   ```

2. Update/create `storage/README.md` with:
   - Overview of directory structure
   - Purpose of agents/ and n8n/ directories
   - How to use scripts for common tasks
   - Workflow for interns

3. Create `storage/scripts/README.md` with:
   - Description of each script
   - Usage examples
   - Common workflows

**Deliverables**:
- Updated package.json with all scripts
- Comprehensive documentation
- Quick-start guide for interns

### Phase 6: Testing & Validation
**Estimated Time**: 2-3 hours

1. **Unit Testing**:
   - Test each script individually
   - Verify error handling
   - Test with missing files, bad JSON, etc.

2. **Integration Testing**:
   - Test full export-import cycle for agents
   - Test full export-import cycle for N8N workflows
   - Test full snapshot cycle
   - Test sync operations

3. **Intern Workflow Testing**:
   - Simulate intern receiving agent JSON file
   - Test import process
   - Verify database state
   - Document any issues

**Deliverables**:
- All scripts tested and working
- Test results documented
- Any bugs fixed

## Implementation Timeline Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1** | Directory structure & copy existing files | 1 hour |
| **Phase 2** | Create NEW bash scripts for agents & N8N | 5-6 hours |
| **Phase 3** | Full snapshot scripts | 2-3 hours |
| **Phase 4** | Validation scripts | 1-2 hours |
| **Phase 5** | Documentation & package.json | 1-2 hours |
| **Phase 6** | Testing & validation | 2-3 hours |
| **Total** | | **12-17 hours** |

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss from incorrect apply | High | Low | Confirmation prompts, backups |
| Large snapshot size | Medium | Medium | Compression, cloud storage |
| Schema dependency issues | High | Medium | Proper ordering, CASCADE |
| Supabase not running | Low | High | Auto-detection, auto-start |
| Intern confusion | Medium | Low | Clear docs, error messages |

## Appendix: Alternative Approaches Considered

### Alternative 1: Git-Based Migrations

**Pros**: Standard approach, version control integration
**Cons**: Requires Git proficiency, complex for interns
**Decision**: Rejected due to intern Git knowledge gap

### Alternative 2: Docker Database Images

**Pros**: Complete environment snapshot, guaranteed consistency
**Cons**: Large file sizes, requires Docker knowledge, slower to apply
**Decision**: Rejected due to complexity and file size

### Alternative 3: Migration Tool (Flyway/Liquibase)

**Pros**: Industry standard, handles versioning automatically
**Cons**: Learning curve, overkill for small team
**Decision**: Rejected due to setup complexity

### Alternative 4: Supabase Migration System

**Pros**: Native to Supabase, integrated with CLI
**Cons**: Still requires Git for sharing, doesn't solve intern issue
**Decision**: Rejected as it doesn't address core problem

### Selected Approach: SQL Snapshots

**Pros**:
- Simple file-based distribution
- No Git required
- Works with any file sharing method
- Easy to understand and debug
- Fast to implement

**Cons**:
- Less sophisticated than migration tools
- Manual distribution process
- No automatic conflict resolution

**Decision**: Best fit for current team structure and skill levels
