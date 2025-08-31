#!/bin/bash

# Production Build Script
# This script builds both web and API apps using the production environment

set -e

echo "🚀 Building Orchestrator AI for Production..."

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

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    exit 1
fi

# Load environment variables
print_info "Loading .env..."
export $(cat .env | grep -v '^#' | xargs)

# Clean previous builds
print_info "Cleaning previous builds..."
rm -rf apps/web/dist
rm -rf apps/api/dist
print_status "Previous builds cleaned"

# Install dependencies
print_info "Installing dependencies..."
npm install
print_status "Dependencies installed"

# Build API
print_info "Building API with production configuration..."
cd apps/api
npm run build
cd ../..
print_status "API built successfully"

# Build Web App
print_info "Building Web App with production configuration..."
cd apps/web

# Ensure production environment variables are available for Vite
export NODE_ENV=production
export VITE_API_BASE_URL=https://api.orchestratorai.io
export VITE_API_NESTJS_BASE_URL=https://api.orchestratorai.io
export VITE_APP_ENV=production

npm run build
cd ../..
print_status "Web App built successfully"

# Create deployment info file
print_info "Creating deployment info..."
cat > deployment/build-info.json << EOF
{
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "production",
  "apiVersion": "$(node -p "require('./apps/api/package.json').version")",
  "webVersion": "$(node -p "require('./apps/web/package.json').version")",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF
print_status "Deployment info created"

print_status "Production build complete!"
echo ""
print_info "Build artifacts:"
echo "  📦 API: apps/api/dist/"
echo "  📦 Web: apps/web/dist/"
echo ""
print_info "Next steps:"
echo "  1. Run: ./deployment/deploy-with-pm2.sh"
echo "  2. Or manually start with PM2: pm2 start ecosystem.config.js"