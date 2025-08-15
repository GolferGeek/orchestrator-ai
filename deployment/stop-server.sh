#!/bin/bash

# Server Stop Script for Orchestrator AI
# This script stops all running services

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping Orchestrator AI Server...${NC}"
echo "======================================"

# Step 1: Stop PM2 processes
echo -e "\n${BLUE}Stopping PM2 processes...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 stop all 2>/dev/null || echo "No PM2 processes to stop"
    pm2 list
    echo -e "${GREEN}✅ PM2 processes stopped${NC}"
else
    echo -e "${YELLOW}PM2 not found${NC}"
fi

# Step 2: Stop CloudFlare Tunnel
echo -e "\n${BLUE}Stopping CloudFlare Tunnel...${NC}"

# Kill any running cloudflared processes
if pgrep -f "cloudflared.*tunnel.*run" > /dev/null; then
    pkill -f "cloudflared.*tunnel.*run"
    echo -e "${GREEN}✅ CloudFlare Tunnel stopped${NC}"
else
    echo -e "${YELLOW}No tunnel process found${NC}"
fi

# Check if running as service
if systemctl is-active --quiet cloudflared 2>/dev/null; then
    echo "Stopping cloudflared service..."
    sudo systemctl stop cloudflared
elif launchctl list | grep -q cloudflared 2>/dev/null; then
    echo "Stopping cloudflared service..."
    sudo launchctl stop com.cloudflare.cloudflared
fi

echo -e "\n${GREEN}✅ All services stopped${NC}"
echo "======================================"
echo "To restart, run: npm run server:start"