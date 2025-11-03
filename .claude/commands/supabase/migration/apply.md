---
description: "Apply an approved database migration (lead developer only)"
argument-hint: "[migration-file-path]"
---

# Apply Database Migration

Apply an approved database migration file. This command is typically used by the lead developer after reviewing a proposed migration from an intern.

**Usage:** `/supabase:migration:apply [migration-file]`

**Examples:**
- `/supabase:migration:apply storage/migrations/proposed/20250112-1430-add-user-preferences.sql`
- `/supabase:migration:apply` (will list proposed migrations to choose from)

## Process

### 1. Determine Migration File

**If file path provided:**
- Use provided path
- Verify file exists

**If no path provided:**
- List all files in `storage/migrations/proposed/`
- Allow user to select which migration to apply
- Show migration preview before applying

### 2. Display Migration Preview

Show migration file contents:

```
📋 Migration File: storage/migrations/proposed/20250112-1430-add-user-preferences.sql

📄 Contents:
----------------------------------------
[Show first 30 lines of migration]
----------------------------------------

📊 Migration Stats:
   - Lines: [X]
   - Size: [X] KB
   - Proposed: [date]
```

### 3. Confirmation Prompt

Require explicit confirmation:

```
⚠️  About to apply this migration to the database

   This will:
   - Execute SQL statements in the migration file
   - Modify database schema/structure
   - Potentially modify data

   Are you sure you want to continue? (yes/no):
```

### 4. Execute Migration Script

Run the migration apply script:

```bash
bash storage/scripts/apply-proposed-migration.sh [migration-file]
```

**What this script does:**
- Applies migration SQL to database
- Verifies migration executed successfully
- Moves migration file from `proposed/` to `applied/` directory
- Records migration in metadata (if applicable)

### 5. Verify Migration Success

Check that migration applied correctly:
- Verify tables/columns created (if applicable)
- Check for any SQL errors
- Verify database state matches expected

### 6. Output Summary

Display success message:

```
✅ Migration Applied Successfully

📄 Migration File:
   storage/migrations/applied/20250112-1430-add-user-preferences.sql

📋 Applied Changes:
   ✅ Created table: public.user_preferences
   ✅ Created index: idx_user_preferences_user_id

🕐 Applied: [timestamp]

📊 Next Steps:
   1. Test that the migration worked correctly
   2. Export new snapshot: /supabase:snapshot:export
   3. Share updated snapshot with team
   4. Update documentation if needed
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/apply-proposed-migration.sh` - never use direct Supabase CLI or API
- **Lead Developer Only**: This modifies production/shared database structure
- Always review migration thoroughly before applying
- Export snapshot after applying migration for team distribution
- Migrations are moved from `proposed/` to `applied/` after successful application

## Error Handling

- If migration file not found: Show error and list available migrations
- If SQL errors occur: Show SQL error output and abort
- If database connection fails: Show connection error
- If migration already applied: Check and warn if duplicate
- If rollback needed: Guide user to use backup/restore

## Rollback Guidance

If migration needs to be rolled back:

```
🔄 Rollback Options:

   1. Restore from backup:
      /supabase:restore [backup-file]

   2. Apply down migration (if included):
      [Manually execute commented down migration]

   3. Create reverse migration:
      /supabase:migration:propose "Revert: [description]"
```

## Related Commands

- `/supabase:migration:propose` - Propose a migration (interns)
- `/supabase:snapshot:export` - Export snapshot after migration
- `/supabase:backup` - Create backup before applying migration

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

