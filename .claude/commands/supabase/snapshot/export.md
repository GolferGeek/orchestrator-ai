---
description: "Export a complete database snapshot (schemas + seed data) for distribution"
argument-hint: "[optional snapshot name/tag]"
---

# Export Database Snapshot

Export a complete database snapshot including all schemas (public, n8n, company, observability) and seed data (agents, providers, models) for distribution to interns or team members.

**Usage:** `/supabase:snapshot:export [optional-name]`

**Examples:**
- `/supabase:snapshot:export` (creates timestamped snapshot)
- `/supabase:snapshot:export feature-user-auth` (creates named snapshot)

## Process

### 1. Verify Prerequisites

- Ensure Supabase database is running and accessible
- Check database connection (host: 127.0.0.1, port: 7012)
- Verify `storage/scripts/export-snapshot.sh` exists and is executable

### 2. Execute Export Script

Run the snapshot export script:

```bash
bash storage/scripts/export-snapshot.sh
```

**What this script does:**
- Creates timestamped directory: `storage/snapshots/<timestamp>/`
- Exports schemas (structure only): `schema.sql`
- Exports seed data: `seed.sql` (agents, providers, models)
- Creates `metadata.json` with snapshot info
- Updates `storage/snapshots/latest/` symlink

### 3. Optional: Named Snapshot

If a name/tag is provided in `$ARGUMENTS`:
- Create additional symlink: `storage/snapshots/<name>/`
- Or copy snapshot to named directory

### 4. Output Summary

Display snapshot details:

```
✅ Database Snapshot Exported Successfully

📦 Snapshot Location:
   storage/snapshots/2025-01-12-143022/

📋 Contents:
   - schema.sql (all 4 schemas: public, n8n, company, observability)
   - seed.sql (agents, providers, models)
   - metadata.json

🔗 Latest Symlink:
   storage/snapshots/latest/ → 2025-01-12-143022/

📊 Size: [X] MB
🕐 Created: [timestamp]

📤 Next Steps:
   1. Share storage/snapshots/ directory with team
   2. Team members can apply with: /supabase:snapshot:apply
```

## Important Notes

- **CRITICAL**: This command MUST use `storage/scripts/export-snapshot.sh` - never use direct Supabase CLI or API
- Snapshots include structure only (schemas) + seed data (not user data)
- Always export after major database changes
- Share entire `storage/snapshots/` directory for distribution
- The `latest/` symlink points to most recent snapshot

## Error Handling

- If database not accessible: Show connection error and suggest checking Supabase status
- If script fails: Show script output and error details
- If storage directory missing: Create directory structure automatically
- If insufficient disk space: Warn user before starting export

## Related Commands

- `/supabase:snapshot:apply` - Apply a snapshot to database
- `/supabase:agent:export` - Export individual agents
- `/supabase:n8n:export` - Export N8N workflows

## Skill Reference

This command leverages the `supabase-management-skill` for context. See `.claude/skills/supabase-management-skill/REFERENCE.md` for detailed script documentation.

