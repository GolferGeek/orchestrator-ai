#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 Testing n8n API Connection...${NC}"

# Check if n8n is running
if ! curl -s http://localhost:5678/healthz > /dev/null; then
  echo -e "${RED}❌ n8n is not running on port 5678${NC}"
  echo -e "${YELLOW}Start n8n with: npm run n8n:up${NC}"
  exit 1
fi

echo -e "${GREEN}✅ n8n is running${NC}"

# Test API access
echo -e "${BLUE}🔑 Testing API access...${NC}"

if [ -z "$N8N_API_KEY" ]; then
  echo -e "${YELLOW}⚠️  N8N_API_KEY environment variable not set${NC}"
  echo ""
  echo "To get your API key:"
  echo "1. Open http://localhost:5678"
  echo "2. Go to Settings → API"
  echo "3. Create a new API key"
  echo "4. Export it: export N8N_API_KEY=your-key-here"
  echo "5. Run this script again"
  exit 1
fi

# Test API call
RESPONSE=$(curl -s -w "%{http_code}" -H "X-N8N-API-KEY: $N8N_API_KEY" http://localhost:5678/api/v1/workflows)
HTTP_CODE="${RESPONSE: -3}"
BODY="${RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ API key is valid${NC}"
  WORKFLOW_COUNT=$(echo "$BODY" | jq -r '.data | length' 2>/dev/null || echo "unknown")
  echo -e "${BLUE}📊 Found $WORKFLOW_COUNT workflows${NC}"
else
  echo -e "${RED}❌ API key is invalid (HTTP $HTTP_CODE)${NC}"
  echo "Response: $BODY"
  exit 1
fi

# Test Supabase connection
echo -e "${BLUE}🗄️  Testing Supabase connection...${NC}"

if ! curl -s http://127.0.0.1:7010/health > /dev/null; then
  echo -e "${RED}❌ Supabase is not running on port 7010${NC}"
  echo -e "${YELLOW}Start Supabase with: npm run dev:supabase:start${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Supabase is running${NC}"

# Test database connection
DB_URL="postgresql://postgres:postgres@127.0.0.1:7012/postgres"
if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Database connection successful${NC}"
else
  echo -e "${RED}❌ Database connection failed${NC}"
  exit 1
fi

# Test n8n schema
if psql "$DB_URL" -c "\dt n8n.*" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ n8n schema exists${NC}"
  WORKFLOW_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM n8n.n8n_workflows;" 2>/dev/null | xargs || echo "0")
  echo -e "${BLUE}📊 Found $WORKFLOW_COUNT workflows in database${NC}"
else
  echo -e "${YELLOW}⚠️  n8n schema not found${NC}"
  echo -e "${BLUE}Run migrations: npm run n8n:migrate-up${NC}"
fi

echo ""
echo -e "${GREEN}🎉 All connections are working!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update .cursor/mcp.json with your N8N_API_KEY"
echo "2. Restart Cursor to reload MCP configuration"
echo "3. Test AI workflow creation with n8n MCP"
