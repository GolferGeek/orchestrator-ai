---
description: "Apply a database snapshot to restore schemas and seed data"
argument-hint: "[snapshot-path or 'latest']"
---

# Apply Database Snapshot

Apply a database snapshot to restore all schemas (public, n8n, company, observability) and seed data (agents, providers, models). This is the primary way interns receive database updates.

**Usage:** `/supabase:snapshot:apply [snapshot-path]`

**Examples:**
- `/supabase:snapshot:apply` (applies latest snapshot)
- `/supabase:snapshot:apply latest` (applies latest snapshot)
- `/supabase:snapshot:apply storage/snapshots/2025-01-12-143022/` (applies specific snapshot)
- `/supabase:snapshot:apply feature-user-auth` (applies named snapshot if exists)

## Process

### 1. Determine Snapshot Path

- If no argument provided: Use `storage/snapshots/latest/`
- If "latest" provided: Use `storage/snapshots/latest/`
- If path provided: Use that path
- If name provided: Look for `storage/snapshots/<name>/` or symlink

### 2. Verify Snapshot Exists

Check that snapshot directory contains:
- `schema.sql` (required)
- `seed.sql` (required)
- `metadata.json` (optional but preferred)

If snapshot missing, show error:
```
❌ Error: Snapshot not found at [path]
Available snapshots:
  - storage/snapshots/2025-01-12-143022/
  - storage/snapshots/2025-01-10-120000/
```

### 3. Display Snapshot Info

Show snapshot metadata if available:
```
📋 Snapshot Info:
   Timestamp: 2025-01-12 14:30:22 UTC
   Created: [date]
   Size: [X] MB
```

### 4. Show Warning and Confirm

Display critical warning:
```
⚠️  WARNING: This will REPLACE your current database schemas!
   - All data in: public, n8n, company, observability will be DELETED
   - All tables will be dropped and recreated
   - Only seed data (agents, providers, models) will be restored
```

**Require explicit confirmation:** User must type "yes" to proceed.

### 5. Execute Apply Script

Run the snapshot apply script:

```bash
bash storage/scripts/apply-snapshot.sh [snapshot-path]
```

**What this script does:**
- Drops existing schemas (n8n, company, observability)
- Recreates schemas
- Applies schema.sql (structure)
- Applies seed.sql (seed data)
- Verifies success

### 6. Output Summary

Display success message:

```
✅ Database Snapshot Applied Successfully

📦 Applied Snapshot:
   storage/snapshots/2025-01-12-143022/

📋 Applied:
   ✅ Schema: public, n8n, company, observability
   ✅ Seed Data: agents, providers, models

🕐 Applied: [timestamp]

📊 Next Steps:
   1. Verify application is working: npm run dev
   2. Check agents are loaded: /supabase:agent:list
   3. Check N8N workflows: /supabase:n8n:list
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/apply-snapshot.sh` - never use direct Supabase CLI or API
- **DESTRUCTIVE**: This will DELETE all data in the specified schemas
- Only seed data (agents, providers, models) is restored - user data is lost
- Always backup before applying if you have local changes
- This is the primary way interns sync their database with the team

## Error Handling

- If snapshot not found: List available snapshots
- If schema.sql missing: Show error and abort
- If seed.sql missing: Show error and abort
- If database connection fails: Show connection error
- If SQL errors occur: Show SQL error output
- If user cancels: Abort gracefully with message

## Related Commands

- `/supabase:snapshot:export` - Export a snapshot
- `/supabase:backup` - Create full backup before applying
- `/supabase:restore` - Restore from backup if needed

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

