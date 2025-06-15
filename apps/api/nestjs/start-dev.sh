#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting OrchAI NestJS API with Python Agent Support${NC}"

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

# Verify LangGraph is available
if python -c "from langgraph.graph import StateGraph" 2>/dev/null; then
    echo -e "${GREEN}✅ LangGraph dependencies verified${NC}"
else
    echo -e "${RED}❌ LangGraph not available. Running 'pdm install'...${NC}"
    pdm install
fi

# Start NestJS development server in background
echo -e "${BLUE}🔥 Starting NestJS development server...${NC}"
pnpm run start:dev &
NESTJS_PID=$!

# Wait a moment for NestJS to start
sleep 2

echo -e "${GREEN}✅ Development environment ready!${NC}"
echo -e "${BLUE}📡 NestJS API: http://localhost:3000${NC}"
echo -e "${BLUE}🐍 Python Virtual Environment: Active${NC}"
echo -e "${BLUE}🔧 LangGraph: Available for Python agents${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for NestJS process to finish
wait $NESTJS_PID

# If we get here, NestJS exited normally
cleanup 