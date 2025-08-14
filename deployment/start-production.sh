#!/bin/bash

# Orchestrator AI Production Startup Script
# This script starts the entire production environment with npm scripts

set -e

echo "🚀 Starting Orchestrator AI Production Environment..."

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

# Check if Node.js and npm are available
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js and try again."
        exit 1
    fi
    print_status "Node.js is available"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    print_status "npm is available"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p deployment/nginx
    mkdir -p deployment/ssl
    mkdir -p supabase/supabase/volumes/api
    
    print_status "Directories created"
}

# Create basic nginx config if it doesn't exist
create_nginx_config() {
    if [ ! -f "deployment/nginx/orchestratorai.conf" ]; then
        print_info "Creating basic nginx configuration..."
        
        cat > deployment/nginx/orchestratorai.conf << 'EOF'
# Basic nginx configuration for development
server {
    listen 80;
    server_name localhost;
    
    # Frontend
    location / {
        proxy_pass http://web:9001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # API
    location /api/ {
        proxy_pass http://api:9000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
        
        print_status "Basic nginx configuration created"
    fi
}

# Start Supabase
start_supabase() {
    print_info "Starting Supabase..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_warning "Docker is not running. Please start Docker Desktop first."
        print_info "You can start Supabase manually with: cd supabase && supabase start"
        return 0
    fi
    
    # Check if Supabase is already running
    if docker ps | grep -q "supabase_kong"; then
        print_status "Supabase is already running"
        return 0
    fi
    
    # Start Supabase
    print_info "Starting Supabase services..."
    cd supabase
    if supabase start; then
        print_status "Supabase started successfully"
    else
        print_warning "Failed to start Supabase. You may need to start it manually:"
        print_info "cd supabase && supabase start"
    fi
    cd ..
}

# Start the production environment
start_production() {
    print_info "Starting production environment with npm scripts..."
    
    # Install dependencies if needed
    print_info "Installing dependencies..."
    npm install
    
    # Start services
    print_info "Starting production services..."
    npm run dev:production &
    PRODUCTION_PID=$!
    
    print_status "Production environment started"
}

# Wait for services to be ready
wait_for_services() {
    print_info "Waiting for services to be ready..."
    
    # Wait for API
    print_info "Waiting for API..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:9000/health > /dev/null 2>&1; then
            print_status "API is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_warning "API took longer than expected to start"
    fi
    
    # Wait for web app
    print_info "Waiting for web app..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:9001 > /dev/null 2>&1; then
            print_status "Web app is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        print_warning "Web app took longer than expected to start"
    fi
}

# Show service status
show_status() {
    print_info "Service Status:"
    echo "  🚀 Production services running with npm"
    echo "  📊 Process ID: $PRODUCTION_PID"
    
    echo ""
    print_info "Service URLs:"
    echo "  🌐 Web App: https://app.orchestratorai.io"
    echo "  🔌 API: https://api.orchestratorai.io"
    echo "  🗄️  Supabase Studio: http://localhost:9012"
    echo "  📧 Email Testing: http://localhost:9016"
    echo ""
    print_info "Management:"
    echo "  View logs: npm run prod:logs"
    echo "  Stop services: npm run prod:stop"
    echo "  Restart services: npm run prod:restart"
    echo "  Check status: npm run prod:status"
}

# Main function
main() {
    echo "=================================="
    echo "Orchestrator AI Production Startup"
    echo "=================================="
    echo ""
    
    check_node
    create_directories
    create_nginx_config
    start_supabase
    start_production
    wait_for_services
    show_status
    
    echo ""
    print_status "Production environment is ready!"
    echo ""
    print_info "Your server is now accessible at:"
    echo "  🌐 https://app.orchestratorai.io"
    echo "  🔌 https://api.orchestratorai.io"
    echo ""
    print_info "Management:"
    echo "  Monitor logs: npm run prod:logs"
    echo "  Check health: npm run prod:health"
    echo "  Restart services: npm run prod:restart"
}

# Run main function
main "$@"
