# Complete Database Migration Guide

This guide explains how to create and use complete database migrations that include **all schemas, tables, and data** for Orchestrator-AI.

## Problem This Solves

When sharing your database with others (like your nephew), they need:
1. All schema definitions (CREATE TABLE, CREATE SCHEMA, etc.)
2. All data (INSERT statements)
3. Everything in the correct order to avoid dependency errors

A simple `pg_dump` backup file often doesn't work because it assumes certain objects already exist.

## Solution: Complete Migration Files

We generate **two separate SQL files** that can recreate the entire database from scratch:

1. **Schema File** (`*_complete_schema.sql`) - Creates all database structures
2. **Data File** (`*_complete_data.sql`) - Inserts all data

## Included Schemas

The migration includes these schemas:
- **public** - Core application tables (agents, conversations, orchestrations, etc.)
- **n8n** - n8n workflow engine tables
- **company** - Company, departments, KPI data
- **auth** - User authentication (Supabase)

## Quick Start

### Generate Migration Files

```bash
# From the project root
./scripts/generate-complete-migration.sh
```

This creates three files in `apps/api/supabase/migrations/`:
- `YYYYMMDDHHMMSS_complete_schema.sql` - Database structure
- `YYYYMMDDHHMMSS_complete_data.sql` - Seed data
- `YYYYMMDDHHMMSS_MIGRATION_README.md` - Instructions

### Apply Migration

```bash
# Apply to local Supabase
./scripts/apply-complete-migration.sh <timestamp>

# Example:
./scripts/apply-complete-migration.sh 20251013160000
```

The timestamp is from the generated filenames.

## For Your Nephew (Fresh Setup)

Your nephew can set up the database from scratch using these files:

### Prerequisites

1. Node.js and npm installed
2. Git repository cloned

### Setup Steps

```bash
# 1. Navigate to the API directory
cd apps/api

# 2. Install dependencies
npm install

# 3. Install Supabase CLI globally (if not already installed)
npm install -g supabase

# 4. Start local Supabase
npx supabase start

# This will output connection details like:
# API URL: http://127.0.0.1:54321
# DB URL: postgresql://postgres:postgres@127.0.0.1:7012/postgres
# ...

# 5. Apply the schema migration
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/<TIMESTAMP>_complete_schema.sql

# 6. Apply the data migration
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f supabase/migrations/<TIMESTAMP>_complete_data.sql

# 7. Verify the migration worked
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company');"

# 8. Copy environment file and configure
cp .env.example .env
# Edit .env with your API keys

# 9. Start the API
npm run dev
```

## Manual Steps (Without Scripts)

If you prefer to do it manually:

### Generate Files Manually

```bash
# Navigate to project root
cd /path/to/orchestrator-ai

# Set connection details
export DB_HOST=127.0.0.1
export DB_PORT=7012
export DB_USER=postgres
export DB_PASS=postgres
export DB_NAME=postgres
export TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Generate schema-only dump
PGPASSWORD=${DB_PASS} pg_dump \
  -h ${DB_HOST} \
  -p ${DB_PORT} \
  -U ${DB_USER} \
  -d ${DB_NAME} \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=n8n \
  --schema=company \
  --schema=auth \
  -f "apps/api/supabase/migrations/${TIMESTAMP}_complete_schema.sql"

# Generate data-only dump
PGPASSWORD=${DB_PASS} pg_dump \
  -h ${DB_HOST} \
  -p ${DB_PORT} \
  -U ${DB_USER} \
  -d ${DB_NAME} \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --schema=n8n \
  --schema=company \
  --table=auth.users \
  --column-inserts \
  --rows-per-insert=100 \
  -f "apps/api/supabase/migrations/${TIMESTAMP}_complete_data.sql"
```

### Apply Files Manually

```bash
# Apply schema
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/<TIMESTAMP>_complete_schema.sql

# Apply data
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/<TIMESTAMP>_complete_data.sql
```

## File Structure

```
apps/api/supabase/migrations/
├── 20251013160000_complete_schema.sql     # Database structure (DDL)
├── 20251013160000_complete_data.sql       # Seed data (DML)
├── 20251013160000_MIGRATION_README.md     # Migration-specific instructions
├── 202510131500_global_image_agents_hierarchy.sql  # Old migrations
├── 202510131510_finance_manager_hierarchy.sql
└── ...
```

## What's in Each File

### Schema File (`*_complete_schema.sql`)

Contains all database structure definitions:

