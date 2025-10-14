#!/bin/bash

# ============================================================================
# Convert Backup to Complete Migration
# ============================================================================
# This script converts an existing backup file into the complete migration
# format (separate schema and data files).
#
# Usage: ./convert-backup-to-migration.sh <backup_file.sql.gz>
# ============================================================================

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -la storage/backups/*.sql.gz
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Configuration
TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATIONS_DIR="apps/api/supabase/migrations"
TEMP_DIR="/tmp/backup_restore_$$"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Convert Backup to Migration Format${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo "Source backup: $BACKUP_FILE"
echo "Output timestamp: $TIMESTAMP"
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"
mkdir -p "$MIGRATIONS_DIR"

# Decompress backup to temp file
echo -e "${YELLOW}Step 1: Decompressing backup...${NC}"
gunzip -c "$BACKUP_FILE" > "$TEMP_DIR/full_backup.sql"
echo -e "${GREEN}✓ Decompressed${NC}"
echo ""

# Create a temporary database to load the backup
echo -e "${YELLOW}Step 2: Loading backup into temporary database...${NC}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-7012}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
TEMP_DB="temp_migration_$$"

# Create temp database
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $TEMP_DB;"

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE $TEMP_DB;"

# Load backup into temp database
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB" \
    -f "$TEMP_DIR/full_backup.sql" \
    -q

echo -e "${GREEN}✓ Backup loaded into temporary database${NC}"
echo ""

# Generate schema-only dump
echo -e "${YELLOW}Step 3: Extracting schema...${NC}"
SCHEMA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_schema.sql"

PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEMP_DB" \
    --schema-only \
    --no-owner \
    --no-acl \
    --schema=public \
    --schema=n8n \
    --schema=company \
    --schema=auth \
    -f "${SCHEMA_FILE}.tmp"

# Add header to schema file
cat > "$SCHEMA_FILE" << 'EOF'
-- ============================================================================
-- Complete Database Schema Migration (DDL)
-- ============================================================================
-- Converted from backup file
-- This file creates all database structures from scratch.
-- ============================================================================

BEGIN;

-- Drop existing schemas
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS auth;

COMMIT;

-- Schema definitions
-- ============================================================================

EOF

cat "${SCHEMA_FILE}.tmp" >> "$SCHEMA_FILE"
rm "${SCHEMA_FILE}.tmp"

echo -e "${GREEN}✓ Schema file created: $SCHEMA_FILE${NC}"
echo ""

# Generate data-only dump
echo -e "${YELLOW}Step 4: Extracting data...${NC}"
DATA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_data.sql"

PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$TEMP_DB" \
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

# Add header to data file
cat > "$DATA_FILE" << 'EOF'
-- ============================================================================
-- Complete Database Seed Data (DML)
-- ============================================================================
-- Converted from backup file
-- This file inserts all data into the database.
-- ============================================================================

BEGIN;

-- Temporarily disable triggers for faster bulk insert
SET session_replication_role = replica;

-- Insert data
-- ============================================================================

EOF

cat "${DATA_FILE}.tmp" >> "$DATA_FILE"

# Add footer
cat >> "$DATA_FILE" << 'EOF'

-- ============================================================================
-- Post-Insert Tasks
-- ============================================================================

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Update sequences to prevent ID conflicts
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN 
        SELECT schemaname || '.' || sequencename AS full_sequence
        FROM pg_sequences
        WHERE schemaname IN ('public', 'n8n', 'company')
    LOOP
        BEGIN
            EXECUTE format('SELECT setval(%L, (SELECT MAX(id) FROM %I.%I) + 1, false)',
                seq_record.full_sequence,
                split_part(seq_record.full_sequence, '.', 1),
                replace(split_part(seq_record.full_sequence, '.', 2), '_id_seq', '')
            );
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
    END LOOP;
END $$;

COMMIT;

EOF

rm "${DATA_FILE}.tmp"

echo -e "${GREEN}✓ Data file created: $DATA_FILE${NC}"
echo ""

# Cleanup temp database
echo -e "${YELLOW}Step 5: Cleaning up...${NC}"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE $TEMP_DB;" \
    -q

rm -rf "$TEMP_DIR"

echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Create README
README_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_MIGRATION_README.md"
cat > "$README_FILE" << EOF
# Database Migration from Backup

**Source:** $(basename $BACKUP_FILE)  
**Generated:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Type:** Complete migration (converted from backup)

## Files

1. \`${TIMESTAMP}_complete_schema.sql\` - Database structure (DDL)
2. \`${TIMESTAMP}_complete_data.sql\` - Seed data (DML)
3. \`${TIMESTAMP}_MIGRATION_README.md\` - This file

## Usage

\`\`\`bash
# Apply schema
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f apps/api/supabase/migrations/${TIMESTAMP}_complete_schema.sql

# Apply data
PGPASSWORD=postgres psql -h 127.0.0.1 -p 7012 -U postgres -d postgres \\
  -f apps/api/supabase/migrations/${TIMESTAMP}_complete_data.sql
\`\`\`

Or use the apply script:

\`\`\`bash
./scripts/apply-complete-migration.sh ${TIMESTAMP}
\`\`\`

See \`scripts/COMPLETE_MIGRATION_GUIDE.md\` for detailed instructions.

---

**Converted from:** $BACKUP_FILE
EOF

echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✓ Conversion Complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo "Generated files:"
echo "  1. $SCHEMA_FILE"
echo "  2. $DATA_FILE"
echo "  3. $README_FILE"
echo ""
echo "These files can now be used with:"
echo "  ${GREEN}./scripts/apply-complete-migration.sh ${TIMESTAMP}${NC}"
echo ""



