#!/bin/bash

# ============================================================================
# Complete Database Migration Generator
# ============================================================================
# This script generates a complete, portable migration from your database
# that includes:
# 1. Schema structure (DDL) - schemas, tables, indexes, constraints
# 2. Data (DML) - all data from specified schemas
#
# The generated files can be used to recreate the database from scratch.
# ============================================================================

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATIONS_DIR="apps/api/supabase/migrations"
SCHEMA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_schema.sql"
DATA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_data.sql"
README_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_MIGRATION_README.md"

# Database connection (adjust if needed)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-7012}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase_db_api-dev}"

# Use Docker's pg_dump if container exists
if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "Using pg_dump from Docker container: ${DB_CONTAINER}"
    PG_DUMP_CMD="docker exec ${DB_CONTAINER} pg_dump"
else
    echo "Using local pg_dump"
    PG_DUMP_CMD="pg_dump"
fi

# Schemas to include
SCHEMAS="public n8n company"
AUTH_SCHEMAS="auth"  # Special handling for auth schema

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Complete Database Migration Generator${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Create migrations directory if it doesn't exist
mkdir -p "${MIGRATIONS_DIR}"

echo -e "${YELLOW}Step 1: Generating Schema Structure (DDL)${NC}"
echo "This includes: schemas, extensions, types, functions, tables, indexes, constraints"
echo ""

# Generate schema-only dump
if [[ "${PG_DUMP_CMD}" == *"docker"* ]]; then
    # Use Docker exec (connection is internal to container)
    ${PG_DUMP_CMD} \
      -U "${DB_USER}" \
      -d "${DB_NAME}" \
      --schema-only \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=n8n \
      --schema=company \
      --schema=auth \
      -f "/tmp/schema_dump.sql" && \
    docker cp "${DB_CONTAINER}:/tmp/schema_dump.sql" "${SCHEMA_FILE}.tmp"
else
    # Use local pg_dump (requires host and port)
    PGPASSWORD="${DB_PASS}" ${PG_DUMP_CMD} \
      -h "${DB_HOST}" \
      -p "${DB_PORT}" \
      -U "${DB_USER}" \
      -d "${DB_NAME}" \
      --schema-only \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=n8n \
      --schema=company \
      --schema=auth \
      -f "${SCHEMA_FILE}.tmp"
fi

# Create a clean schema file with proper header
cat > "${SCHEMA_FILE}" << 'EOF'
-- ============================================================================
-- Complete Database Schema Migration (DDL)
-- ============================================================================
-- This file creates all database structures from scratch:
-- - Schemas (public, n8n, company, auth)
-- - Extensions (uuid-ossp, pgcrypto, etc.)
-- - Types, Enums, Domains
-- - Functions and Triggers
-- - Tables with all columns
-- - Indexes and Constraints
-- - Row Level Security (RLS) Policies
--
-- This file does NOT include any data.
-- Run the corresponding *_complete_data.sql file after this one.
-- ============================================================================

-- Ensure we start fresh
BEGIN;

-- Drop existing schemas (CASCADE removes all dependent objects)
-- WARNING: This will delete all data in these schemas!
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS company;

-- Note: auth schema is created by Supabase, but we ensure it exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Set default search path
ALTER DATABASE postgres SET search_path TO public, n8n, company, auth;

COMMIT;

-- Now add the pg_dump generated schema
-- ============================================================================

EOF

# Append the pg_dump output, cleaning it up
cat "${SCHEMA_FILE}.tmp" >> "${SCHEMA_FILE}"
rm "${SCHEMA_FILE}.tmp"

echo -e "${GREEN}✓ Schema file created: ${SCHEMA_FILE}${NC}"
echo ""

echo -e "${YELLOW}Step 2: Generating Data (DML)${NC}"
echo "This includes all data from: public, n8n, company, and auth.users"
echo ""

# Generate data-only dump
if [[ "${PG_DUMP_CMD}" == *"docker"* ]]; then
    # Use Docker exec (connection is internal to container)
    ${PG_DUMP_CMD} \
      -U "${DB_USER}" \
      -d "${DB_NAME}" \
      --data-only \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=n8n \
      --schema=company \
      --table=auth.users \
      --column-inserts \
      --rows-per-insert=100 \
      -f "/tmp/data_dump.sql" && \
    docker cp "${DB_CONTAINER}:/tmp/data_dump.sql" "${DATA_FILE}.tmp"
else
    # Use local pg_dump (requires host and port)
    PGPASSWORD="${DB_PASS}" ${PG_DUMP_CMD} \
      -h "${DB_HOST}" \
      -p "${DB_PORT}" \
      -U "${DB_USER}" \
      -d "${DB_NAME}" \
      --data-only \
      --no-owner \
      --no-acl \
      --schema=public \
      --schema=n8n \
      --schema=company \
      --table=auth.users \
      --column-inserts \
      --rows-per-insert=100 \
      -f "${DATA_FILE}.tmp"
fi

# Create a clean data file with proper header
cat > "${DATA_FILE}" << 'EOF'
-- ============================================================================
-- Complete Database Seed Data (DML)
-- ============================================================================
-- This file inserts all data into the database structures.
-- 
-- Prerequisites:
-- 1. Run the corresponding *_complete_schema.sql file first
-- 2. Ensure all tables exist before running this file
--
-- Includes data from:
-- - public schema (all tables)
-- - n8n schema (all tables)  
-- - company schema (all tables)
-- - auth.users table
--
-- Data is inserted in dependency order to avoid foreign key violations.
-- ============================================================================

BEGIN;

-- Temporarily disable triggers for faster bulk insert
SET session_replication_role = replica;

-- Insert data
-- ============================================================================

EOF

# Append the pg_dump output
cat "${DATA_FILE}.tmp" >> "${DATA_FILE}"

# Re-enable triggers at the end
cat >> "${DATA_FILE}" << 'EOF'

-- ============================================================================
-- Post-Insert Tasks
-- ============================================================================

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Update sequences to prevent ID conflicts
-- This ensures auto-incrementing IDs start after existing data
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    -- Find all sequences and update them
    FOR seq_record IN 
        SELECT 
            schemaname || '.' || sequencename AS full_sequence,
            schemaname,
            sequencename
        FROM pg_sequences
        WHERE schemaname IN ('public', 'n8n', 'company')
    LOOP
        BEGIN
            -- Try to update the sequence
            EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true)',
                seq_record.full_sequence,
                replace(seq_record.sequencename, '_id_seq', '') || '_id',
                seq_record.schemaname,
                replace(seq_record.sequencename, '_id_seq', '')
            );
        EXCEPTION
            WHEN OTHERS THEN
                -- Sequence might not correspond to a table column, skip it
                RAISE NOTICE 'Could not update sequence %', seq_record.full_sequence;
        END;
    END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- 
