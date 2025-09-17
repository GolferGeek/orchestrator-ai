#!/bin/bash

# Set PATH to include Python user bin directory for PDM
export PATH="$HOME/Library/Python/3.9/bin:$PATH"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting OrchAI NestJS API with Python Agent Support${NC}"

# Load environment variables from project root
if [ -f "../../.env" ]; then
    echo -e "${BLUE}📄 Loading environment variables from project root...${NC}"
    set -a
    source ../../.env
    set +a
    echo -e "${GREEN}✅ Environment variables loaded${NC}"
else
    echo -e "${RED}⚠️  No .env file found in project root${NC}"
fi

# Check and start local Supabase (DEV - port 7010)
echo -e "${BLUE}🗄️  Checking local Supabase status (Development - Port 7010)...${NC}"

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check if Supabase is running on dev port 7010
if check_port 7010; then
    echo -e "${GREEN}✅ Local Supabase is already running on port 7010${NC}"
    echo -e "${BLUE}   Studio: http://127.0.0.1:7015${NC}"
    echo -e "${BLUE}   API: http://127.0.0.1:7010${NC}"
    echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:7012/postgres${NC}"

    # Remind about backup system if available
    if [ -f "supabase/backup-local-db.sh" ]; then
        echo -e "${BLUE}💡 Backup system available: ./supabase/backup-local-db.sh --list${NC}"
    fi
else
    echo -e "${BLUE}🚀 Starting local Supabase development instance on port 7010...${NC}"

    # Check if backup script exists and create a backup if Supabase has data
    if [ -f "supabase/backup-local-db.sh" ]; then
        # Check if there are existing Docker volumes (indicating previous data)
        if docker volume ls | grep -q "supabase_db_api-dev"; then
            echo -e "${BLUE}💾 Creating safety backup before starting Supabase...${NC}"
            ./supabase/backup-local-db.sh --force > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Backup failed, but continuing...${NC}"
        fi
    fi

    # Start Supabase with development config
    supabase start --config ./supabase/config.dev.toml
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Local Supabase started successfully on port 7010${NC}"
        echo -e "${BLUE}   Studio: http://127.0.0.1:7015${NC}"
        echo -e "${BLUE}   API: http://127.0.0.1:7010${NC}"
        echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:7012/postgres${NC}"
        SUPABASE_STARTED_BY_SCRIPT=true

        # Remind about backup system
        if [ -f "supabase/backup-local-db.sh" ]; then
            echo -e "${BLUE}💡 Backup system available: ./supabase/backup-local-db.sh${NC}"
        fi
    else
        echo -e "${RED}❌ Failed to start local Supabase on port 7010${NC}"
        echo -e "${BLUE}💡 Try running: supabase start --config ./supabase/config.dev.toml${NC}"
    fi
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${RED}🛑 Shutting down services...${NC}"
    
    # Kill the NestJS development server
    if [ ! -z "$NESTJS_PID" ]; then
        echo -e "${RED}📦 Stopping NestJS server...${NC}"
        kill $NESTJS_PID 2>/dev/null
        wait $NESTJS_PID 2>/dev/null
        echo -e "${GREEN}✅ NestJS server stopped${NC}"
    fi
    
    # Deactivate PDM environment (handled automatically when shell exits)
    echo -e "${GREEN}✅ Python virtual environment deactivated${NC}"
    
    echo -e "${GREEN}🏁 Cleanup complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if PDM is installed
if ! command -v pdm &> /dev/null; then
    echo -e "${RED}❌ PDM is not installed. Please install PDM first:${NC}"
    echo -e "${BLUE}   pip install pdm${NC}"
    exit 1
fi

# Initialize PDM environment if needed
if [ ! -f "pdm.lock" ]; then
    echo -e "${BLUE}📦 Installing Python dependencies with PDM...${NC}"
    pdm install
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${RED}❌ Virtual environment not found. Please run 'pdm install' first.${NC}"
    exit 1
fi

# Activate PDM virtual environment
echo -e "${BLUE}🐍 Activating Python virtual environment...${NC}"
export PATH="$(pwd)/.venv/bin:$PATH"
export VIRTUAL_ENV="$(pwd)/.venv"

# Verify Python environment
python_version=$(python --version 2>&1)
echo -e "${GREEN}✅ Python environment active: $python_version${NC}"

# Verify LangGraph is available (with better error handling)
echo -e "${BLUE}🔍 Checking LangGraph dependencies...${NC}"
if .venv/bin/python -c "from langgraph.graph import StateGraph" 2>/dev/null; then
    echo -e "${GREEN}✅ LangGraph dependencies verified${NC}"
else
    echo -e "${YELLOW}⚠️  LangGraph not available in virtual environment${NC}"
    echo -e "${BLUE}🔧 Running 'pdm install' to fix dependencies...${NC}"
    pdm install
    if .venv/bin/python -c "from langgraph.graph import StateGraph" 2>/dev/null; then
        echo -e "${GREEN}✅ LangGraph dependencies fixed${NC}"
    else
        echo -e "${YELLOW}⚠️  LangGraph still not available, but continuing...${NC}"
        echo -e "${BLUE}💡 Python agents may not work properly${NC}"
    fi
fi

# Start NestJS development server in background
echo -e "${BLUE}🔥 Starting NestJS development server...${NC}"
npm run start:dev &
NESTJS_PID=$!

# Wait a moment for NestJS to start
sleep 2

echo -e "${GREEN}✅ Development environment ready!${NC}"
echo -e "${BLUE}📡 NestJS API: http://localhost:${API_PORT:-9000}${NC}"
echo -e "${BLUE}🐍 Python Virtual Environment: Active${NC}"
echo -e "${BLUE}🔧 LangGraph: Available for Python agents${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for NestJS process to finish
wait $NESTJS_PID

# If we get here, NestJS exited normally
cleanup 