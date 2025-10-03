# PRD: Bidirectional n8n Workflow Sync System

## Overview

Create a migration-based system to synchronize n8n workflows between development and production environments while preserving execution history, credentials, and other operational data.

## Problem Statement

Currently, n8n workflows created on one machine cannot be easily shared with other team members or synchronized between dev/prod environments. Manual export/import is error-prone and doesn't integrate with our existing Supabase migration system.

## Goals

1. **Dev → Prod**: Developers can create workflows locally and deploy them to production via migrations
2. **Prod → Dev**: Production workflows can be synced back to development environments for testing/debugging
3. **Preserve History**: All migrations must preserve execution history, credentials, and operational data
4. **Automated**: Migrations run automatically during dev startup and prod deployment
5. **Reviewable**: All changes go through Git for review and audit trail

## Non-Goals

- Syncing execution history between environments
- Syncing credentials (these remain environment-specific)
- Real-time synchronization (batch-based is acceptable)

## User Stories

### Story 1: Developer Creates New Workflow
**As a** developer
**I want to** create an n8n workflow locally and have it automatically available to my team
**So that** we can collaborate on automation workflows

**Acceptance Criteria:**
- Developer creates workflow in local n8n UI
- Developer runs script to export workflow as migration
- Migration is committed to Git
- Other team members pull and get the workflow automatically

### Story 2: Admin Updates Production Workflow
**As a** production admin
**I want to** export production workflows as migrations
**So that** developers can test/debug with real production workflows

**Acceptance Criteria:**
- Admin runs script to export prod workflows
- Script creates migrations with `prod_sync_` prefix
- Migrations are committed via PR for review
- Dev environments apply migrations and get updated workflows

### Story 3: Automatic Migration on Startup
**As a** developer
**I want to** have migrations run automatically when I start the dev server
**So that** I always have the latest workflows without manual steps

**Acceptance Criteria:**
- `npm run dev:api` runs migrations before starting server
- Only new migrations are applied (incremental)
- Existing data is preserved
- Errors are clearly reported

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Git Repository                       │
│                                                              │
│  apps/api/supabase/migrations/                              │
│  ├── 20251003120000_add_agent_webhook.sql        (dev)     │
│  ├── 20251003130000_add_image_processor.sql      (dev)     │
│  └── 20251003140000_prod_sync_analytics.sql      (prod)    │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         │ git pull                           │ git pull
         ▼                                    ▼
┌──────────────────┐                ┌──────────────────┐
│   Dev Machine    │                │   Prod Server    │
│                  │                │                  │
│  npm run dev:api │                │  npm run server  │
│       │          │                │       │          │
│       ├─ migration up              │       ├─ migration up
│       └─ start server              │       └─ start server
│                  │                │                  │
│  Supabase (local)│                │  Supabase (prod) │
│  └─ n8n tables   │                │  └─ n8n tables   │
└──────────────────┘                └──────────────────┘
         │                                    │
         │                                    │
         └─────────── Bidirectional ─────────┘
                      Workflow Sync
```

### Migration Types

#### 1. Dev Migrations (Normal Flow)
```
Naming: YYYYMMDDHHMMSS_description.sql
Example: 20251003120000_add_agent_webhook.sql
Purpose: Deploy workflows from dev to prod
```

#### 2. Prod Sync Migrations (Reverse Flow)
```
Naming: YYYYMMDDHHMMSS_prod_sync_description.sql
Example: 20251003140000_prod_sync_analytics_workflow.sql
Purpose: Sync prod workflows back to dev
```

### File Structure

```
orchestrator-ai/
├── apps/
│   ├── api/
│   │   └── supabase/
│   │       └── migrations/
│   │           ├── YYYYMMDDHHMMSS_*.sql
│   │           └── ...
│   └── n8n/
│       └── scripts/
│           ├── create-migration.sh        # Export local workflow to migration
│           ├── create-history-migration.sh # Export prod workflow to migration
│           └── migrate-up.sh              # Apply migrations
├── scripts/
│   └── n8n/
│       ├── export-prod-workflows.ts       # TS implementation for prod export
│       └── utils.ts                       # Shared utilities
├── package.json                           # Root scripts
└── docs/
    └── feature/
        └── matt/
            └── n8n/
                ├── prd-bidirectional-workflow-sync.md
                └── implementation-plan.md
