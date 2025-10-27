#!/bin/bash
# Apply database snapshot (for interns)

set -e  # Exit on error

# Configuration
SNAPSHOT_DIR="${1:-storage/snapshots/latest}"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔄 Applying database snapshot from: $SNAPSHOT_DIR"
echo ""

# Check if snapshot exists
if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo -e "${RED}❌ Error: Snapshot directory not found: $SNAPSHOT_DIR${NC}"
  exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/schema.sql" ]; then
  echo -e "${RED}❌ Error: schema.sql not found in snapshot${NC}"
  exit 1
fi

if [ ! -f "$SNAPSHOT_DIR/seed.sql" ]; then
  echo -e "${RED}❌ Error: seed.sql not found in snapshot${NC}"
  exit 1
fi

# Display metadata if available
if [ -f "$SNAPSHOT_DIR/metadata.json" ]; then
  echo "📋 Snapshot Info:"
  cat "$SNAPSHOT_DIR/metadata.json" | grep -E "(timestamp|created_at)" || true
  echo ""
fi

# Confirmation prompt
echo -e "${YELLOW}⚠️  WARNING: This will REPLACE your current database schemas!${NC}"
echo -e "${YELLOW}   - All data in: public, n8n, company, observability will be DELETED${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
  echo "❌ Aborted by user"
  exit 0
fi

# Apply schema
echo ""
echo "🔧 Applying schema migration..."
export PGPASSWORD=postgres
psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$SNAPSHOT_DIR/schema.sql" \
  -v ON_ERROR_STOP=1

echo -e "${GREEN}✅ Schema applied successfully${NC}"

# Apply seed data
echo ""
echo "🌱 Applying seed data..."
psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$SNAPSHOT_DIR/seed.sql" \
  -v ON_ERROR_STOP=1

echo -e "${GREEN}✅ Seed data applied successfully${NC}"

# Success message
echo ""
echo -e "${GREEN}🎉 Database snapshot applied successfully!${NC}"
echo ""
echo "📊 Next steps:"
echo "  1. Verify your application is working correctly"
echo "  2. Run any additional setup scripts if needed"
echo "  3. Start developing!"
