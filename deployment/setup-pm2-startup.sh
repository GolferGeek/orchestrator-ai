#!/bin/bash

# PM2 Startup Configuration Script
# This script sets up PM2 to automatically start on system reboot

set -e

echo "🔧 Setting up PM2 startup configuration..."

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

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed"
    print_info "Please install PM2 first: npm install -g pm2"
    exit 1
fi

# Detect OS and init system
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    INIT_SYSTEM="launchd"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    
    # Detect init system on Linux
    if systemctl --version &>/dev/null; then
        INIT_SYSTEM="systemd"
    elif service --version &>/dev/null; then
        INIT_SYSTEM="upstart"
    else
        INIT_SYSTEM="systemv"
    fi
else
    print_error "Unsupported operating system"
    exit 1
fi

print_info "Detected OS: $OS"
print_info "Detected init system: $INIT_SYSTEM"

# Generate startup script
print_info "Generating PM2 startup script..."
STARTUP_COMMAND=$(pm2 startup $INIT_SYSTEM -u $USER --hp $HOME | tail -n 1)

if [[ "$STARTUP_COMMAND" == *"sudo"* ]]; then
    print_warning "PM2 requires sudo privileges to set up startup script"
    print_info "Please run the following command:"
    echo ""
    echo "$STARTUP_COMMAND"
    echo ""
    print_info "After running the command above, continue with this script"
    read -p "Press Enter after running the sudo command..."
else
    print_info "Running startup command..."
    eval "$STARTUP_COMMAND"
fi

# Save current PM2 process list
print_info "Saving PM2 process list..."
pm2 save
print_status "PM2 process list saved"

# Create a systemd service file for Linux (as backup/alternative)
if [[ "$OS" == "linux" ]] && [[ "$INIT_SYSTEM" == "systemd" ]]; then
    print_info "Creating systemd service file as backup..."
    
    cat > /tmp/orchestrator-ai-pm2.service << EOF
[Unit]
Description=Orchestrator AI PM2 Process Manager
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$HOME/projects/orchestrator-ai
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    print_info "Systemd service file created at /tmp/orchestrator-ai-pm2.service"
    print_info "To install it manually:"
    echo "  sudo cp /tmp/orchestrator-ai-pm2.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable orchestrator-ai-pm2"
fi

# Create a launchd plist for macOS
if [[ "$OS" == "macos" ]]; then
    print_info "Creating launchd plist for macOS..."
    
    PLIST_FILE="$HOME/Library/LaunchAgents/com.orchestratorai.pm2.plist"
    
    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.orchestratorai.pm2</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/pm2</string>
        <string>resurrect</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$HOME/projects/orchestrator-ai</string>
    <key>StandardOutPath</key>
    <string>$HOME/projects/orchestrator-ai/deployment/logs/pm2-startup.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/projects/orchestrator-ai/deployment/logs/pm2-startup-error.log</string>
</dict>
</plist>
EOF

    print_status "Launchd plist created at $PLIST_FILE"
    
    # Load the plist
    launchctl load "$PLIST_FILE" 2>/dev/null || true
    print_status "Launchd plist loaded"
fi

# Create a restart script
print_info "Creating manual restart script..."
cat > deployment/restart-production.sh << 'EOF'
#!/bin/bash

# Restart production services

echo "🔄 Restarting production services..."

# Restart PM2 processes
pm2 restart all

# Check status
pm2 status

echo "✅ Services restarted"
EOF

chmod +x deployment/restart-production.sh
print_status "Restart script created"

# Verify setup
print_info "Verifying PM2 startup configuration..."
pm2 status

print_status "PM2 startup configuration complete!"
echo ""
print_info "PM2 will now automatically start on system reboot"
print_info "Current PM2 processes have been saved and will be restored"
echo ""
print_info "Useful commands:"
echo "  • Check startup status: pm2 startup"
echo "  • Save current process list: pm2 save"
echo "  • Manually start saved processes: pm2 resurrect"
echo "  • View all processes: pm2 status"
echo "  • Restart all: pm2 restart all"
echo ""

if [[ "$OS" == "macos" ]]; then
    print_info "For macOS, the launchd plist has been created and loaded"
    print_info "To unload: launchctl unload ~/Library/LaunchAgents/com.orchestratorai.pm2.plist"
fi

if [[ "$OS" == "linux" ]]; then
    print_info "For Linux, make sure the PM2 startup command was executed with sudo"
    print_info "You can also use the systemd service file if needed"
fi