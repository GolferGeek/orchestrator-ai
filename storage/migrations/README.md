# Migration Proposal System

This directory allows interns to propose database schema changes that the lead developer reviews and applies.

## 🔄 Workflow

### For Interns: Proposing Changes

1. **Create a migration file** in `proposed/`:
   ```bash
   # Use format: YYYYMMDD-HHMM-description.sql
   # Example: 20251027-1430-add-user-preferences-table.sql
   ```

2. **Write your migration**:
   ```sql
   -- Migration: Add user preferences table
   -- Author: intern-name
   -- Date: 2025-10-27
   -- Description: Adds a table to store user UI preferences

   CREATE TABLE public.user_preferences (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES auth.users(id),
     preferences JSONB NOT NULL DEFAULT '{}',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
   ```

3. **Share the file** with lead developer (via Dropbox/Drive/etc.)

4. **Lead reviews and applies** - You'll get the updated snapshot back

### For Lead Developer: Reviewing & Applying

1. **Review proposed migration**:
   ```bash
   # Check the proposed migration file
   cat storage/migrations/proposed/<migration-file>.sql
   ```

2. **Test it locally**:
   ```bash
   # Apply to your local database
   export PGPASSWORD=postgres
   docker exec -e PGPASSWORD=postgres supabase_db_api-dev psql \
     -h localhost -p 5432 -U postgres -d postgres \
     -f storage/migrations/proposed/<migration-file>.sql
   ```

3. **If approved, move to applied**:
   ```bash
   mv storage/migrations/proposed/<migration-file>.sql \
      storage/migrations/applied/
   ```

4. **Export new snapshot**:
   ```bash
   npm run db:export-snapshot
   ```

5. **Share updated snapshot** with team

## 📁 Directory Structure

```
storage/migrations/
├── README.md           # This file
├── proposed/           # Interns put migrations here
│   ├── 20251027-1430-add-feature-x.sql
│   └── 20251027-1445-update-table-y.sql
└── applied/            # Lead moves approved migrations here
    ├── 20251027-1200-add-observability.sql
    └── 20251027-1215-update-agents-schema.sql
```

## ✅ Migration File Template

Save this as `storage/migrations/TEMPLATE.sql`:

```sql
-- Migration: [Brief description]
-- Author: [Your name]
-- Date: [YYYY-MM-DD]
-- Description: [Detailed description of what this changes and why]
--
-- Related: [Link to issue/ticket if applicable]

-- ============================================
-- Migration Code Below
-- ============================================

-- Your SQL here


-- ============================================
-- Rollback Instructions (if needed)
-- ============================================
-- To rollback:
-- DROP TABLE IF EXISTS ...;
```

## 🚫 What NOT to Do

- ❌ Don't apply migrations directly to the database
- ❌ Don't modify files in `applied/` directory
- ❌ Don't check migrations into `apps/api/supabase/migrations/`
- ❌ Don't share database passwords or connection strings

## ✅ Best Practices

1. **One change per migration** - Don't bundle unrelated changes
2. **Test locally first** - Make sure it works before proposing
3. **Include rollback** - Document how to undo if needed
4. **Be descriptive** - Explain WHY, not just WHAT
5. **Check dependencies** - Note any required seed data or prior migrations

## 🎯 Example Workflow

### Intern wants to add a new feature:

```bash
# 1. Intern creates migration
cat > storage/migrations/proposed/20251027-1500-add-analytics-table.sql << 'EOF'
-- Migration: Add analytics tracking table
-- Author: Jane Intern
-- Date: 2025-10-27
-- Description: Track user analytics events for dashboard

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event_name VARCHAR(100) NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
EOF

# 2. Intern shares: "Hey, I created a migration for analytics tracking"

# 3. Lead reviews and tests
# 4. Lead approves: mv to applied/ and exports snapshot
# 5. Lead shares: "Applied! Get latest with: npm run db:apply-snapshot"
```

## 📊 Migration History

Keep track of applied migrations in `applied/` directory. They serve as:
- **Documentation** of schema evolution
- **Reference** for understanding changes
- **History** of what was added when
- **Examples** for future migrations

## 🔒 Security Notes

- Never include passwords, API keys, or secrets in migrations
- Don't commit production data
- Sanitize any example data used
- Review for SQL injection vulnerabilities

## 🆘 Questions?

- Check [storage/scripts/README.md](../scripts/README.md) for snapshot commands
- Ask lead developer for clarification
- Review existing migrations in `applied/` for examples
