---
description: "Create a backup of Supabase database (or both Supabase and n8n)"
argument-hint: "[supabase|all]"
---

# Backup Database

Create a full backup of the Supabase database (or both Supabase and n8n databases). Backups are stored in `storage/backups/` with timestamped filenames.

**Usage:** `/supabase:backup [supabase|all]`

**Examples:**
- `/supabase:backup` (backup Supabase only - default)
- `/supabase:backup supabase` (backup Supabase only)
- `/supabase:backup all` (backup both Supabase and n8n)

## Process

### 1. Determine Backup Scope

**If "all" provided:**
- Backup both Supabase and n8n databases
- Use: `bash storage/scripts/backup-all-daily.sh`

**If "supabase" or no argument:**
- Backup Supabase database only
- Use: `bash storage/scripts/backup-supabase-daily.sh`

### 2. Verify Prerequisites

- Ensure Supabase database is running and accessible
- Check database connection
- Verify backup directory exists: `storage/backups/`
- Check available disk space

### 3. Execute Backup Script

**For Supabase only:**
```bash
bash storage/scripts/backup-supabase-daily.sh
```

**For all databases:**
```bash
bash storage/scripts/backup-all-daily.sh
```

**What these scripts do:**
- Create timestamped backup file: `storage/backups/golfergeek_supabase_backup_YYYYMMDD_HHMMSS.sql.gz`
- Use `pg_dump` to export full database
- Compress backup with gzip
- Store in `storage/backups/` directory

### 4. Output Summary

**For Supabase backup:**
```
✅ Database Backup Created Successfully

📦 Backup File:
   storage/backups/golfergeek_supabase_backup_20250112_143022.sql.gz

📊 Backup Details:
   Database: Supabase (postgres)
   Host: 127.0.0.1:54322
   Size: [X] MB (compressed)
   Duration: [X] seconds

🕐 Created: [timestamp]

📤 Next Steps:
   - Backup stored in storage/backups/
   - Use /supabase:restore to restore if needed
   - Backup is compressed and ready for archival
```

**For all databases:**
```
✅ All Databases Backed Up Successfully

📦 Backup Files:
   ✅ storage/backups/golfergeek_supabase_backup_20250112_143022.sql.gz
   ✅ storage/backups/golfergeek_n8n_backup_20250112_143022.sql.gz

📊 Backup Details:
   Supabase: [X] MB (compressed)
   n8n: [X] MB (compressed)
   Total Size: [X] MB
   Duration: [X] seconds

🕐 Created: [timestamp]

📤 Next Steps:
   - Backups stored in storage/backups/
   - Use /supabase:restore to restore if needed
   - Backups are compressed and ready for archival
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/backup-*.sh` scripts - never use direct Supabase CLI or API
- Backups include full database dumps (all data, not just schemas)
- Backups are compressed with gzip to save space
- Backups are timestamped for easy identification
- Always backup before major database changes or migrations
- Backups can be used for disaster recovery

## Backup Storage

- **Location**: `storage/backups/`
- **Filename format**: `golfergeek_<db-type>_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Retention**: Manual (no automatic cleanup)
- **Compression**: gzip (reduces size significantly)

## Error Handling

- If database not accessible: Show connection error
- If backup script fails: Show script output and error
- If disk space insufficient: Warn user before starting
- If backup directory missing: Create directory automatically

## When to Backup

- Before applying migrations
- Before applying snapshots (if you have local changes)
- Before major database changes
- On a regular schedule (daily/weekly)
- Before experimental changes

## Related Commands

- `/supabase:restore` - Restore from backup
- `/supabase:snapshot:export` - Export snapshot (schema + seed data only)
- `/supabase:migration:apply` - Apply migration (backup recommended first)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

