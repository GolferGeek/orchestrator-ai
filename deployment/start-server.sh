#!/bin/bash

# Server Startup Script for Orchestrator AI
# This script starts everything needed after a server restart

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Orchestrator AI Server...${NC}"
echo "======================================"

# Change to project directory
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)
echo -e "${GREEN}✅ Working directory: $PROJECT_DIR${NC}"

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Step 1: Ensure Docker is running and start Supabase
echo -e "\n${BLUE}🐳 Checking Docker and Supabase...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo -e "${YELLOW}Starting Docker Desktop...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - start Docker Desktop
        open -a Docker
        echo "Waiting for Docker Desktop to start..."
        
        # Wait up to 60 seconds for Docker to be ready
        for i in {1..60}; do
            if docker info >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Docker is now running${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
        
        if ! docker info >/dev/null 2>&1; then
            echo -e "${RED}❌ Docker failed to start within 60 seconds${NC}"
            echo "Please start Docker Desktop manually and run this script again"
            exit 1
        fi
    else
        # Linux - try to start docker service
        echo "Attempting to start Docker service..."
        sudo systemctl start docker || {
            echo -e "${RED}❌ Failed to start Docker service${NC}"
            echo "Please start Docker manually and run this script again"
            exit 1
        }
        
        # Wait for Docker to be ready
        for i in {1..30}; do
            if docker info >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Docker is now running${NC}"
                break
            fi
            sleep 1
        done
    fi
else
    echo -e "${GREEN}✅ Docker is running${NC}"
fi

# Check if Supabase is running
if command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Checking Supabase status...${NC}"
    
    # Check if Supabase is already running
    if supabase status >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Supabase is already running${NC}"
        # Show brief status
        supabase status | grep -E "(API URL|DB URL|Studio URL)" || true
    else
        echo -e "${YELLOW}Starting Supabase local development...${NC}"
        supabase start
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Supabase started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start Supabase${NC}"
            echo "This may affect database functionality"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
    echo "Database functionality may be limited"
fi

# Step 2: Clean up any conflicting processes on production ports
echo -e "\n${BLUE}🧹 Checking for conflicting processes...${NC}"

# Kill anything on port 9000 that's not PM2
if check_port 9000; then
    PID_9000=$(lsof -ti:9000)
    if [ ! -z "$PID_9000" ]; then
        # Check if it's a PM2 process
        if ! ps aux | grep $PID_9000 | grep -q "PM2"; then
            echo -e "${YELLOW}Killing non-PM2 process on port 9000 (PID: $PID_9000)${NC}"
            kill -9 $PID_9000 2>/dev/null || true
            sleep 1
        fi
    fi
fi

# Kill anything on port 9001 that's not PM2
if check_port 9001; then
    PID_9001=$(lsof -ti:9001)
    if [ ! -z "$PID_9001" ]; then
        # Check if it's a PM2 process
        if ! ps aux | grep $PID_9001 | grep -q "PM2"; then
            echo -e "${YELLOW}Killing non-PM2 process on port 9001 (PID: $PID_9001)${NC}"
            kill -9 $PID_9001 2>/dev/null || true
            sleep 1
        fi
    fi
fi

# Step 3: Build API and web app with latest environment variables
echo -e "\n${BLUE}🔨 Building applications...${NC}"

# Build API from root (to pick up .env properly)
if [ -f "apps/api/package.json" ]; then
    echo -e "${YELLOW}Building API...${NC}"
    npm run build --workspace=apps/api
    echo -e "${GREEN}✅ API build completed${NC}"
else
    echo -e "${RED}❌ API package.json not found${NC}"
fi

# Build Web App from root (to pick up .env properly)
if [ -f "apps/web/package.json" ]; then
    echo -e "${YELLOW}Building web app with current environment variables...${NC}"
    # Load environment variables and build
    export $(grep -v '^#' .env | xargs)
    npm run build --workspace=apps/web
    echo -e "${GREEN}✅ Web app build completed${NC}"
else
    echo -e "${RED}❌ Web app package.json not found${NC}"
fi

# Step 4: Check and start PM2 processes
echo -e "\n${BLUE}📦 Checking PM2 processes...${NC}"
if command -v pm2 &> /dev/null; then
    # Check if PM2 daemon is running
    if ! pm2 list &> /dev/null; then
        echo -e "${YELLOW}Starting PM2 daemon...${NC}"
        pm2 resurrect || pm2 start ecosystem.config.js
    else
        # Check if our apps are running
        if pm2 list | grep -q "orchestrator-api.*online" && pm2 list | grep -q "orchestrator-web.*online"; then
            echo -e "${GREEN}✅ PM2 apps already running${NC}"
            pm2 list
        else
            echo -e "${YELLOW}Starting PM2 apps...${NC}"
            pm2 start ecosystem.config.js
            sleep 3
            pm2 list
        fi
    fi
else
    echo -e "${RED}❌ PM2 not installed! Please install with: npm install -g pm2${NC}"
    exit 1
fi

# Step 5: Verify services are accessible locally
echo -e "\n${BLUE}🔍 Verifying local services...${NC}"

# Check API on port 9000
if check_port 9000; then
    if curl -s http://localhost:9000/health | grep -q "healthy"; then
        echo -e "${GREEN}✅ API service healthy on port 9000${NC}"
    else
        echo -e "${YELLOW}⚠️  API running but health check failed${NC}"
    fi
else
    echo -e "${RED}❌ API not accessible on port 9000${NC}"
    echo "Restarting API..."
    pm2 restart orchestrator-api
    sleep 5
fi

# Check Web on port 9001
if check_port 9001; then
    echo -e "${GREEN}✅ Web service running on port 9001${NC}"
else
    echo -e "${RED}❌ Web not accessible on port 9001${NC}"
    echo "Restarting Web..."
    pm2 restart orchestrator-web
    sleep 5
fi

# Step 6: Check and start CloudFlare Tunnel
echo -e "\n${BLUE}🌐 Checking CloudFlare Tunnel...${NC}"

if command -v cloudflared &> /dev/null; then
    # Check if tunnel is already running
    if pgrep -f "cloudflared.*tunnel.*run" > /dev/null; then
        echo -e "${GREEN}✅ CloudFlare Tunnel already running${NC}"
        # Get tunnel info
        cloudflared tunnel info orchestrator-ai 2>/dev/null || true
    else
        echo -e "${YELLOW}Starting CloudFlare Tunnel...${NC}"
        
        # Check if running as a service
        if systemctl is-active --quiet cloudflared 2>/dev/null || launchctl list | grep -q cloudflared 2>/dev/null; then
            echo "Tunnel configured as system service"
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                sudo launchctl start com.cloudflare.cloudflared
            else
                # Linux
                sudo systemctl start cloudflared
            fi
        else
            # Start tunnel in background
            echo "Starting tunnel manually..."
            nohup cloudflared tunnel --config "$PROJECT_DIR/deployment/tunnel-config.yml" run > "$PROJECT_DIR/deployment/tunnel.log" 2>&1 &
            TUNNEL_PID=$!
            echo "Tunnel started with PID: $TUNNEL_PID"
            sleep 5
            
            # Verify tunnel is running
            if ps -p $TUNNEL_PID > /dev/null; then
                echo -e "${GREEN}✅ Tunnel started successfully${NC}"
            else
                echo -e "${RED}❌ Failed to start tunnel${NC}"
                echo "Check logs at: $PROJECT_DIR/deployment/tunnel.log"
            fi
        fi
    fi
else
    echo -e "${RED}❌ cloudflared not installed!${NC}"
    echo "Install with: brew install cloudflared (macOS) or see deployment/setup-cloudflare-tunnel.sh"
fi

# Step 7: Final status check
echo -e "\n${BLUE}📊 Final Status Check${NC}"
echo "======================================"

# PM2 Status
echo -e "\n${BLUE}PM2 Processes:${NC}"
pm2 list

# Supabase Status
echo -e "\n${BLUE}Supabase Status:${NC}"
if command -v supabase &> /dev/null && supabase status >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Supabase local development running${NC}"
    supabase status | grep -E "(API URL|DB URL|Studio URL)" | sed 's/^/  /'
else
    echo -e "${YELLOW}⚠️  Supabase not running or not installed${NC}"
fi

# Check external connectivity
echo -e "\n${BLUE}🌍 Testing External Access:${NC}"

# Test web app
if curl -s -o /dev/null -w "%{http_code}" https://app.orchestratorai.io | grep -q "200"; then
    echo -e "${GREEN}✅ Web app accessible at https://app.orchestratorai.io${NC}"
else
    echo -e "${YELLOW}⚠️  Web app not accessible externally (might need DNS propagation)${NC}"
fi

# Test API
if curl -s https://api.orchestratorai.io/health 2>/dev/null | grep -q "healthy"; then
    echo -e "${GREEN}✅ API accessible at https://api.orchestratorai.io${NC}"
else
    echo -e "${YELLOW}⚠️  API not accessible externally (might need DNS propagation)${NC}"
fi

echo -e "\n${GREEN}🎉 Server startup complete!${NC}"
echo "======================================"
echo -e "${BLUE}Useful commands:${NC}"
echo "  • View PM2 logs: pm2 logs"
echo "  • PM2 monitoring: pm2 monit"
echo "  • Restart services: pm2 restart all"
echo "  • Tunnel status: cloudflared tunnel info orchestrator-ai"
echo "  • Stop everything: npm run server:stop"
echo ""
echo -e "${BLUE}Your services:${NC}"
echo "  • Web App: https://app.orchestratorai.io"
echo "  • API: https://api.orchestratorai.io"
echo "  • Local Web: http://localhost:9001"
echo "  • Local API: http://localhost:9000"
if command -v supabase &> /dev/null && supabase status >/dev/null 2>&1; then
    echo "  • Supabase Studio: http://localhost:9012"
    echo "  • Supabase API: http://localhost:9010"
fi