# Migration Strategy - Orchestrator AI

## 📋 Overview

This project uses a dual-branch migration strategy to balance development flexibility with onboarding simplicity.

## 🌿 Branch Structure

### `main` branch
- **Purpose**: Full development history and incremental migrations
- **Migrations**: 27+ individual migration files
- **Use case**: Active development, debugging, migration history
- **Setup time**: ~2-3 minutes (applies all migrations sequentially)

### `clean-migrations` branch  
- **Purpose**: Clean onboarding for new developers and interns
- **Migrations**: 1 consolidated migration file
- **Use case**: New developer setup, clean environments
- **Setup time**: ~10-15 seconds (single migration)

## 🔄 Workflow

### For New Developers/Interns
```bash
git checkout clean-migrations
cd apps/api
supabase start  # Fast setup
```

### For Development Team
```bash
git checkout main
cd apps/api  
supabase start  # Full migration history
```

### Creating New Migrations
1. **Develop on `main`** branch with incremental migrations
2. **Test thoroughly** with full migration history
3. **Periodically consolidate** by updating `clean-migrations` branch

## 📁 File Structure

```
apps/api/supabase/
├── migrations/                    # Current branch migrations
│   └── 20250101000001_consolidated_schema_complete.sql  # (clean-migrations)
│   └── 202508*.sql, 202509*.sql   # (main branch)
└── migrations_backup/             # Backup of all incremental migrations
    └── [all original migrations]
```

## 🔄 Updating Clean Branch

When you have significant new migrations on `main`:

```bash
# 1. Switch to main and ensure all migrations work
git checkout main
cd apps/api
supabase db reset  # Test full migration set

# 2. Generate new consolidated migration
supabase db dump --local -f supabase/migrations/new_consolidated.sql

# 3. Switch to clean-migrations branch
git checkout clean-migrations

# 4. Replace old consolidated migration
cd apps/api/supabase/migrations
rm 20250101000001_consolidated_schema_complete.sql
mv new_consolidated.sql 20250101000001_consolidated_schema_complete.sql

# 5. Test the new consolidated migration
supabase db reset

# 6. Commit the update
git add . && git commit -m "Update consolidated migration with latest changes"
```

## ⚡ Benefits

### Clean Branch Benefits
- **Fast onboarding**: New developers up and running in seconds
- **Reduced complexity**: Single migration file vs 27+ files
- **Fewer errors**: Less chance of migration conflicts
- **Clean history**: No development noise for new team members

### Main Branch Benefits  
- **Full history**: Complete development timeline
- **Debugging**: Can trace specific changes and their impact
- **Incremental development**: Easy to add/modify individual features
- **Rollback capability**: Can revert specific migrations if needed

## 🎯 Best Practices

1. **Default to clean branch** for new developers
2. **Use main branch** for active development and debugging
3. **Update clean branch** monthly or after major feature releases
4. **Keep migrations_backup** as reference for migration history
5. **Test both branches** before major releases

## 🚨 Important Notes

- Both branches produce **identical database schemas**
- The consolidated migration includes **all functionality** from incremental migrations
- **No data loss** - both approaches create the same end result
- **Backup exists** - all original migrations are preserved in `migrations_backup/`

---

This strategy provides the best of both worlds: development flexibility and onboarding simplicity.
