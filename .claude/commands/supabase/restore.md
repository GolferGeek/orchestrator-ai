---
description: "Restore database from a backup file (DESTRUCTIVE - use with caution)"
argument-hint: "[db-type] [backup-file-path]"
---

# Restore Database from Backup

Restore a database from a backup file. **WARNING: This is DESTRUCTIVE and will replace the current database.**

**Usage:** `/supabase:restore [db-type] [backup-file]`

**Examples:**
- `/supabase:restore supabase storage/backups/golfergeek_supabase_backup_20250112_143022.sql.gz`
- `/supabase:restore n8n storage/backups/golfergeek_n8n_backup_20250112_143022.sql.gz`
- `/supabase:restore` (will list available backups to choose from)

## Process

### 1. Determine Backup File

**If backup file path provided:**
- Use provided path
- Verify file exists

**If no path provided:**
- List all backup files in `storage/backups/`
- Allow user to select which backup to restore
- Show backup file details (timestamp, size, type)

### 2. Determine Database Type

**If db-type provided:**
- Use provided type (supabase or n8n)

**If no type provided:**
- Infer from backup filename
- Or prompt user to select

**Database types:**
- `supabase` - Main Supabase database (host: 127.0.0.1:54322)
- `n8n` - N8N workflow database (host: 127.0.0.1:7012)

### 3. Verify Backup File

- Check backup file exists
- Verify file is readable
- Check file size and compression
- Display backup file details:

```
📋 Backup File Details

📄 File: storage/backups/golfergeek_supabase_backup_20250112_143022.sql.gz
📊 Size: [X] MB (compressed)
🕐 Created: 2025-01-12 14:30:22
🗄️  Database: Supabase
```

### 4. Show Critical Warning

Display DESTRUCTIVE warning:

```
⚠️  CRITICAL WARNING: Database Restore

   This operation will:
   ❌ DESTROY the current database
   ❌ DELETE all existing data
   ❌ REPLACE with backup data
   
   Target Database: [db-type]
   Backup File: [backup-file]
   
   This action CANNOT be undone without another backup!
```

**Require explicit confirmation:** User must type "yes" to proceed.

### 5. Execute Restore Script

Run the restore script:

```bash
bash storage/scripts/restore-from-backup.sh [db-type] [backup-file]
```

**What this script does:**
- Stops database container (if applicable)
- Decompresses backup file
- Drops existing database (if needed)
- Restores database from backup
- Restarts database container
- Verifies restore success

### 6. Output Summary

Display success message:

```
✅ Database Restored Successfully

📦 Restored From:
   storage/backups/golfergeek_supabase_backup_20250112_143022.sql.gz

🗄️  Database: Supabase
📊 Size: [X] MB (restored)
🕐 Restored: [timestamp]

📋 Verification:
   ✅ Database connection successful
   ✅ Tables restored: [X] tables
   ✅ Data restored: [X] rows

📊 Next Steps:
   1. Verify database is working correctly
   2. Test application functionality
   3. Check agents/workflows are loaded
   4. If issues occur, restore from different backup
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/restore-from-backup.sh` - never use direct Supabase CLI or API
- **DESTRUCTIVE**: This will DELETE all current database data
- **IRREVERSIBLE**: Cannot undo without another backup
- Always verify backup file before restoring
- Stop application services before restoring if possible
- Restore may take several minutes for large databases

## Backup File Format

- **Location**: `storage/backups/`
- **Format**: `golfergeek_<db-type>_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Compression**: gzip (automatically decompressed during restore)
- **Content**: Full pg_dump output (all schemas, tables, data)

## Error Handling

- If backup file not found: Show error and list available backups
- If database type invalid: Show error (must be 'supabase' or 'n8n')
- If restore fails: Show error output and abort
- If database connection fails: Show connection error
- If disk space insufficient: Warn user before starting
- If user cancels: Abort gracefully with message

## When to Restore

- After accidental data loss
- After failed migration
- To revert to previous state
- After database corruption
- To restore from production backup (for local development)

## Rollback Options

If restore causes issues:

```
🔄 Rollback Options:

   1. Restore from different backup:
      /supabase:restore [db-type] [different-backup-file]

   2. Apply snapshot instead:
      /supabase:snapshot:apply [snapshot-path]

   3. Re-apply migrations:
      /supabase:migration:apply [migration-file]
```

## Related Commands

- `/supabase:backup` - Create backup before restoring
- `/supabase:snapshot:apply` - Apply snapshot (schema + seed data only)
- `/supabase:migration:apply` - Apply migration (if restore incomplete)

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

