#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Orchestrator-AI Development Environment${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down development environment...${NC}"
    
    # Kill background processes
    if [ ! -z "$API_PID" ]; then
        echo -e "${RED}📦 Stopping API server...${NC}"
        kill $API_PID 2>/dev/null
        wait $API_PID 2>/dev/null
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        echo -e "${RED}🌐 Stopping web server...${NC}"
        kill $WEB_PID 2>/dev/null
        wait $WEB_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ Development environment stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from template...${NC}"
    cp templates/.env.development.template .env
    echo -e "${YELLOW}📝 Please edit .env with your API keys and configuration${NC}"
    echo -e "${YELLOW}   Required: ANTHROPIC_API_KEY${NC}"
    read -p "Press Enter to continue after editing .env..."
fi

# Load environment variables
if [ -f ".env" ]; then
    echo -e "${BLUE}📄 Loading environment variables...${NC}"
    set -a
    source .env
    set +a
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
fi

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your-anthropic-api-key" ]; then
    echo -e "${RED}❌ ANTHROPIC_API_KEY not set. Please update your .env file.${NC}"
    exit 1
fi

# Start Docker services
echo -e "${BLUE}🐳 Starting Docker services (Supabase + Ollama)...${NC}"
docker-compose -f docker/development/supabase.yml up -d

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 15

# Check if Supabase is ready
echo -e "${BLUE}🔍 Checking Supabase health...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Supabase is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Supabase failed to start${NC}"
        docker-compose -f docker/development/supabase.yml logs
        exit 1
    fi
    sleep 2
done

# Check if Ollama is ready
echo -e "${BLUE}🔍 Checking Ollama health...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Ollama is ready${NC}"
    # List available models
    echo -e "${BLUE}🤖 Available models:${NC}"
    curl -s http://localhost:11434/api/tags | jq -r '.models[]?.name' || echo "No models found"
else
    echo -e "${YELLOW}⚠️  Ollama not accessible (this is OK if running externally)${NC}"
fi

# Start API server in background
echo -e "${BLUE}🔥 Starting NestJS API server...${NC}"
cd apps/api
npm run start:dev &
API_PID=$!
cd ../..

# Wait for API to start
sleep 5

# Start Web server in background
echo -e "${BLUE}🌐 Starting Vue web application...${NC}"
cd apps/web
npm run dev &
WEB_PID=$!
cd ../..

# Wait for web server to start
sleep 5

# Display status
echo -e "${GREEN}✅ Development environment ready!${NC}"
echo -e "${BLUE}📡 API Server: http://localhost:${API_PORT:-4000}${NC}"
echo -e "${BLUE}🌐 Web App: http://localhost:${WEB_PORT:-3000}${NC}"
echo -e "${BLUE}🗄️  Supabase: http://localhost:8000${NC}"
echo -e "${BLUE}🤖 Ollama: http://localhost:11434${NC}"

# Show database information
echo -e "\n${BLUE}🗃️  Available Databases:${NC}"
echo -e "   • orchestrator_ai (main development)"
echo -e "   • hierarchy_ai (your other project)"  
echo -e "   • client_demo_legal (legal industry demo)"
echo -e "   • client_demo_marketing (marketing industry demo)"
echo -e "\n${BLUE}Current database: ${SUPABASE_LOCAL_DB:-orchestrator_ai}${NC}"

echo -e "\n${BLUE}🛠️  Development Commands:${NC}"
echo -e "   • Switch database: export SUPABASE_LOCAL_DB=hierarchy_ai && restart"
echo -e "   • View logs: docker-compose -f docker/development/supabase.yml logs"
echo -e "   • Restart services: docker-compose -f docker/development/supabase.yml restart"

echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep the script running and wait for processes
wait $API_PID $WEB_PID