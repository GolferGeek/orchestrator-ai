#!/bin/bash

# Server Startup Script for Orchestrator AI
# This script starts everything needed after a server restart
# Usage: ./start-server.sh [production]

set -e

# Check if running in production mode
IS_PRODUCTION=false
if [ "$1" = "production" ]; then
    IS_PRODUCTION=true
    echo "Starting in PRODUCTION mode"
else
    echo "Starting in DEVELOPMENT mode"
fi

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

    # Determine which port to use based on mode
    if [ "$IS_PRODUCTION" = true ]; then
        SUPABASE_PORT=9010
        SUPABASE_DB_PORT=9012
        SUPABASE_STUDIO_PORT=9015
        SUPABASE_CONFIG="$PROJECT_DIR/apps/api/supabase/config.production.toml"
        echo -e "${BLUE}Using production Supabase configuration (port 9010)${NC}"
    else
        SUPABASE_PORT=7010
        SUPABASE_DB_PORT=7012
        SUPABASE_STUDIO_PORT=7015
        SUPABASE_CONFIG="$PROJECT_DIR/apps/api/supabase/config.dev.toml"
        echo -e "${BLUE}Using development Supabase configuration (port 7010)${NC}"
    fi

    # Check if Supabase ports are already in use (indicating it's running)
    SUPABASE_RUNNING=false

    if check_port $SUPABASE_PORT && check_port $SUPABASE_DB_PORT; then
        echo -e "${GREEN}✅ Supabase appears to be running on port $SUPABASE_PORT${NC}"
        echo -e "${BLUE}   API: http://127.0.0.1:$SUPABASE_PORT${NC}"
        echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:$SUPABASE_DB_PORT/postgres${NC}"
        echo -e "${BLUE}   Studio: http://127.0.0.1:$SUPABASE_STUDIO_PORT${NC}"
        SUPABASE_RUNNING=true
    fi

    # If Supabase doesn't appear to be running, try to start it
    if [ "$SUPABASE_RUNNING" = false ]; then
        echo -e "${YELLOW}Starting Supabase on port $SUPABASE_PORT...${NC}"

        # Navigate to API directory where Supabase is configured
        cd "$PROJECT_DIR/apps/api"

        # Try to start Supabase with appropriate config
        if supabase start --config "$SUPABASE_CONFIG" 2>&1 | tee /tmp/supabase_start.log; then
            echo -e "${GREEN}✅ Supabase started successfully on port $SUPABASE_PORT${NC}"
            echo -e "${BLUE}   API: http://127.0.0.1:$SUPABASE_PORT${NC}"
            echo -e "${BLUE}   Database: postgres://postgres:postgres@127.0.0.1:$SUPABASE_DB_PORT/postgres${NC}"
            echo -e "${BLUE}   Studio: http://127.0.0.1:$SUPABASE_STUDIO_PORT${NC}"
        else
            # Check if the error was due to port conflicts
            if grep -q "port is already allocated" /tmp/supabase_start.log; then
                echo -e "${YELLOW}⚠️  Port conflict detected - Supabase may already be running elsewhere${NC}"
                echo -e "${YELLOW}This is normal if you have multiple instances running${NC}"

                # Check if ports are now available
                if check_port $SUPABASE_PORT && check_port $SUPABASE_DB_PORT; then
                    echo -e "${GREEN}✅ Supabase ports are active, continuing...${NC}"
                else
                    echo -e "${RED}❌ Failed to start Supabase and ports not available${NC}"
                    echo "This may affect database functionality"
                fi
            else
                echo -e "${RED}❌ Failed to start Supabase for unknown reason${NC}"
                echo "This may affect database functionality"
                echo "Check the log above for details"
            fi
        fi

        # Return to project directory
        cd "$PROJECT_DIR"

        # Clean up temp log
        rm -f /tmp/supabase_start.log
    fi
else
    echo -e "${YELLOW}⚠️  Supabase CLI not installed${NC}"
    echo "Database functionality may be limited"
fi

