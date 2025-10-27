# Database Backup System

This directory contains scripts for creating and managing daily backups of your Supabase and n8n databases, providing a safe alternative to devastating database resets.

## Quick Start

### 1. Create a backup right now
```bash
# Backup both databases
./storage/scripts/backup-all-daily.sh

# Or backup individually
./storage/scripts/backup-supabase-daily.sh
./storage/scripts/backup-n8n-daily.sh
```

### 2. Set up automated daily backups
```bash
./storage/scripts/setup-daily-backups.sh
```

### 3. Restore from a backup
```bash
# List available backups
ls -la storage/backups/

# Restore Supabase database
./storage/scripts/restore-from-backup.sh supabase storage/backups/golfergeek_supabase_backup_20250113_143022.sql.gz

# Restore n8n database
./storage/scripts/restore-from-backup.sh n8n storage/backups/golfergeek_n8n_backup_20250113_143022.sql.gz
```

## Scripts Overview

### Backup Scripts
- **`backup-all-daily.sh`** - Runs both Supabase and n8n backups
- **`backup-supabase-daily.sh`** - Creates timestamped backup of Supabase database
- **`backup-n8n-daily.sh`** - Creates timestamped backup of n8n database

### Management Scripts
- **`setup-daily-backups.sh`** - Sets up automated daily backups via cron
- **`restore-from-backup.sh`** - Restores database from a backup file

## Backup Features

- **Timestamped backups** - Each backup includes date/time in filename
- **Compression** - Backups are automatically gzipped to save space
- **Automatic cleanup** - Keeps only the last 7 days of backups
- **Safe restoration** - Confirms before destroying current database
- **Container management** - Stops/starts containers during restore

## Backup Schedule

When automated backups are set up, they run daily at 2:00 AM and include:
- Full database dumps with schema and data
- Compressed storage to save disk space
- Automatic cleanup of old backups (7+ days)
- Logging to `storage/backups/backup.log`

## Environment Variables

You can customize the backup behavior with these environment variables:

```bash
# Backup directory (default: ./storage/backups)
export BACKUP_DIR="/path/to/your/backups"

# Supabase database connection
export SUPABASE_DB_HOST="127.0.0.1"
export SUPABASE_DB_PORT="54322"
export SUPABASE_DB_NAME="postgres"
export SUPABASE_DB_USER="postgres"
export SUPABASE_DB_PASSWORD="postgres"

# n8n database connection
export N8N_DB_HOST="127.0.0.1"
export N8N_DB_PORT="7012"
export N8N_DB_NAME="postgres"
export N8N_DB_USER="postgres"
export N8N_DB_PASSWORD="postgres"
```

## Troubleshooting

### Backup fails with connection error
- Ensure Docker containers are running: `docker ps`
- Check database ports are accessible
- Verify environment variables are correct

### Restore fails
- Ensure backup file exists and is readable
- Check that target database container is running
- Verify you have sufficient disk space

### Cron job not running
- Check cron service is running: `sudo systemctl status cron`
- View cron logs: `grep CRON /var/log/syslog`
- Test cron job manually: `./storage/scripts/backup-all-daily.sh`

## Best Practices

1. **Test your backups** - Periodically restore from a backup to ensure they work
2. **Monitor disk space** - Backups can grow large over time
3. **Keep multiple backups** - Don't rely on just the most recent backup
4. **Document your restore process** - Know how to restore before you need to
5. **Backup before major changes** - Always backup before running migrations or resets

## Emergency Restore

If you need to quickly restore from the most recent backup:

```bash
# Find the most recent Supabase backup
LATEST_SUPABASE=$(ls -t storage/backups/golfergeek_supabase_backup_*.sql.gz | head -1)
./storage/scripts/restore-from-backup.sh supabase "$LATEST_SUPABASE"

# Find the most recent n8n backup
LATEST_N8N=$(ls -t storage/backups/golfergeek_n8n_backup_*.sql.gz | head -1)
./storage/scripts/restore-from-backup.sh n8n "$LATEST_N8N"
```
