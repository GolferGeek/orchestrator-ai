#!/bin/bash

# Nginx Setup Script for Production
# This script configures nginx for the production deployment

set -e

echo "🔧 Setting up Nginx for Orchestrator AI..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
    NGINX_MAIN_CONF="/usr/local/etc/nginx/nginx.conf"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    NGINX_CONF_DIR="/etc/nginx/sites-available"
    NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    NGINX_MAIN_CONF="/etc/nginx/nginx.conf"
else
    print_error "Unsupported operating system"
    exit 1
fi

print_info "Detected OS: $OS"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    print_error "Nginx is not installed"
    
    if [[ "$OS" == "macos" ]]; then
        print_info "Install nginx with: brew install nginx"
    else
        print_info "Install nginx with: sudo apt-get install nginx"
    fi
    exit 1
fi

print_status "Nginx is installed"

# For macOS
if [[ "$OS" == "macos" ]]; then
    print_info "Setting up Nginx configuration for macOS..."
    
    # Create servers directory if it doesn't exist
    if [ ! -d "$NGINX_CONF_DIR" ]; then
        print_info "Creating nginx servers directory..."
        mkdir -p "$NGINX_CONF_DIR"
    fi
    
    # Copy configuration
    cp deployment/nginx/orchestratorai-production.conf "$NGINX_CONF_DIR/orchestratorai.conf"
    print_status "Configuration copied to $NGINX_CONF_DIR/orchestratorai.conf"
    
    # Check if include statement exists in main config
    if ! grep -q "include.*servers/\*" "$NGINX_MAIN_CONF"; then
        print_warning "You may need to add 'include servers/*;' to the http block in $NGINX_MAIN_CONF"
    fi
    
    # Test configuration
    print_info "Testing nginx configuration..."
    nginx -t
    
    # Reload nginx
    print_info "Reloading nginx..."
    nginx -s reload || brew services restart nginx
    
# For Linux
else
    print_info "Setting up Nginx configuration for Linux..."
    
    # Copy configuration
    sudo cp deployment/nginx/orchestratorai-production.conf "$NGINX_CONF_DIR/orchestratorai"
    print_status "Configuration copied to $NGINX_CONF_DIR/orchestratorai"
    
    # Create symbolic link in sites-enabled
    if [ -d "$NGINX_ENABLED_DIR" ]; then
        sudo ln -sf "$NGINX_CONF_DIR/orchestratorai" "$NGINX_ENABLED_DIR/orchestratorai"
        print_status "Symbolic link created in sites-enabled"
        
        # Remove default site if it exists
        if [ -L "$NGINX_ENABLED_DIR/default" ]; then
            print_info "Removing default nginx site..."
            sudo rm "$NGINX_ENABLED_DIR/default"
        fi
    fi
    
    # Test configuration
    print_info "Testing nginx configuration..."
    sudo nginx -t
    
    # Reload nginx
    print_info "Reloading nginx..."
    sudo systemctl reload nginx || sudo service nginx reload
fi

print_status "Nginx setup complete!"
echo ""
print_info "Nginx is configured to:"
echo "  • Proxy api.orchestratorai.io → localhost:9000 (API)"
echo "  • Proxy app.orchestratorai.io → localhost:9001 (Web)"
echo ""
print_info "Make sure your DNS points:"
echo "  • api.orchestratorai.io → your server IP"
echo "  • app.orchestratorai.io → your server IP"
echo ""
print_info "Next steps:"
echo "  1. Ensure PM2 apps are running: pm2 status"
echo "  2. Check nginx status: nginx -t"
echo "  3. View nginx logs: tail -f /var/log/nginx/*.log"