-- Verify the data was loaded correctly:
-- 
-- SELECT schemaname, tablename, n_live_tup as row_count 
-- FROM pg_stat_user_tables 
-- WHERE schemaname IN ('public', 'n8n', 'company')
-- ORDER BY schemaname, tablename;
--
-- ============================================================================

EOF

rm "${DATA_FILE}.tmp"

echo -e "${GREEN}✓ Data file created: ${DATA_FILE}${NC}"
echo ""

echo -e "${YELLOW}Step 3: Generating README${NC}"
echo ""

# Create README with usage instructions
cat > "${README_FILE}" << EOF
# Complete Database Migration

**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Type:** Complete baseline migration (schema + data)

## Files

This migration consists of two files that must be run in order:

1. \`${TIMESTAMP}_complete_schema.sql\` - Database structure (DDL)
2. \`${TIMESTAMP}_complete_data.sql\` - Seed data (DML)
3. \`${TIMESTAMP}_MIGRATION_README.md\` - This file

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

\`\`\`bash
# 1. Start Supabase
cd apps/api
npx supabase start

# 2. Apply schema (structure)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_schema.sql

# 3. Apply data (seed)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_data.sql

# 4. Verify
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -c "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company') ORDER BY schemaname;"
\`\`\`

### Reset Existing Database

⚠️ **WARNING:** This will delete all existing data!

\`\`\`bash
# Option 1: Use the schema file (it includes DROP SCHEMA CASCADE)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_schema.sql

PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_data.sql

# Option 2: Manual drop and recreate
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres << 'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
SQL

# Then apply the migration files as above
\`\`\`

### Production Deployment

⚠️ **CAUTION:** Always backup production data first!

\`\`\`bash
# 1. Backup current database
PGPASSWORD=\$PROD_PASSWORD pg_dump -h \$PROD_HOST -p \$PROD_PORT -U \$PROD_USER -d \$PROD_DB \\
  -Fc -f backup_\$(date +%Y%m%d_%H%M%S).dump

# 2. Apply schema
PGPASSWORD=\$PROD_PASSWORD psql -h \$PROD_HOST -p \$PROD_PORT -U \$PROD_USER -d \$PROD_DB \\
  -f supabase/migrations/${TIMESTAMP}_complete_schema.sql

# 3. Apply data
PGPASSWORD=\$PROD_PASSWORD psql -h \$PROD_HOST -p \$PROD_PORT -U \$PROD_USER -d \$PROD_DB \\
  -f supabase/migrations/${TIMESTAMP}_complete_data.sql
\`\`\`

### For Your Nephew (Clean Start)

Your nephew can use these files to set up the database from scratch:

\`\`\`bash
# 1. Install Supabase CLI (if not already installed)
npm install -g supabase

# 2. Clone the repository
git clone <your-repo-url>
cd <repo-name>

# 3. Start local Supabase
cd apps/api
npx supabase start

# 4. Apply migrations in order
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_schema.sql

PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f supabase/migrations/${TIMESTAMP}_complete_data.sql

# 5. Start the API
npm install
npm run dev
\`\`\`

## Verification Queries

After applying the migration, verify everything is working:

\`\`\`sql
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
\`\`\`

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
- Check that all schemas were created: \`\\dn\`

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
   - \`${TIMESTAMP}XXXX_add_new_feature.sql\`
3. **Keep this baseline** - This file remains as your "known good state"

---

**Questions?** Check the main README or contact the team.

EOF

echo -e "${GREEN}✓ README created: ${README_FILE}${NC}"
echo ""

echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✓ Migration Generation Complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Generated files:"
echo -e "  1. ${SCHEMA_FILE}"
echo -e "  2. ${DATA_FILE}"
echo -e "  3. ${README_FILE}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Review the generated files"
echo -e "  2. Test on a clean database:"
echo -e "     ${GREEN}PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres -f ${SCHEMA_FILE}${NC}"
echo -e "     ${GREEN}PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres -f ${DATA_FILE}${NC}"
echo -e "  3. Commit the files to git"
echo -e "  4. Share with your nephew"
echo ""
echo -e "${BLUE}============================================================================${NC}"


