---
description: "Propose a database migration (for interns to submit to lead developer)"
argument-hint: "[migration description or SQL file]"
---

# Propose Database Migration

Create a proposed database migration file for review by the lead developer. This is how interns submit database changes.

**Usage:** `/supabase:migration:propose [description]`

**Examples:**
- `/supabase:migration:propose "Add user_preferences table"` (interactive SQL creation)
- `/supabase:migration:propose path/to/migration.sql` (use existing SQL file)

## Process

### 1. Determine Migration Source

**If SQL file path provided:**
- Read SQL file from path
- Validate SQL syntax (basic check)
- Use file contents as migration

**If description provided:**
- Parse description to understand required changes
- Generate SQL migration based on description
- Show generated SQL for review

### 2. Generate Migration File

Create migration file in `storage/migrations/proposed/`:

**Filename format:** `YYYYMMDD-HHMM-description-slug.sql`

Example: `20250112-1430-add-user-preferences-table.sql`

**File structure:**
```sql
-- Migration: Add user_preferences table
-- Proposed by: [user]
-- Date: 2025-01-12 14:30:00
-- Description: Adds user_preferences table to store user settings

-- Up migration
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Down migration (optional, commented out)
-- DROP TABLE IF EXISTS public.user_preferences;
```

### 3. Review Migration

Display migration for review:

```
📋 Proposed Migration Created

📄 File: storage/migrations/proposed/20250112-1430-add-user-preferences-table.sql

📝 SQL:
[Show SQL content]

⚠️  Review Checklist:
   [ ] SQL syntax is correct
   [ ] Follows naming conventions (snake_case)
   [ ] Includes indexes for foreign keys
   [ ] Includes timestamps (created_at, updated_at)
   [ ] Includes down migration (if needed)
   [ ] No data loss unless intentional
```

### 4. Save Migration File

Write migration file to `storage/migrations/proposed/` directory.

### 5. Output Summary

```
✅ Migration Proposed Successfully

📄 Migration File:
   storage/migrations/proposed/20250112-1430-add-user-preferences-table.sql

📋 Next Steps:
   1. Review the migration SQL above
   2. Commit migration file to git
   3. Create PR with migration file
   4. Lead developer will review and apply with: /supabase:migration:apply

💡 Tips:
   - Test migration locally first (create test database)
   - Include down migration if reversing is needed
   - Follow naming conventions (snake_case for tables/columns)
   - Add indexes for foreign keys and frequently queried columns
```

## Important Notes

- **CRITICAL**: Proposed migrations are NOT applied automatically
- Migrations must be reviewed and approved by lead developer
- Always test migrations locally before proposing
- Follow Orchestrator AI naming conventions (snake_case)
- Include proper indexes and constraints
- Consider data migration needs (not just schema changes)

## Migration Best Practices

- **Naming**: Use snake_case for tables, columns, indexes
- **Timestamps**: Always include `created_at` and `updated_at` TIMESTAMPTZ columns
- **Indexes**: Add indexes for foreign keys and frequently queried columns
- **Constraints**: Use NOT NULL where appropriate, add CHECK constraints
- **Down Migration**: Include commented-out down migration for reversibility
- **Data Safety**: Never drop columns/tables without data migration plan

## Error Handling

- If SQL syntax invalid: Show error and allow correction
- If file path invalid: Show error and suggest correct path
- If description unclear: Ask clarifying questions
- If migration directory missing: Create directory automatically

## Related Commands

- `/supabase:migration:apply` - Apply approved migration (lead developer only)
- `/supabase:snapshot:export` - Export snapshot after migration applied

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for migration guidelines.

