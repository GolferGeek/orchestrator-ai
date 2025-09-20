# Unified Supabase Database Backup System

This directory contains a comprehensive backup system for both your development and production Supabase databases.

## 🚨 Why This Exists

Your local Supabase data can be lost if:
- Docker volumes are accidentally deleted (`supabase stop --no-backup`)
- System crashes or restarts
- Accidental `supabase db reset` commands
- Docker cleanup operations

## 🏗️ Architecture

### **Two Environment Support**
- **Development**: Port 7012, container `supabase_db_api-dev`
- **Production**: Port 9012, container `supabase_db_api-production`

### **Separate Backup Directories**
- **Development**: `backups/dev/` (keeps 10 most recent backups)
- **Production**: `backups/prod/` (keeps 20 most recent backups)

## 📁 Files

- `backup-unified.sh` - Main backup script (supports both environments)
- `setup-backup-cron-unified.sh` - Sets up automated backups for both environments
- `backups/dev/` - Development backup files and logs
- `backups/prod/` - Production backup files and logs
- `BACKUP_UNIFIED_README.md` - This documentation

## 🚀 Quick Start

### 1. Set Up Automated Backups (Recommended)

```bash
cd apps/api/supabase
./setup-backup-cron-unified.sh
```

This will:
- Set up cron jobs for both environments
- Development: Every 3 hours (keeps 10 backups)
- Production: Every 6 hours (keeps 20 backups)
- Log all backup activity

### 2. Manual Backup Commands

```bash
# Auto-detect environment and backup
./backup-unified.sh

# Create development backup
./backup-unified.sh --env=dev

# Create production backup
./backup-unified.sh --env=prod

# Create backup without prompts (for scripts)
./backup-unified.sh --env=dev --force
./backup-unified.sh --env=prod --force

# List available backups
./backup-unified.sh --env=dev --list
./backup-unified.sh --env=prod --list

# Restore from a specific backup
./backup-unified.sh --env=dev --restore backups/dev/supabase_backup_dev_20250919_114744.sql
./backup-unified.sh --env=prod --restore backups/prod/supabase_backup_prod_20250919_114739.sql

# Show help
./backup-unified.sh --help
```

## 📋 Backup Details

### Schedule
- **Development**: Every 3 hours (more frequent for active development)
- **Production**: Every 6 hours (less frequent since it's more stable)
- **Retention**: 10 dev backups, 20 prod backups
- **Automatic cleanup**: Yes

### Backup Files
- **Development**: `backups/dev/supabase_backup_dev_YYYYMMDD_HHMMSS.sql`
- **Production**: `backups/prod/supabase_backup_prod_YYYYMMDD_HHMMSS.sql`
- **Content**: Complete database dump with schema and data
- **Size**: Typically 500KB-2MB depending on data volume

### Logs
- **Development logs**: `backups/dev/backup.log` and `backups/dev/cron.log`
- **Production logs**: `backups/prod/backup.log` and `backups/prod/cron.log`

## 🔧 Configuration

The backup system automatically detects environments by checking:
1. Running Docker containers
2. Active ports (7012=dev, 9012=prod)
3. Or specify explicitly with `--env=dev|prod`

### Environment Detection
```bash
# Auto-detect (checks containers and ports)
./backup-unified.sh

# Explicit environment specification
./backup-unified.sh --env=dev
./backup-unified.sh --env=prod
```

## 📊 Monitoring

### Check Backup Status
```bash
# List development backups
./backup-unified.sh --env=dev --list

# List production backups
./backup-unified.sh --env=prod --list

# Check cron logs
tail -f backups/dev/cron.log
tail -f backups/prod/cron.log
```

### Verify Cron Jobs
```bash
# View all cron jobs
crontab -l

# Check if backup cron jobs are running
crontab -l | grep backup-unified.sh
```

## 🔄 Environment-Specific Operations

### Development Environment
```bash
# Backup development database
./backup-unified.sh --env=dev

# List development backups
./backup-unified.sh --env=dev --list

# Restore development database
./backup-unified.sh --env=dev --restore backups/dev/supabase_backup_dev_YYYYMMDD_HHMMSS.sql
```

### Production Environment
```bash
# Backup production database
./backup-unified.sh --env=prod

# List production backups
./backup-unified.sh --env=prod --list

# Restore production database
./backup-unified.sh --env=prod --restore backups/prod/supabase_backup_prod_YYYYMMDD_HHMMSS.sql
```

## 🛠️ Troubleshooting

### Common Issues

**"Container not running" error**:
```bash
# Check which containers are running
docker ps | grep supabase_db

# Start the appropriate environment
# For development:
supabase start --config ./supabase/config.dev.toml

# For production:
supabase start --config ./supabase/config.production.toml
```

**"Permission denied" error**:
```bash
chmod +x backup-unified.sh
chmod +x setup-backup-cron-unified.sh
```

**Cron job not running**:
```bash
# Check if cron service is running (macOS)
sudo launchctl list | grep cron

# Check cron logs
tail -f backups/dev/cron.log
tail -f backups/prod/cron.log
```

**Environment detection issues**:
```bash
# Force specific environment
./backup-unified.sh --env=dev
./backup-unified.sh --env=prod
```

## 🔄 Maintenance

### Update Backup Retention
```bash
# Change retention for specific environment
./backup-unified.sh --env=dev --max-backups 5
./backup-unified.sh --env=prod --max-backups 30
```

### Change Backup Frequency
Edit the cron jobs:
```bash
crontab -e
```

Current schedule:
- Development: `0 */3 * * *` (every 3 hours)
- Production: `0 */6 * * *` (every 6 hours)

### Remove Automated Backups
```bash
crontab -l | grep -v 'backup-unified.sh' | crontab -
```

## 📈 Best Practices

1. **Test restores regularly** - Verify backups actually work
2. **Monitor disk space** - Backups accumulate over time
3. **Keep backups in multiple locations** - Consider copying to cloud storage
4. **Document your restore process** - Practice emergency procedures
5. **Monitor backup logs** - Check for failures or issues
6. **Environment separation** - Keep dev and prod backups separate

## 🎯 Next Steps

After setting up the backup system:

1. Run test backups for both environments:
   ```bash
   ./backup-unified.sh --env=dev --force
   ./backup-unified.sh --env=prod --force
   ```

2. Verify backup files exist and have content:
   ```bash
   ./backup-unified.sh --env=dev --list
   ./backup-unified.sh --env=prod --list
   ```

3. Set up the automated cron jobs:
   ```bash
   ./setup-backup-cron-unified.sh
   ```

4. Monitor the system for a few days to ensure it's working:
   ```bash
   tail -f backups/dev/cron.log
   tail -f backups/prod/cron.log
   ```

## 🔗 Related Files

- `backup-local-db.sh` - Legacy single-environment backup script
- `setup-backup-cron.sh` - Legacy cron setup script
- `BACKUP_README.md` - Legacy documentation

Your data is now protected across both environments! 🛡️