- `DROP SCHEMA IF EXISTS ... CASCADE` - Clean slate
- `CREATE SCHEMA` - Create schemas (public, n8n, company)
- `CREATE EXTENSION` - PostgreSQL extensions (uuid-ossp, pgcrypto, etc.)
- `CREATE TYPE` - Custom types and enums
- `CREATE FUNCTION` - Functions and procedures
- `CREATE TABLE` - All table definitions
- `CREATE INDEX` - All indexes
- `ALTER TABLE` - Constraints (foreign keys, unique, check)
- `CREATE POLICY` - Row Level Security policies

### Data File (`*_complete_data.sql`)

Contains all data inserts:

- `INSERT INTO` statements for all tables
- Data from public, n8n, company schemas
- User data from auth.users
- Sequence updates to prevent ID conflicts
- Proper ordering to respect foreign keys

## Troubleshooting

### "relation does not exist"

**Cause:** Data file ran before schema file, or schema file didn't complete successfully.

**Solution:**
```bash
# Re-run the schema file
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/<TIMESTAMP>_complete_schema.sql

# Then run the data file
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/<TIMESTAMP>_complete_data.sql
```

### "foreign key violation"

**Cause:** Data is being inserted in the wrong order.

**Solution:** The data file should already handle this, but if you see this error:
1. Check that the schema file completed successfully
2. Drop and recreate the database
3. Re-run both files

```bash
# Drop and recreate
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << 'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA n8n;
CREATE SCHEMA company;
SQL

# Re-apply migrations
./scripts/apply-complete-migration.sh <timestamp>
```

### "permission denied"

**Cause:** Wrong database user or insufficient privileges.

**Solution:**
- For local Supabase, use `postgres` user with password `postgres`
- For production, ensure your user has CREATE, INSERT, and ALTER privileges

### Migration takes too long

**Cause:** Large data file, slow network, or connection issues.

**Solution:**
- Run migrations locally first to verify
- Increase connection timeout
- Split very large data files if needed

## Advanced Usage

### Custom Database Connection

```bash
# Set environment variables before running scripts
export DB_HOST=your-host.com
export DB_PORT=5432
export DB_USER=your-user
export DB_PASS=your-password
export DB_NAME=your-database

# Then run the scripts
./scripts/generate-complete-migration.sh
./scripts/apply-complete-migration.sh <timestamp>
```

### Selective Schema Migration

To migrate only specific schemas, edit the script or use manual pg_dump commands:

```bash
# Only public and company schemas
PGPASSWORD=postgres pg_dump \
  -h 127.0.0.1 \
  -p 7012 \
  -U postgres \
  -d postgres \
  --schema-only \
  --schema=public \
  --schema=company \
  -f custom_migration.sql
```

### Data-Only Updates

If you only want to refresh data without changing the schema:

```bash
# Just run the data file
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \
  -f apps/api/supabase/migrations/<TIMESTAMP>_complete_data.sql
```

## Best Practices

1. **Generate migrations regularly** - After significant changes, generate new migration files
2. **Test migrations** - Always test on a clean database before sharing
3. **Version control** - Commit migration files to git
4. **Document changes** - Note what changed in each migration
5. **Keep old migrations** - Don't delete old migration files; they're part of your history
6. **Backup before applying** - Always backup production before applying migrations

## Comparison with Other Approaches

### vs. `pg_dump` Backup

| Feature | Complete Migration | pg_dump Backup |
|---------|-------------------|----------------|
| Creates schemas | ✅ Yes | ❌ Assumes they exist |
| Includes all data | ✅ Yes | ✅ Yes |
| Clean slate install | ✅ Yes | ❌ May fail |
| Separated structure/data | ✅ Yes | ❌ Combined |
| Git-friendly | ✅ Yes | ⚠️ Binary format |

### vs. Supabase Migrations

| Feature | Complete Migration | Supabase Migrations |
|---------|-------------------|---------------------|
| All-in-one baseline | ✅ Yes | ❌ Incremental only |
| Portable | ✅ Yes | ⚠️ Supabase-specific |
| Includes auth schema | ✅ Yes | ⚠️ Limited |
| Fresh install | ✅ Yes | ⚠️ Requires all migrations |

## Next Steps

After setting up the database with these migrations:

1. **Configure environment** - Copy `.env.example` to `.env` and add your API keys
2. **Start the API** - Run `npm run dev` in the `apps/api` directory
3. **Test endpoints** - Verify the API is working
4. **Create incremental migrations** - For future changes, create new migration files

## Questions?

- Check the main project README
- Review the generated `*_MIGRATION_README.md` file
- Contact the team

---

**Created:** 2025-10-13  
**Last Updated:** 2025-10-13



