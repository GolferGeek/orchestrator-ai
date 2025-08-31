#!/bin/bash

# PM2 Deployment Script
# Deploys the production build using PM2 process manager

set -e

echo "🚀 Deploying Orchestrator AI with PM2..."

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
    print_warning "PM2 is not installed. Installing globally..."
    npm install -g pm2
    print_status "PM2 installed"
fi

# Check if serve is installed (for serving static files)
if ! command -v serve &> /dev/null; then
    print_warning "serve is not installed. Installing globally..."
    npm install -g serve
    print_status "serve installed"
fi

# Check if builds exist
if [ ! -d "apps/api/dist" ] || [ ! -d "apps/web/dist" ]; then
    print_error "Build artifacts not found. Please run ./deployment/build-production.sh first"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi

# Create log directories
print_info "Creating log directories..."
mkdir -p apps/api/logs
mkdir -p apps/web/logs
print_status "Log directories created"

# Stop existing PM2 processes if running
print_info "Stopping existing PM2 processes..."
pm2 delete orchestrator-api 2>/dev/null || true
pm2 delete orchestrator-web 2>/dev/null || true
print_status "Existing processes stopped"

# Start Supabase if Docker is available
if command -v docker &> /dev/null && docker info > /dev/null 2>&1; then
    print_info "Checking Supabase status..."
    if ! docker ps | grep -q "supabase_kong"; then
        print_info "Starting Supabase..."
        cd supabase && supabase start && cd ..
        print_status "Supabase started"
    else
        print_status "Supabase is already running"
    fi
else
    print_warning "Docker not available. Please start Supabase manually if needed"
fi

# Load environment variables and start with PM2
print_info "Starting applications with PM2..."

# Start using ecosystem file
pm2 start ecosystem.config.js

print_status "Applications started with PM2"

# Save PM2 configuration
print_info "Saving PM2 configuration..."
pm2 save
print_status "PM2 configuration saved"

# Display status
echo ""
pm2 status
echo ""

print_status "Deployment complete!"
echo ""
print_info "Management commands:"
echo "  📊 View status: pm2 status"
echo "  📜 View logs: pm2 logs"
echo "  🔄 Restart all: pm2 restart all"
echo "  🛑 Stop all: pm2 stop all"
echo "  📈 Monitor: pm2 monit"
echo ""
print_info "Service URLs:"
echo "  🌐 Web App: https://app.orchestratorai.io (served on :9001)"
echo "  🔌 API: https://api.orchestratorai.io (running on :9000)"
echo ""
print_info "To enable auto-start on reboot, run:"
echo "  sudo pm2 startup"
echo "  pm2 save"