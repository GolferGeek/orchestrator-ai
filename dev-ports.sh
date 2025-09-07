#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Orchestrator AI Development Ports${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "${GREEN}📱 Application Ports:${NC}"
echo -e "   API Server:     http://localhost:7100"
echo -e "   Web App:        http://localhost:7101"
echo ""
echo -e "${GREEN}🗄️  Supabase Local Ports:${NC}"
echo -e "   API/REST:       http://127.0.0.1:54321"
echo -e "   Database:       postgresql://postgres:postgres@127.0.0.1:54322/postgres"
echo -e "   Studio:         http://127.0.0.1:54323"
echo -e "   Email Testing:  http://127.0.0.1:54324"
echo ""
echo -e "${YELLOW}💡 Quick Commands:${NC}"
echo -e "   Check Supabase:  cd apps/api && supabase status"
echo -e "   Start All:       ./start-dev-local.sh"
echo -e "   Show Ports:      ./dev-ports.sh"
echo ""

# Check if services are running
echo -e "${BLUE}🔍 Service Status:${NC}"

# Check API
if curl -s http://localhost:7100/health > /dev/null 2>&1; then
    echo -e "   API (7100):     ${GREEN}✅ Running${NC}"
else
    echo -e "   API (7100):     ${YELLOW}❌ Not Running${NC}"
fi

# Check Web
if curl -s http://localhost:7101 > /dev/null 2>&1; then
    echo -e "   Web (7101):     ${GREEN}✅ Running${NC}"
else
    echo -e "   Web (7101):     ${YELLOW}❌ Not Running${NC}"
fi

# Check Supabase
if curl -s http://127.0.0.1:54321/health > /dev/null 2>&1; then
    echo -e "   Supabase:       ${GREEN}✅ Running${NC}"
else
    echo -e "   Supabase:       ${YELLOW}❌ Not Running${NC}"
fi

echo ""

