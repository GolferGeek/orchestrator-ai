# Supabase Management Reference

Complete reference for all Supabase management operations in Orchestrator AI.

## Available Scripts

### Snapshot Operations
| Script | Purpose | Usage |
|--------|---------|-------|
| `export-snapshot.sh` | Export full database snapshot | `bash storage/scripts/export-snapshot.sh` |
| `apply-snapshot.sh` | Apply database snapshot | `bash storage/scripts/apply-snapshot.sh [snapshot-dir]` |

### Agent Operations
| Script | Purpose | Usage |
|--------|---------|-------|
| `export-agent.sh` | Export single agent | `bash storage/scripts/export-agent.sh <agent-name>` |
| `import-agent.sh` | Import single agent | `bash storage/scripts/import-agent.sh <json-file>` |
| `export-all-agents.sh` | Export all agents | `bash storage/scripts/export-all-agents.sh` |
| `import-all-agents.sh` | Import all agents | `bash storage/scripts/import-all-agents.sh` |
| `sync-agents-to-db.sh` | Sync agents (delete missing, upsert existing) | `bash storage/scripts/sync-agents-to-db.sh` |

### N8N Workflow Operations
| Script | Purpose | Usage |
|--------|---------|-------|
| `export-n8n-workflow.sh` | Export single workflow | `bash storage/scripts/export-n8n-workflow.sh "<workflow-name>"` |
| `import-n8n-workflow.sh` | Import single workflow | `bash storage/scripts/import-n8n-workflow.sh <json-file>` |
| `export-all-n8n-workflows.sh` | Export all workflows | `bash storage/scripts/export-all-n8n-workflows.sh` |
| `import-all-n8n-workflows.sh` | Import all workflows | `bash storage/scripts/import-all-n8n-workflows.sh` |
| `sync-n8n-to-db.sh` | Sync workflows (delete missing, upsert existing) | `bash storage/scripts/sync-n8n-to-db.sh` |

### Backup Operations
| Script | Purpose | Usage |
|--------|---------|-------|
| `backup-all-daily.sh` | Backup both databases | `./storage/scripts/backup-all-daily.sh` |
| `backup-supabase-daily.sh` | Backup Supabase only | `./storage/scripts/backup-supabase-daily.sh` |
| `backup-n8n-daily.sh` | Backup N8N only | `./storage/scripts/backup-n8n-daily.sh` |
| `restore-from-backup.sh` | Restore from backup | `./storage/scripts/restore-from-backup.sh <db-type> <backup-file>` |

### Migration Operations
| Script | Purpose | Usage |
|--------|---------|-------|
| `apply-proposed-migration.sh` | Apply approved migration | `bash storage/scripts/apply-proposed-migration.sh <migration-file>` |

## NPM Scripts (Convenience Wrappers)

| Command | Equivalent Script |
|---------|------------------|
| `npm run db:export-snapshot` | `bash storage/scripts/export-snapshot.sh` |
| `npm run db:apply-snapshot` | `bash storage/scripts/apply-snapshot.sh storage/snapshots/latest/` |
| `npm run db:export-agent <name>` | `bash storage/scripts/export-agent.sh <name>` |
| `npm run db:import-agent <file>` | `bash storage/scripts/import-agent.sh <file>` |
| `npm run db:export-all-agents` | `bash storage/scripts/export-all-agents.sh` |
| `npm run db:import-all-agents` | `bash storage/scripts/import-all-agents.sh` |
| `npm run db:sync-agents` | `bash storage/scripts/sync-agents-to-db.sh` |
| `npm run db:export-n8n "<name>"` | `bash storage/scripts/export-n8n-workflow.sh "<name>"` |
| `npm run db:import-n8n <file>` | `bash storage/scripts/import-n8n-workflow.sh <file>` |
| `npm run db:export-all-n8n` | `bash storage/scripts/export-all-n8n-workflows.sh` |
| `npm run db:import-all-n8n` | `bash storage/scripts/import-all-n8n-workflows.sh` |
| `npm run db:sync-n8n` | `bash storage/scripts/sync-n8n-to-db.sh` |

## Database Schemas

### Schema: `public`
**Purpose**: Main application schema

**Key Tables:**
- `agents` - Agent definitions and configurations
- `providers` - LLM provider configurations
- `models` - LLM model configurations
- `conversations` - Agent conversation records
- `tasks` - Task execution records
- `deliverables` - Build/deliverable records
- `plans` - Project plan records
- `orchestrations` - Orchestration definitions
- `orchestration_runs` - Orchestration execution records
- `orchestration_steps` - Individual step records

**Seed Data Included in Snapshots:**
- `public.agents` - Agent definitions
- `public.providers` - Provider configurations
- `public.models` - Model configurations

### Schema: `n8n`
**Purpose**: N8N workflow storage

**Key Tables:**
- `workflow_entity` - N8N workflow definitions

**Source of Truth**: `storage/snapshots/n8n/*.json`

### Schema: `company`
**Purpose**: Organization/tenant data

**Key Tables:**
- Organization configurations
- Tenant-specific settings

### Schema: `observability`
**Purpose**: Metrics and monitoring data

**Key Tables:**
- Performance metrics
- System health data
- Monitoring configurations

## File Formats

### Snapshot Directory Structure
```
storage/snapshots/<timestamp>/
├── schema.sql          # All 4 schemas (structure only)
├── seed.sql            # Seed data (agents, providers, models)
└── metadata.json       # Snapshot metadata
```

### Agent JSON Format
```json
{
  "id": "uuid",
  "organization_slug": "org-slug",
  "slug": "agent-slug",
  "display_name": "Agent Name",
  "description": "Agent description",
  "agent_type": "llm|api|function|orchestrator",
  "mode_profile": {...},
  "status": "active|inactive",
  "yaml": {...},
  "config": {...}
}
```

### N8N Workflow JSON Format
```json
{
  "id": "workflow-id",
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...},
  "settings": {...},
  "staticData": {...}
}
```

## Database Connection Details

### Supabase Database
- **Host**: `127.0.0.1`
- **Port**: `7012`
- **User**: `postgres`
- **Database**: `postgres`
- **Container**: `supabase_db_api-dev`
- **Password**: `postgres` (via `PGPASSWORD` env var)

### N8N Database
- **Host**: `127.0.0.1`
- **Port**: `7013`
- **User**: `postgres`
- **Database**: `postgres`
- **Container**: `n8n_db`
- **Password**: `postgres` (via `PGPASSWORD` env var)

## Backup File Naming

- **Supabase**: `golfergeek_supabase_backup_YYYYMMDD_HHMMSS.sql.gz`
- **N8N**: `golfergeek_n8n_backup_YYYYMMDD_HHMMSS.sql.gz`

## Migration File Naming

- **Format**: `YYYYMMDD-HHMM-description.sql`
- **Example**: `20251027-1430-add-user-preferences-table.sql`

## Safety Features

- **Confirmation prompts** for destructive operations
- **Automatic backups** before major changes (when configured)
- **Timestamped backups** for easy restoration
- **Automatic cleanup** of old backups (7+ days)

