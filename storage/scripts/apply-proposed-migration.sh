#!/bin/bash
# Apply a proposed migration from an intern

set -e

MIGRATION_FILE="$1"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$MIGRATION_FILE" ]; then
  echo "Usage: npm run db:apply-migration <migration-file>"
  echo "Example: npm run db:apply-migration storage/migrations/proposed/20251027-1500-add-feature.sql"
  exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}❌ Error: File not found: $MIGRATION_FILE${NC}"
  exit 1
fi

echo "📋 Migration File: $MIGRATION_FILE"
echo ""
echo "📄 Contents:"
echo "----------------------------------------"
head -20 "$MIGRATION_FILE"
echo "----------------------------------------"
echo ""

# Confirmation prompt
echo -e "${YELLOW}⚠️  About to apply this migration to the database${NC}"
read -p "Are you sure you want to continue? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "❌ Aborted by user"
  exit 0
fi

# Apply migration
echo ""
echo "🔧 Applying migration..."
export PGPASSWORD=postgres
docker exec -e PGPASSWORD=postgres supabase_db_api-dev psql \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "/dev/stdin" < "$MIGRATION_FILE"

echo -e "${GREEN}✅ Migration applied successfully${NC}"

# Move to applied directory
FILENAME=$(basename "$MIGRATION_FILE")
APPLIED_DIR="storage/migrations/applied"
mkdir -p "$APPLIED_DIR"

echo ""
echo "📦 Moving to applied directory..."
mv "$MIGRATION_FILE" "$APPLIED_DIR/$FILENAME"
echo -e "${GREEN}✅ Moved to: $APPLIED_DIR/$FILENAME${NC}"

# Suggest exporting snapshot
echo ""
echo -e "${YELLOW}📸 Next steps:${NC}"
echo "  1. Test that the migration worked correctly"
echo "  2. Export a new snapshot: npm run db:export-snapshot"
echo "  3. Share the updated snapshot with the team"
