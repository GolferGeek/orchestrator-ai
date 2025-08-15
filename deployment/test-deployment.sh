#!/bin/bash

# Deployment Testing Script
# This script tests the complete deployment pipeline

set -e

echo "🧪 Testing Orchestrator AI Deployment Pipeline..."

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

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" &>/dev/null; then
        print_status "PASSED"
        ((TESTS_PASSED++))
        return 0
    else
        print_error "FAILED"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Check if .env.production exists
run_test ".env.production file exists" "[ -f .env.production ]"

# Test 2: Check if build script exists and is executable
run_test "Build script exists" "[ -f deployment/build-production.sh ]"
chmod +x deployment/build-production.sh 2>/dev/null || true

# Test 3: Check if PM2 deployment script exists
run_test "PM2 deployment script exists" "[ -f deployment/deploy-with-pm2.sh ]"
chmod +x deployment/deploy-with-pm2.sh 2>/dev/null || true

# Test 4: Check if ecosystem config exists
run_test "PM2 ecosystem config exists" "[ -f ecosystem.config.js ]"

# Test 5: Check if nginx setup script exists
run_test "Nginx setup script exists" "[ -f deployment/setup-nginx.sh ]"
chmod +x deployment/setup-nginx.sh 2>/dev/null || true

# Test 6: Check if nginx config exists
run_test "Nginx config exists" "[ -f deployment/nginx/orchestratorai-production.conf ]"

# Test 7: Check if PM2 startup script exists
run_test "PM2 startup script exists" "[ -f deployment/setup-pm2-startup.sh ]"
chmod +x deployment/setup-pm2-startup.sh 2>/dev/null || true

# Test 8: Check Node.js installation
run_test "Node.js installed" "command -v node"

# Test 9: Check npm installation
run_test "npm installed" "command -v npm"

# Test 10: Check if PM2 is available
if command -v pm2 &>/dev/null; then
    run_test "PM2 installed" "command -v pm2"
else
    print_warning "PM2 not installed - will be installed during deployment"
    ((TESTS_PASSED++))
fi

# Test 11: Check if nginx is available
if command -v nginx &>/dev/null; then
    run_test "Nginx installed" "command -v nginx"
else
    print_warning "Nginx not installed - please install before production deployment"
    ((TESTS_FAILED++))
fi

# Test 12: Check API package.json
run_test "API package.json exists" "[ -f apps/api/package.json ]"

# Test 13: Check Web package.json
run_test "Web package.json exists" "[ -f apps/web/package.json ]"

# Test 14: Check if API has build script
run_test "API has build script" "grep -q '\"build\"' apps/api/package.json"

# Test 15: Check if Web has build script
run_test "Web has build script" "grep -q '\"build\"' apps/web/package.json"

# Test 16: Validate ecosystem.config.js syntax
run_test "Ecosystem config valid JS" "node -c ecosystem.config.js"

# Test 17: Check production environment variables
run_test "API_PORT defined in .env.production" "grep -q 'API_PORT=9000' .env.production"
run_test "WEB_PORT defined in .env.production" "grep -q 'WEB_PORT=9001' .env.production"
run_test "VITE_API_BASE_URL defined" "grep -q 'VITE_API_BASE_URL' .env.production"

# Summary
echo ""
echo "======================================="
echo "Deployment Pipeline Test Results"
echo "======================================="
print_status "Tests Passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests Failed: $TESTS_FAILED"
else
    print_info "Tests Failed: 0"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    print_status "All tests passed! Deployment pipeline is ready."
    echo ""
    print_info "To deploy to production, run these commands in order:"
    echo ""
    echo "  1. Build the applications:"
    echo "     ./deployment/build-production.sh"
    echo ""
    echo "  2. Deploy with PM2:"
    echo "     ./deployment/deploy-with-pm2.sh"
    echo ""
    echo "  3. Setup nginx (if not already configured):"
    echo "     ./deployment/setup-nginx.sh"
    echo ""
    echo "  4. Setup auto-restart on reboot:"
    echo "     ./deployment/setup-pm2-startup.sh"
    echo ""
    print_info "For quick deployment after code changes:"
    echo "     ./deployment/build-production.sh && pm2 restart all"
else
    print_error "Some tests failed. Please fix the issues before deploying."
    echo ""
    print_info "Common fixes:"
    echo "  • Install nginx: brew install nginx (macOS) or sudo apt-get install nginx (Linux)"
    echo "  • Install PM2: npm install -g pm2"
    echo "  • Install serve: npm install -g serve"
    echo "  • Create .env.production file with proper configuration"
fi