# Step 2: Start n8n instance
echo -e "\n${BLUE}🤖 Checking n8n instance...${NC}"

    # Check if n8n is already running
    if check_port 5678; then
        echo -e "${GREEN}✅ n8n instance already running on port 5678${NC}"
        echo -e "${BLUE}   Access: http://localhost:5678${NC}"
    else
        echo -e "${YELLOW}Starting n8n instance on port 5678...${NC}"

        # Start n8n using the manage script
        if ./apps/n8n/manage.sh up >/dev/null 2>&1; then
            echo -e "${GREEN}✅ n8n instance started successfully${NC}"
            echo -e "${BLUE}   Access: http://localhost:5678${NC}"
        else
            echo -e "${YELLOW}⚠️  Failed to start n8n instance${NC}"
            echo -e "${BLUE}💡 You can start it manually with: ./apps/n8n/manage.sh up${NC}"
            echo "Workflow automation may be limited"
        fi
    fi

# Step 3: Clean up any conflicting processes on production ports
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

# Step 4: Build shared transport types
echo -e "\n${BLUE}📦 Building shared transport types...${NC}"
if npm run build:transport-types; then
    echo -e "${GREEN}✅ Transport types built${NC}"
else
    echo -e "${RED}❌ Failed to build transport types${NC}"
    exit 1
fi

# Step 5: Build API and web app with latest environment variables
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
    if [ "$IS_PRODUCTION" = true ]; then
        export $(grep -v '^#' .env.production | xargs)
    else
        export $(grep -v '^#' .env | xargs)
    fi
    npm run build --workspace=apps/web
    echo -e "${GREEN}✅ Web app build completed${NC}"
else
    echo -e "${RED}❌ Web app package.json not found${NC}"
fi

# Step 6: Check and start PM2 processes
echo -e "\n${BLUE}📦 Checking PM2 processes...${NC}"
if command -v pm2 &> /dev/null; then
    # Select the appropriate ecosystem config
    if [ "$IS_PRODUCTION" = true ]; then
        ECOSYSTEM_CONFIG="ecosystem.production.config.js"
    else
        ECOSYSTEM_CONFIG="ecosystem.config.js"
    fi

    echo -e "${YELLOW}Using config: $ECOSYSTEM_CONFIG${NC}"

    # Check if PM2 daemon is running
    if ! pm2 list &> /dev/null; then
        echo -e "${YELLOW}Starting PM2 daemon...${NC}"
        pm2 resurrect || pm2 start $ECOSYSTEM_CONFIG
    else
        # Check if our apps are running
        if pm2 list | grep -q "orchestrator-api.*online" && pm2 list | grep -q "orchestrator-web.*online"; then
            echo -e "${GREEN}✅ PM2 apps already running${NC}"
            pm2 list
        else
            echo -e "${YELLOW}Starting PM2 apps...${NC}"
            pm2 start $ECOSYSTEM_CONFIG
            sleep 3
            pm2 list
        fi
    fi
else
    echo -e "${RED}❌ PM2 not installed! Please install with: npm install -g pm2${NC}"
    exit 1
fi

# Step 7: Verify services are accessible locally
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

# Step 8: Check and start CloudFlare Tunnel
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

# Step 9: Final status check
echo -e "\n${BLUE}📊 Final Status Check${NC}"
echo "======================================"

# PM2 Status
echo -e "\n${BLUE}PM2 Processes:${NC}"
pm2 list

# Supabase Status
echo -e "\n${BLUE}Supabase Status:${NC}"
if [ "$IS_PRODUCTION" = true ]; then
    if check_port 9010 && check_port 9012; then
        echo -e "${GREEN}✅ Production Supabase running${NC}"
        echo -e "  API URL: http://127.0.0.1:9010"
        echo -e "  DB URL: postgres://postgres:postgres@127.0.0.1:9012/postgres"
        echo -e "  Studio URL: http://127.0.0.1:9015"
    else
        echo -e "${YELLOW}⚠️  Production Supabase not running${NC}"
    fi
else
    if check_port 7010 && check_port 7012; then
        echo -e "${GREEN}✅ Development Supabase running${NC}"
        echo -e "  API URL: http://127.0.0.1:7010"
        echo -e "  DB URL: postgres://postgres:postgres@127.0.0.1:7012/postgres"
        echo -e "  Studio URL: http://127.0.0.1:7015"
    else
        echo -e "${YELLOW}⚠️  Development Supabase not running${NC}"
    fi
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
    echo "  • Supabase Studio: http://localhost:55323"
    echo "  • Supabase API: http://localhost:55321"
fi
