#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Running n8n workflow migrations...${NC}"

# Detect environment
if [ -f "../../.env" ]; then
  source ../../.env
fi

# Determine Supabase connection
if [ -z "$DATABASE_URL" ]; then
  # Default to local Supabase
  DB_URL="postgresql://postgres:postgres@127.0.0.1:7012/postgres"
  echo -e "${BLUE}📍 Using local Supabase${NC}"
else
  DB_URL="$DATABASE_URL"
  echo -e "${BLUE}📍 Using environment DATABASE_URL${NC}"
fi

# Run migrations using Supabase CLI
cd ../../apps/api

if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ Error: npx not found. Please install Node.js${NC}"
  exit 1
fi

# Apply migrations
if npx supabase migration up 2>&1; then
  echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
  echo -e "${RED}❌ Migration failed${NC}"
  exit 1
fi

# Show migration status
echo -e "${BLUE}📊 Current migration status:${NC}"
psql "$DB_URL" -c "SELECT version, name FROM supabase_migrations ORDER BY version DESC LIMIT 5;" 2>/dev/null || echo "Could not query migration status"

echo -e "${GREEN}✅ n8n migration check complete${NC}"