```

### Scripts

#### 1. `apps/n8n/scripts/create-migration.sh`
Exports a local workflow to a migration file.

```bash
#!/bin/bash
# Usage: ./create-migration.sh "Workflow Name"
```

**Responsibilities:**
- Query local Supabase for workflow by name
- Generate migration SQL with UPSERT logic
- Create timestamped migration file
- Report success/failure

#### 2. `apps/n8n/scripts/create-history-migration.sh`
Exports production workflow(s) to migration files.

```bash
#!/bin/bash
# Usage: ./create-history-migration.sh [workflow-name]
# If no name provided, exports all recently modified workflows
```

**Responsibilities:**
- Connect to prod Supabase (requires env vars)
- Query workflows modified in last N days
- Generate migrations with `prod_sync_` prefix
- Include metadata about prod origin
- Create PR-ready migrations

#### 3. `apps/n8n/scripts/migrate-up.sh`
Applies pending migrations to current environment.

```bash
#!/bin/bash
# Usage: ./migrate-up.sh
```

**Responsibilities:**
- Detect current environment (local/prod)
- Apply only unapplied migrations
- Track migration state in `supabase_migrations` table
- Report errors clearly
- Preserve all existing data

### Root Package.json Scripts

```json
{
  "scripts": {
    "n8n:create-migration": "cd apps/n8n && ./scripts/create-migration.sh",
    "n8n:create-history": "tsx scripts/n8n/export-prod-workflows.ts",
    "n8n:migrate-up": "cd apps/n8n && ./scripts/migrate-up.sh",
    "n8n:sync-from-prod": "npm run n8n:create-history && git add apps/api/supabase/migrations && git status",

    "dev:api": "npm run n8n:migrate-up && cd apps/api && npm run start:dev",
    "prod:start": "npm run n8n:migrate-up && cd apps/api && npm run start:prod",
    "prod:restart": "npm run n8n:migrate-up && pm2 restart orchestrator-api"
  }
}
```

### Migration SQL Template

```sql
-- Migration: YYYYMMDDHHMMSS_[prod_sync_]workflow_name.sql
-- Source: [dev|prod]
-- Workflow: Workflow Display Name
-- Last Updated: YYYY-MM-DD HH:MM:SS

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
  'uuid-here'::uuid,
  'Workflow Name',
  true,
  '[...]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
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
WHERE n8n_workflows.updated_at < EXCLUDED.updated_at;  -- Only update if newer

-- Track migration metadata
INSERT INTO migration_metadata (migration_file, source, workflow_id)
VALUES (
  'YYYYMMDDHHMMSS_workflow_name.sql',
  'dev',  -- or 'prod'
  'uuid-here'::uuid
)
ON CONFLICT (migration_file) DO NOTHING;
```

### Migration Metadata Table

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
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Create migration metadata table
- Implement `create-migration.sh` script
- Implement `migrate-up.sh` script
- Update `dev:api` to run migrations
- Test with sample workflows

### Phase 2: Production Sync
- Implement `create-history-migration.sh` script
- Create TypeScript prod export tool
- Add prod connection configuration
- Test prod → dev workflow sync

### Phase 3: Automation
- Integrate migrations into `prod:start` and `prod:restart`
- Add GitHub Actions for scheduled prod sync
- Create PR template for prod-sync migrations
- Document workflow for team

### Phase 4: Polish
- Add migration validation
- Create conflict resolution documentation
- Add rollback procedures
- Create video walkthrough for team

## Security Considerations

1. **Credentials**: Never include credentials in migrations. Use environment-specific credential stores.
2. **Sensitive Data**: Review all prod-sync migrations for sensitive information before merging.
3. **Access Control**: Prod export requires service key - restrict access appropriately.
4. **Audit Trail**: All migrations go through Git for review and audit.

## Success Metrics

- ✅ Zero manual workflow exports/imports needed
- ✅ All team members can create and share workflows
- ✅ Production workflows can be debugged locally
- ✅ No execution history lost during sync
- ✅ Migrations run automatically on startup

## Dependencies

- Supabase CLI
- PostgreSQL (via Supabase)
- n8n Docker instance
- Git/GitHub
- Node.js 20+

## Timeline

- Phase 1: 1-2 days
- Phase 2: 1 day
- Phase 3: 1 day
- Phase 4: 1 day

Total: 4-5 days

## Questions & Risks

### Questions
1. Should we auto-apply prod-sync migrations or require manual review?
   - **Decision**: Manual review via PR for safety
2. How far back should we sync prod workflows?
   - **Decision**: Last 7 days by default, configurable
3. Should migrations update existing workflows or only insert new ones?
   - **Decision**: Update if prod is newer, preserve if local is newer

### Risks
1. **Conflicts**: Local and prod workflows might diverge
   - **Mitigation**: Timestamp-based conflict resolution
2. **Large Workflows**: Very large workflows might hit migration size limits
   - **Mitigation**: Store large workflows in separate JSON files, reference in migration
3. **Breaking Changes**: n8n schema changes might break migrations
   - **Mitigation**: Version migrations, add schema validation

## Appendix

### Example Workflow Names
- `agent_webhook_handler` - Receives webhook calls from agents
- `image_processing_pipeline` - Processes uploaded images
- `analytics_aggregator` - Aggregates usage analytics
- `customer_feedback_router` - Routes customer feedback to teams

### Environment Variables
```bash
# Production Supabase (for prod sync)
PROD_SUPABASE_URL=https://xxx.supabase.co
PROD_SUPABASE_SERVICE_KEY=eyJxxx

# Local Supabase (for dev)
LOCAL_SUPABASE_URL=http://127.0.0.1:7010
LOCAL_SUPABASE_KEY=eyJxxx
```

### Related Documentation
- [n8n Documentation](https://docs.n8n.io/)
- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Our n8n Setup Guide](../n8n-setup.md)
