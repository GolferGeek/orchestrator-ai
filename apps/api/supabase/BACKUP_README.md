# Supabase Local Database Backup System

This directory contains a comprehensive backup system for your local Supabase database to prevent data loss.

## 🚨 Why This Exists

Local Supabase data can be lost if:
- Docker volumes are accidentally deleted (`supabase stop --no-backup`)
- System crashes or restarts
- Accidental `supabase db reset` commands
- Docker cleanup operations

## 📁 Files

- `backup-local-db.sh` - Main backup script
- `setup-backup-cron.sh` - Sets up automated backups every 3 hours
- `backups/` - Directory where backup files are stored
- `BACKUP_README.md` - This documentation

## 🚀 Quick Start

### 1. Set Up Automated Backups (Recommended)

```bash
cd apps/api/supabase
./setup-backup-cron.sh
```

This will:
- Set up a cron job to run backups every 3 hours
- Keep the 10 most recent backups
- Log all backup activity

### 2. Manual Backup Commands

```bash
# Create a backup now
./backup-local-db.sh

# Create a backup without prompts (for scripts)
./backup-local-db.sh --force

# List all available backups
./backup-local-db.sh --list

# Restore from a specific backup
./backup-local-db.sh --restore backups/supabase_backup_20250911_123456.sql

# Show help
./backup-local-db.sh --help
```

## 📋 Backup Details

### Schedule
- **Frequency**: Every 3 hours
- **Retention**: 10 most recent backups
- **Automatic cleanup**: Yes

### Backup Files
- **Location**: `apps/api/supabase/backups/`
- **Format**: `supabase_backup_YYYYMMDD_HHMMSS.sql`
- **Content**: Complete database dump with schema and data
- **Size**: Typically 1-10MB depending on data volume

### Logs
- **Backup logs**: `backups/backup.log`
- **Cron logs**: `backups/cron.log`

## 🔧 Configuration

The backup system is configured in `backup-local-db.sh`:

```bash
MAX_BACKUPS=10              # Number of backups to keep
PROJECT_NAME="orchestrator-ai"  # Supabase project name
DB_CONTAINER="supabase_db_orchestrator-ai"  # Docker container name
```

## 📊 Monitoring

### Check Backup Status
```bash
# View recent backup activity
tail -f apps/api/supabase/backups/backup.log

# View cron job logs
tail -f apps/api/supabase/backups/cron.log

# List current cron jobs
crontab -l | grep backup
```

### Verify Backups
```bash
# List all backups with sizes and dates
./backup-local-db.sh --list

# Check if backups are being created
ls -la backups/supabase_backup_*.sql
```

## 🆘 Emergency Recovery

### If You Lose All Data

1. **Check for backups**:
   ```bash
   ./backup-local-db.sh --list
   ```

2. **Restore from most recent backup**:
   ```bash
   # Find the most recent backup
   ls -t backups/supabase_backup_*.sql | head -1
   
   # Restore it
   ./backup-local-db.sh --restore backups/supabase_backup_YYYYMMDD_HHMMSS.sql
   ```

3. **Verify restoration**:
   ```bash
   # Check if your data is back
   docker exec supabase_db_orchestrator-ai psql -U postgres -d postgres -c "SELECT COUNT(*) FROM public.conversations;"
   ```

### If Supabase Won't Start

1. **Check Docker**:
   ```bash
   docker ps | grep supabase
   ```

2. **Check volumes**:
   ```bash
   docker volume ls | grep orchestrator-ai
   ```

3. **Restart Supabase**:
   ```bash
   cd apps/api
   supabase stop
   supabase start
   ```

4. **Restore from backup if needed**:
   ```bash
   ./backup-local-db.sh --restore backups/supabase_backup_YYYYMMDD_HHMMSS.sql
   ```

## ⚠️ Important Notes

### Safe Commands (Preserve Data)
```bash
supabase stop           # Stops containers, keeps volumes ✅
supabase start          # Starts containers, preserves data ✅
```

### Dangerous Commands (Can Delete Data)
```bash
supabase stop --no-backup    # DESTROYS ALL DATA VOLUMES ❌
supabase db reset             # DESTROYS DATABASE CONTENT ❌
```

### Prerequisites
- Docker must be running
- Supabase must be started (`supabase start`)
- Sufficient disk space for backups

### Troubleshooting

**"Container not running" error**:
```bash
cd apps/api
supabase start
```

**"Permission denied" error**:
```bash
chmod +x backup-local-db.sh
chmod +x setup-backup-cron.sh
```

**Cron job not running**:
```bash
# Check if cron service is running (macOS)
sudo launchctl list | grep cron

# Check cron logs (Linux)
grep CRON /var/log/syslog
```

## 🔄 Maintenance

### Update Backup Retention
Edit `MAX_BACKUPS=10` in `backup-local-db.sh` to change how many backups to keep.

### Change Backup Frequency
Edit the cron job:
```bash
crontab -e
```

Current schedule: `0 */3 * * *` (every 3 hours)
- Every hour: `0 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at 2 AM: `0 2 * * *`

### Remove Automated Backups
```bash
crontab -l | grep -v backup-local-db.sh | crontab -
```

## 📈 Best Practices

1. **Test restores regularly** - Verify backups actually work
2. **Monitor disk space** - Backups accumulate over time
3. **Keep backups in multiple locations** - Consider copying to cloud storage
4. **Document your restore process** - Practice emergency procedures
5. **Monitor backup logs** - Check for failures or issues

## 🎯 Next Steps

After setting up the backup system:

1. Run a test backup: `./backup-local-db.sh`
2. Verify the backup file exists and has content
3. Test a restore on a copy of your database
4. Set up the automated cron job: `./setup-backup-cron.sh`
5. Monitor the system for a few days to ensure it's working

Your data is now protected! 🛡️
