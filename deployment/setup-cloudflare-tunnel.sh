#!/bin/bash

# CloudFlare Tunnel Setup Script
# This sets up a secure tunnel without needing to open any ports

set -e

echo "🚀 Setting up CloudFlare Tunnel for Orchestrator AI"
echo "======================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Step 1: Install cloudflared
install_cloudflared() {
    print_info "Installing CloudFlare Tunnel client (cloudflared)..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install cloudflared || brew upgrade cloudflared
            print_status "cloudflared installed via Homebrew"
        else
            print_info "Installing cloudflared directly..."
            curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz | tar -xz
            sudo mv cloudflared /usr/local/bin/
            sudo chmod +x /usr/local/bin/cloudflared
            print_status "cloudflared installed"
        fi
    else
        # Linux
        print_info "Installing cloudflared for Linux..."
        wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
        sudo dpkg -i cloudflared-linux-amd64.deb
        rm cloudflared-linux-amd64.deb
        print_status "cloudflared installed"
    fi
}

# Step 2: Check if cloudflared is installed
check_cloudflared() {
    if command -v cloudflared &> /dev/null; then
        print_status "cloudflared is available"
        cloudflared --version
        return 0
    else
        return 1
    fi
}

# Step 3: Login to CloudFlare
login_cloudflare() {
    print_info "Logging in to CloudFlare..."
    print_warning "This will open a browser window. Please authorize the connection."
    cloudflared tunnel login
    print_status "Logged in to CloudFlare"
}

# Step 4: Create tunnel
create_tunnel() {
    TUNNEL_NAME="orchestrator-ai"
    
    print_info "Creating CloudFlare Tunnel: $TUNNEL_NAME"
    
    # Check if tunnel already exists
    if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        print_warning "Tunnel '$TUNNEL_NAME' already exists"
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    else
        cloudflared tunnel create $TUNNEL_NAME
        TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
        print_status "Tunnel created with ID: $TUNNEL_ID"
    fi
    
    echo "$TUNNEL_ID" > deployment/tunnel-id.txt
}

# Step 5: Create configuration file
create_config() {
    print_info "Creating tunnel configuration..."
    
    TUNNEL_ID=$(cat deployment/tunnel-id.txt)
    
    cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  # API Service
  - hostname: api.orchestratorai.io
    service: http://localhost:9000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      # WebSocket support
      httpHostHeader: api.orchestratorai.io
      originServerName: api.orchestratorai.io
      
  # Web App
  - hostname: app.orchestratorai.io
    service: http://localhost:9001
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      # WebSocket support for Vite HMR in dev
      httpHostHeader: app.orchestratorai.io
      originServerName: app.orchestratorai.io
      
  # WebSocket specific endpoint (if needed)
  - hostname: ws.orchestratorai.io
    service: http://localhost:9000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      
  # Catch-all
  - service: http_status:404
EOF
    
    print_status "Configuration created at ~/.cloudflared/config.yml"
}

# Step 6: Route DNS
route_dns() {
    print_info "Routing DNS through tunnel..."
    
    TUNNEL_NAME="orchestrator-ai"
    
    # Route api subdomain
    cloudflared tunnel route dns $TUNNEL_NAME api.orchestratorai.io || true
    
    # Route app subdomain
    cloudflared tunnel route dns $TUNNEL_NAME app.orchestratorai.io || true
    
    # Route ws subdomain for WebSockets
    cloudflared tunnel route dns $TUNNEL_NAME ws.orchestratorai.io || true
    
    print_status "DNS routing configured"
    print_warning "CloudFlare will automatically update your DNS records"
}

# Step 7: Start tunnel
start_tunnel() {
    print_info "Starting CloudFlare Tunnel..."
    
    # Kill any existing cloudflared processes
    pkill cloudflared || true
    
    # Start in background
    cloudflared tunnel run &
    TUNNEL_PID=$!
    
    sleep 5
    
    if ps -p $TUNNEL_PID > /dev/null; then
        print_status "Tunnel is running (PID: $TUNNEL_PID)"
    else
        print_error "Failed to start tunnel"
        return 1
    fi
}

# Step 8: Create service for auto-start
create_service() {
    print_info "Setting up auto-start service..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - Create launchd plist
        sudo cloudflared service install
        print_status "Service installed for macOS"
    else
        # Linux - Create systemd service
        sudo cloudflared service install
        sudo systemctl enable cloudflared
        sudo systemctl start cloudflared
        print_status "Service installed and started for Linux"
    fi
}

# Main execution
main() {
    # Check if cloudflared is installed
    if ! check_cloudflared; then
        install_cloudflared
    fi
    
    # Login to CloudFlare (only needed once)
    print_warning "Have you already logged in to CloudFlare with cloudflared? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        login_cloudflare
    fi
    
    # Create tunnel
    create_tunnel
    
    # Create configuration
    create_config
    
    # Route DNS
    route_dns
    
    # Start tunnel
    start_tunnel
    
    # Optional: Install as service
    print_warning "Do you want to install cloudflared as a service for auto-start? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        create_service
    fi
    
    echo ""
    print_status "CloudFlare Tunnel setup complete!"
    echo ""
    print_info "Your services are now accessible at:"
    echo "  🌐 https://app.orchestratorai.io"
    echo "  🔌 https://api.orchestratorai.io"
    echo "  🔄 wss://ws.orchestratorai.io (WebSockets)"
    echo ""
    print_info "Benefits:"
    echo "  ✅ No port forwarding needed"
    echo "  ✅ Automatic SSL/TLS certificates"
    echo "  ✅ WebSocket support included"
    echo "  ✅ DDoS protection"
    echo "  ✅ Works behind any firewall/NAT"
    echo ""
    print_info "To manage tunnel:"
    echo "  View status: cloudflared tunnel info orchestrator-ai"
    echo "  View logs: cloudflared tunnel run"
    echo "  Stop tunnel: pkill cloudflared"
    echo "  Start tunnel: cloudflared tunnel run"
}

# Run main function
main