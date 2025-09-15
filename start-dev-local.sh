#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Orchestrator AI Development Environment${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down services...${NC}"
    
    # Kill background processes
    if [ ! -z "$API_PID" ]; then
        echo -e "${RED}📦 Stopping API server...${NC}"
        kill $API_PID 2>/dev/null
        wait $API_PID 2>/dev/null
    fi
    
    if [ ! -z "$WEB_PID" ]; then
        echo -e "${RED}🌐 Stopping Web server...${NC}"
        kill $WEB_PID 2>/dev/null
        wait $WEB_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}🏁 Cleanup complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from dev.env.example...${NC}"
    if [ -f "dev.env.example" ]; then
        cp dev.env.example .env
        echo -e "${GREEN}✅ Created .env file from dev.env.example${NC}"
        echo -e "${YELLOW}📝 Please edit .env and add your API keys${NC}"
    else
        echo -e "${RED}❌ dev.env.example not found. Please create .env manually${NC}"
        exit 1
    fi
fi

# Load environment variables
echo -e "${BLUE}📄 Loading environment variables...${NC}"
set -a
source .env
set +a
echo -e "${GREEN}✅ Environment variables loaded${NC}"

# Check if ports are defined in .env
if [ -z "$API_PORT" ] || [ -z "$WEB_PORT" ]; then
    echo -e "${RED}❌ Error: API_PORT and WEB_PORT must be defined in .env file${NC}"
    echo -e "${YELLOW}Please add the following to your .env file:${NC}"
    echo -e "${YELLOW}API_PORT=9000${NC}"
    echo -e "${YELLOW}WEB_PORT=9001${NC}"
    exit 1
fi

# Set terminal title with port number
echo -e "\033]0;Orch-port-${API_PORT}\007"

echo -e "${BLUE}   API Port: ${API_PORT}${NC}"
echo -e "${BLUE}   Web Port: ${WEB_PORT}${NC}"
echo -e "${BLUE}   Supabase: Local instance${NC}"

# Check if Supabase is running
echo -e "${BLUE}🗄️  Checking Supabase status...${NC}"
cd apps/api
if ! supabase status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Supabase not running. Starting...${NC}"
    supabase start
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Supabase${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Supabase is already running${NC}"
fi

# Start API server
echo -e "${BLUE}🔥 Starting API server on port ${API_PORT}...${NC}"
PORT=${API_PORT} npm run start:dev &
API_PID=$!

# Wait a moment for API to start
sleep 3

# Go back to root and start web server
cd ../../apps/web
echo -e "${BLUE}🌐 Starting Web server on port ${WEB_PORT}...${NC}"
PORT=${WEB_PORT} npm run dev:http &
WEB_PID=$!

# Wait a moment for web server to start
sleep 3

echo -e "${GREEN}✅ Development environment ready!${NC}"
echo -e "${BLUE}📡 API Server: http://localhost:${API_PORT}${NC}"
echo -e "${BLUE}🌐 Web App: http://localhost:${WEB_PORT}${NC}"
echo -e "${BLUE}🗄️  Supabase Studio: http://127.0.0.1:54323${NC}"
echo -e "${BLUE}📧 Inbucket (Email): http://127.0.0.1:54324${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for processes to finish
wait $API_PID $WEB_PID

# If we get here, one of the processes exited
cleanup
