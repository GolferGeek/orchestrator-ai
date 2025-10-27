# Storage Scripts

This directory contains all database management, backup, and snapshot scripts for the Orchestrator AI project.

## 📸 Database Snapshots (For Intern Distribution)

### Full Database Snapshots
Export and apply complete database snapshots including all schemas and seed data.

```bash
# Create a snapshot (exports to storage/snapshots/<timestamp>/)
npm run db:export-snapshot

# Apply a snapshot (default: storage/snapshots/latest/)
npm run db:apply-snapshot

# Apply a specific snapshot
bash storage/scripts/apply-snapshot.sh storage/snapshots/2025-10-27-150318/
```

**What's included in snapshots:**
- All 4 schemas: `public`, `n8n`, `company`, `observability`
- Seed data: `agents`, `providers`, `models`
- Timestamped versions + `latest/` symlink

## 🤖 Agent Management

Manage individual agents or bulk operations on all agents.

```bash
# Export single agent to JSON
npm run db:export-agent <agent-name>
# Example: npm run db:export-agent demo_supabase_agent

# Import/upsert single agent from JSON
npm run db:import-agent <path-to-json>
# Example: npm run db:import-agent storage/snapshots/agents/demo_supabase_agent.json

# Export ALL agents to individual JSON files
npm run db:export-all-agents

# Import ALL agents from storage/snapshots/agents/
npm run db:import-all-agents

# Sync agents (delete missing, upsert existing)
npm run db:sync-agents
```

**Agent files location:** `storage/snapshots/agents/*.json`

## 🔄 N8N Workflow Management

Manage individual N8N workflows or bulk operations.

```bash
# Export single workflow to JSON
npm run db:export-n8n "<workflow-name>"
# Example: npm run db:export-n8n "Helper: LLM Task"

# Import/upsert single workflow from JSON
npm run db:import-n8n <path-to-json>
# Example: npm run db:import-n8n storage/snapshots/n8n/helper-llm-task.json

# Export ALL workflows to individual JSON files
npm run db:export-all-n8n

# Import ALL workflows from storage/snapshots/n8n/
npm run db:import-all-n8n

# Sync workflows (delete missing, upsert existing)
npm run db:sync-n8n
```

**Workflow files location:** `storage/snapshots/n8n/*.json`

## 💾 Daily Backups

Full database backups with compression and automatic cleanup.

```bash
# Backup both databases
./storage/scripts/backup-all-daily.sh

# Or backup individually
./storage/scripts/backup-supabase-daily.sh
./storage/scripts/backup-n8n-daily.sh

# Restore from backup
./storage/scripts/restore-from-backup.sh supabase <backup-file.sql.gz>
./storage/scripts/restore-from-backup.sh n8n <backup-file.sql.gz>
```

**Backup files location:** `storage/backups/*.sql.gz`

See [README-backups.md](./README-backups.md) for detailed backup documentation.

## 📁 Directory Structure

```
storage/
├── backups/                          # Daily compressed backups
│   ├── golfergeek_supabase_backup_*.sql.gz
│   └── golfergeek_n8n_backup_*.sql.gz
├── snapshots/
│   ├── agents/                       # Individual agent JSON files (source of truth)
│   │   ├── demo_supabase_agent.json
│   │   └── ...
│   ├── n8n/                          # Individual N8N workflow JSON files (source of truth)
│   │   ├── helper-llm-task.json
│   │   ├── marketing-swarm-flexible-llm.json
│   │   └── marketing-swarm-major-announcement.json
│   ├── latest/                       # Latest full snapshot (symlink/copy)
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   └── metadata.json
│   └── <timestamp>/                  # Timestamped snapshots
│       ├── schema.sql
│       ├── seed.sql
│       └── metadata.json
└── scripts/                          # All management scripts
    ├── README.md                     # This file
    ├── README-backups.md             # Detailed backup documentation
    ├── export-snapshot.sh
    ├── apply-snapshot.sh
    ├── export-agent.sh
    ├── import-agent.sh
    ├── export-all-agents.sh
    ├── import-all-agents.sh
    ├── sync-agents-to-db.sh
    ├── export-n8n-workflow.sh
    ├── import-n8n-workflow.sh
    ├── export-all-n8n-workflows.sh
    ├── import-all-n8n-workflows.sh
    ├── sync-n8n-to-db.sh
    ├── backup-all-daily.sh
    ├── backup-supabase-daily.sh
    ├── backup-n8n-daily.sh
    ├── restore-from-backup.sh
    ├── setup-daily-backups.sh
    └── convert-backup-to-migration.sh
```

## 🎯 Common Workflows

### For Lead Developer
```bash
# After making database changes:
1. npm run db:export-snapshot          # Create full snapshot
2. npm run db:export-all-agents        # Export all agents
3. npm run db:export-all-n8n           # Export all N8N workflows
4. Share storage/snapshots/ directory with interns
```

### For Interns
```bash
# To get latest database state:
1. Receive storage/snapshots/ directory from lead
2. npm run db:apply-snapshot           # Apply full snapshot
3. Verify with: npm run dev

# To update specific agent:
1. Receive single agent JSON file
2. npm run db:import-agent <file>

# To update specific N8N workflow:
1. Receive single workflow JSON file
2. npm run db:import-n8n <file>
```

### For Daily Operations
```bash
# Manual backup before major changes
./storage/scripts/backup-all-daily.sh

# Emergency restore from latest backup
LATEST=$(ls -t storage/backups/golfergeek_supabase_backup_*.sql.gz | head -1)
./storage/scripts/restore-from-backup.sh supabase "$LATEST"
```

## 🔒 Safety Features

- **Confirmation prompts** for destructive operations
- **Automatic backups** before major changes (when set up)
- **Versioned snapshots** with timestamps
- **Upsert operations** prevent duplicate entries
- **Docker-based** pg_dump for version compatibility

## 🚀 Quick Reference

| Task | Command |
|------|---------|
| Create full snapshot | `npm run db:export-snapshot` |
| Apply snapshot | `npm run db:apply-snapshot` |
| Export all agents | `npm run db:export-all-agents` |
| Import all agents | `npm run db:import-all-agents` |
| Sync agents to DB | `npm run db:sync-agents` |
| Export all N8N workflows | `npm run db:export-all-n8n` |
| Import all N8N workflows | `npm run db:import-all-n8n` |
| Sync N8N to DB | `npm run db:sync-n8n` |
| Daily backup | `./storage/scripts/backup-all-daily.sh` |
| Restore backup | `./storage/scripts/restore-from-backup.sh` |

## 📝 Notes

- All scripts use Docker to ensure PostgreSQL version compatibility
- JSON files in `snapshots/agents/` and `snapshots/n8n/` serve as the source of truth
- Full snapshots include schema structure + seed data only (not all data)
- Daily backups include ALL data and are compressed
- Snapshots are for distribution; backups are for disaster recovery
