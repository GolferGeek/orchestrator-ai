# Database Restore & Migration Options

You have multiple ways to restore your database and share it with your nephew. Here's a complete guide to all your options.

## 🎯 Quick Decision Guide

**Need to restore your own database quickly?**
→ Use Option 1: Quick Restore from Backup

**Need to share with your nephew?**
→ Use Option 2: Convert Backup to Migration (RECOMMENDED)

**Starting fresh with current database?**
→ Use Option 3: Generate New Migration

---

## Option 1: Quick Restore from Existing Backup ⚡

**When to use:** You need to restore your database right now.

### Your Available Backups

```bash
# List all backups
ls -la storage/backups/

# Most recent backups:
storage/backups/golfergeek_supabase_backup_20251012_071450.sql.gz  # Oct 12
storage/backups/golfergeek_n8n_backup_20251012_071450.sql.gz       # Oct 12
storage/backups/golfergeek_full_database_backup_20251009_180534.sql.gz  # Full backup
```

### How to Restore

```bash
# Restore Supabase (public, company schemas, auth.users)
./scripts/restore-from-backup.sh supabase storage/backups/golfergeek_supabase_backup_20251012_071450.sql.gz

# Or restore the full database backup
./scripts/restore-from-backup.sh supabase storage/backups/golfergeek_full_database_backup_20251009_180534.sql.gz
```

⚠️ **Warning:** This will completely replace your current database!

---

## Option 2: Convert Backup to Migration 🎁 (RECOMMENDED FOR SHARING)

**When to use:** You want to share your backup with your nephew in a clean migration format.

This converts your `.sql.gz` backup into two clean files:
- `*_complete_schema.sql` - Database structure
- `*_complete_data.sql` - Data inserts

### Steps

```bash
# Convert your most recent backup to migration format
./scripts/convert-backup-to-migration.sh storage/backups/golfergeek_supabase_backup_20251012_071450.sql.gz

# This creates:
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_complete_schema.sql
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_complete_data.sql
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_MIGRATION_README.md
```

### What Your Nephew Does

```bash
# 1. Start Supabase
cd apps/api
npx supabase start

# 2. Apply the migration (use the timestamp from the filenames)
cd ../..
./scripts/apply-complete-migration.sh 20251013160000
```

### Why This Is Best for Sharing

✅ Clean, organized files  
✅ Separated structure and data  
✅ Includes instructions  
✅ Easy to version control  
✅ Works on any PostgreSQL instance  
✅ No Docker dependencies  

---

## Option 3: Generate Fresh Migration from Current Database 🆕

**When to use:** You want to create a migration from your current live database state (not a backup).

### Steps

```bash
# Generate migration from current database
./scripts/generate-complete-migration.sh

# This creates the same format as Option 2:
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_complete_schema.sql
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_complete_data.sql
# apps/api/supabase/migrations/YYYYMMDDHHMMSS_MIGRATION_README.md
```

### When to Use This Instead of Option 2

- Your database has changed since the backup
- You want the absolute latest data
- You've made schema changes

---

## Comparison Table

| Feature | Option 1: Restore | Option 2: Convert Backup | Option 3: Fresh Migration |
|---------|------------------|--------------------------|---------------------------|
| **Speed** | ⚡ Fastest | 🐢 Medium | 🐢 Medium |
| **For Yourself** | ✅ Yes | ❌ No | ❌ No |
| **For Nephew** | ⚠️ Complex | ✅ Best | ✅ Good |
| **Data Source** | Old backup | Old backup | Current DB |
| **Format** | Single .gz file | Clean migrations | Clean migrations |
| **Documentation** | Minimal | Full | Full |

---

## Recommended Workflow

### For You (Restore)

```bash
# Quick restore when you need it
./scripts/restore-from-backup.sh supabase storage/backups/golfergeek_supabase_backup_20251012_071450.sql.gz
```

### For Your Nephew (Share)

```bash
# Option A: Convert your backup to migration
./scripts/convert-backup-to-migration.sh storage/backups/golfergeek_supabase_backup_20251012_071450.sql.gz

# Option B: Generate from current database
./scripts/generate-complete-migration.sh

# Then commit the generated files and push to git
git add apps/api/supabase/migrations/*_complete_*
git commit -m "Add complete database migration for clean setup"
git push
```

Your nephew then:
```bash
git pull
cd apps/api
npx supabase start
cd ../..
./scripts/apply-complete-migration.sh <timestamp>
```

---

## File Locations

### Backups (Your Originals)
```
storage/backups/
├── golfergeek_supabase_backup_20251012_071450.sql.gz  ← Most recent
├── golfergeek_n8n_backup_20251012_071450.sql.gz
└── golfergeek_full_database_backup_20251009_180534.sql.gz
```

### Migrations (For Sharing)
```
apps/api/supabase/migrations/
├── 20251013160000_complete_schema.sql      ← Generated migrations
├── 20251013160000_complete_data.sql
├── 20251013160000_MIGRATION_README.md
└── ...
```

---

## Troubleshooting

### "Which backup should I use?"

**For most recent data:**
- `golfergeek_supabase_backup_20251012_071450.sql.gz`

**For everything including n8n:**
- `golfergeek_full_database_backup_20251009_180534.sql.gz`

### "Can I test the migration before sharing?"

Yes! Test on a clean database:

```bash
# Drop everything
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << 'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
SQL

# Apply migration
./scripts/apply-complete-migration.sh <timestamp>

# Verify
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -c "SELECT schemaname, COUNT(*) FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company') GROUP BY schemaname;"
```

### "Do I need to backup before converting?"

No! The conversion script:
- Uses a temporary database
- Doesn't modify your existing database
- Doesn't modify the original backup file

---

## Best Practices

1. **Keep backups** - Never delete your `.sql.gz` backup files
2. **Test migrations** - Always test on a clean database before sharing
3. **Document changes** - Note what's in each migration
4. **Version control** - Commit migration files to git
5. **Regular backups** - Keep backing up your database daily

---

## Quick Reference

```bash
# Restore from backup (for you)
./scripts/restore-from-backup.sh supabase storage/backups/<backup-file>.sql.gz

# Convert backup to migration (for nephew)
./scripts/convert-backup-to-migration.sh storage/backups/<backup-file>.sql.gz

# Generate fresh migration (for nephew)
./scripts/generate-complete-migration.sh

# Apply migration (nephew or testing)
./scripts/apply-complete-migration.sh <timestamp>

# List available backups
ls -la storage/backups/

# List available migrations
ls -la apps/api/supabase/migrations/*_complete_schema.sql
```

---

## Need More Help?

- **Backup system:** See `scripts/README-backups.md`
- **Migration guide:** See `scripts/COMPLETE_MIGRATION_GUIDE.md`
- **Quick reference:** See `scripts/MIGRATION_QUICK_REFERENCE.md`

---

**Last Updated:** 2025-10-13



