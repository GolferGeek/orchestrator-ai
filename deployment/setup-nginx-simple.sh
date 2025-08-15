#!/bin/bash

# Simple nginx setup for CloudFlare proxy
echo "🔧 Setting up nginx for CloudFlare proxy..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}This script will set up nginx to listen on port 80${NC}"
echo -e "${BLUE}CloudFlare will handle HTTPS and proxy to your server on port 80${NC}"
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    NGINX_CONF_DIR="/opt/homebrew/etc/nginx/servers"
    NGINX_SERVICE="brew services restart nginx"
    
    # Create servers directory if it doesn't exist
    mkdir -p "$NGINX_CONF_DIR"
    
    # Copy configuration
    cp deployment/nginx/orchestratorai-simple.conf "$NGINX_CONF_DIR/orchestratorai.conf"
    
    echo -e "${GREEN}✅ Configuration copied to $NGINX_CONF_DIR/orchestratorai.conf${NC}"
    
    # Test configuration
    echo -e "${BLUE}Testing nginx configuration...${NC}"
    nginx -t
    
    # Restart nginx
    echo -e "${BLUE}Restarting nginx...${NC}"
    brew services restart nginx
    
else
    # Linux
    NGINX_CONF_DIR="/etc/nginx/sites-available"
    NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    
    echo -e "${YELLOW}For Linux, run these commands with sudo:${NC}"
    echo ""
    echo "sudo cp deployment/nginx/orchestratorai-simple.conf $NGINX_CONF_DIR/orchestratorai"
    echo "sudo ln -sf $NGINX_CONF_DIR/orchestratorai $NGINX_ENABLED_DIR/orchestratorai"
    echo "sudo rm -f $NGINX_ENABLED_DIR/default"
    echo "sudo nginx -t"
    echo "sudo systemctl restart nginx"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${BLUE}Your services will be accessible via:${NC}"
echo "  • https://app.orchestratorai.io (CloudFlare HTTPS → nginx:80 → localhost:9001)"
echo "  • https://api.orchestratorai.io (CloudFlare HTTPS → nginx:80 → localhost:9000)"
echo ""
echo -e "${YELLOW}Make sure:${NC}"
echo "  1. CloudFlare SSL/TLS is set to 'Flexible' mode"
echo "  2. Port 80 is open on your firewall/router"
echo "  3. Your DNS records in CloudFlare are proxied (orange cloud)"