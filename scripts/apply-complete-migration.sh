#!/bin/bash

# ============================================================================
# Apply Complete Database Migration
# ============================================================================
# This script applies a complete database migration (schema + data)
# Usage: ./apply-complete-migration.sh <timestamp>
#
# Example: ./apply-complete-migration.sh 20251013160000
#
# The script will:
# 1. Find the migration files with that timestamp
# 2. Apply the schema file (DDL)
# 3. Apply the data file (DML)
# 4. Verify the migration
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-7012}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-postgres}"
MIGRATIONS_DIR="apps/api/supabase/migrations"

# Check for timestamp argument
if [ -z "$1" ]; then
    echo -e "${RED}Error: Migration timestamp required${NC}"
    echo ""
    echo "Usage: $0 <timestamp>"
    echo ""
    echo "Available migrations:"
    ls -1 "${MIGRATIONS_DIR}"/*_complete_schema.sql 2>/dev/null | \
        sed 's/.*\/\([0-9]*\)_complete_schema.sql/  \1/' || \
        echo "  No complete migrations found"
    echo ""
    exit 1
fi

TIMESTAMP="$1"
SCHEMA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_schema.sql"
DATA_FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_complete_data.sql"

# Verify files exist
if [ ! -f "${SCHEMA_FILE}" ]; then
    echo -e "${RED}Error: Schema file not found: ${SCHEMA_FILE}${NC}"
    exit 1
fi

if [ ! -f "${DATA_FILE}" ]; then
    echo -e "${RED}Error: Data file not found: ${DATA_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Apply Complete Database Migration${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Migration timestamp: ${YELLOW}${TIMESTAMP}${NC}"
echo -e "Database: ${YELLOW}${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo -e "Schema file: ${SCHEMA_FILE}"
echo -e "Data file: ${DATA_FILE}"
echo ""

# Warning
echo -e "${RED}⚠️  WARNING ⚠️${NC}"
echo -e "${RED}This will DROP and RECREATE the following schemas:${NC}"
echo -e "${RED}- public${NC}"
echo -e "${RED}- n8n${NC}"
echo -e "${RED}- company${NC}"
echo -e "${RED}All existing data in these schemas will be LOST!${NC}"
echo ""

# Confirmation
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo -e "${YELLOW}Step 1: Applying Schema (DDL)${NC}"
echo "This will create all database structures..."
echo ""

PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -f "${SCHEMA_FILE}" \
    --single-transaction \
    -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Schema applied successfully${NC}"
else
    echo -e "${RED}✗ Schema application failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Applying Data (DML)${NC}"
echo "This will insert all seed data..."
echo ""

PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -f "${DATA_FILE}" \
    --single-transaction \
    -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data applied successfully${NC}"
else
    echo -e "${RED}✗ Data application failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Verifying Migration${NC}"
echo ""

# Verification queries
echo "Table row counts:"
PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -c "SELECT schemaname, tablename, n_live_tup as row_count FROM pg_stat_user_tables WHERE schemaname IN ('public', 'n8n', 'company') ORDER BY schemaname, tablename;" \
    -t

echo ""
echo "Users in auth.users:"
PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -c "SELECT COUNT(*) as user_count FROM auth.users;" \
    -t

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✓ Migration Complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo "Your database is now ready to use."
echo ""



