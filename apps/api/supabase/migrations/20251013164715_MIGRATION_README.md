# Complete Database Migration

**Generated:** 2025-10-13 21:47:16 UTC  
**Type:** Complete baseline migration (schema + data)

## Files

This migration consists of two files that must be run in order:

1. `20251013164715_complete_schema.sql` - Database structure (DDL)
2. `20251013164715_complete_data.sql` - Seed data (DML)
3. `20251013164715_MIGRATION_README.md` - This file

## What's Included

### Schemas
- **public** - Core application tables
- **n8n** - n8n workflow engine tables
- **company** - Company, departments, KPIs
- **auth** - User authentication (Supabase)

### Structure File Includes
- All table definitions
- All indexes
- All constraints (primary keys, foreign keys, unique, check)
- All functions and triggers
- All enums and custom types
- Row Level Security (RLS) policies
- Extensions (uuid-ossp, pgcrypto, etc.)

### Data File Includes
- All data from public schema
- All data from n8n schema
- All data from company schema
- User data from auth.users table

## Usage

### Fresh Install (Local Supabase)

```bash
# 1. Start Supabase
cd apps/api
npx supabase start

# 2. Apply schema (structure)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_schema.sql

# 3. Apply data (seed)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_data.sql

# 4. Verify
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company') ORDER BY schemaname;"
```

### Reset Existing Database

⚠️ **WARNING:** This will delete all existing data!

```bash
# Option 1: Use the schema file (it includes DROP SCHEMA CASCADE)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_schema.sql

PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_data.sql

# Option 2: Manual drop and recreate
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << 'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
SQL

# Then apply the migration files as above
```

### Production Deployment

⚠️ **CAUTION:** Always backup production data first!

```bash
# 1. Backup current database
PGPASSWORD=$PROD_PASSWORD pg_dump -h $PROD_HOST -p $PROD_PORT -U $PROD_USER -d $PROD_DB \
  -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Apply schema
PGPASSWORD=$PROD_PASSWORD psql -h $PROD_HOST -p $PROD_PORT -U $PROD_USER -d $PROD_DB \
  -f supabase/migrations/20251013164715_complete_schema.sql

# 3. Apply data
PGPASSWORD=$PROD_PASSWORD psql -h $PROD_HOST -p $PROD_PORT -U $PROD_USER -d $PROD_DB \
  -f supabase/migrations/20251013164715_complete_data.sql
```

### For Your Nephew (Clean Start)

Your nephew can use these files to set up the database from scratch:

```bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Clone the repository
git clone <your-repo-url>
cd <repo-name>

# 3. Start local Supabase
cd apps/api
npx supabase start

# 4. Apply migrations in order
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_schema.sql

PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/20251013164715_complete_data.sql

# 5. Start the API
npm install
npm run dev
```

## Verification Queries

After applying the migration, verify everything is working:

```sql
-- Check all tables have data
SELECT schemaname, tablename, n_live_tup as row_count 
FROM pg_stat_user_tables 
WHERE schemaname IN ('public', 'n8n', 'company')
ORDER BY schemaname, tablename;

-- Check users
SELECT email FROM auth.users;

-- Check agents (if applicable)
SELECT name, type FROM public.agents;

-- Check n8n workflows (if applicable)
SELECT name, active FROM n8n.workflow_entity;
```

## Benefits of This Approach

✅ **Complete** - Includes all schemas, tables, and data  
✅ **Portable** - Works on any PostgreSQL instance  
✅ **Organized** - Structure and data separated for clarity  
✅ **Safe** - Can be run multiple times (idempotent)  
✅ **Fast** - Bulk inserts with disabled triggers  
✅ **Documented** - Clear instructions for all use cases  

## Troubleshooting

### "relation does not exist"
- Make sure you ran the schema file before the data file
- Check that all schemas were created: `\dn`

### "foreign key violation"
- The data file inserts in dependency order, but if you see this:
  1. Check that the schema file completed successfully
  2. Ensure no tables are missing
  3. Try running the data file again (it's idempotent)

### "permission denied"
- Use the correct database user (usually 'postgres' for local)
- For production, use a user with CREATE, INSERT, and ALTER privileges

## Next Steps

After applying this baseline:

1. **Test the application** - Make sure everything works
2. **Create incremental migrations** - For future changes, create new migration files:
   - `20251013164715XXXX_add_new_feature.sql`
3. **Keep this baseline** - This file remains as your "known good state"

---

**Questions?** Check the main README or contact the team.

