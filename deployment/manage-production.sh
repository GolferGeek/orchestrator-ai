#!/bin/bash

# Orchestrator AI Production Management Script
# This script provides various commands to manage the production environment

set -e

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

# Show usage
show_usage() {
    echo "Orchestrator AI Production Management"
    echo "===================================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start       - Start the production environment"
    echo "  stop        - Stop the production environment"
    echo "  restart     - Restart the production environment"
    echo "  status      - Show status of all services"
    echo "  logs        - Show logs from all services"
    echo "  logs-api    - Show API logs only"
    echo "  logs-web    - Show web app logs only"
    echo "  backup      - Create database backup"
    echo "  restore     - Restore database from backup"
    echo "  update      - Update and restart services"
    echo "  clean       - Clean up unused processes"
    echo "  health      - Check health of all services"
    echo "  help        - Show this help message"
    echo ""
}

# Start production environment
start_production() {
    print_info "Starting production environment..."
    npm run dev:production
    print_status "Production environment started"
}

# Stop production environment
stop_production() {
    print_info "Stopping production environment..."
    pkill -f "npm run dev:production" || echo "No production processes to stop"
    print_status "Production environment stopped"
}

# Restart production environment
restart_production() {
    print_info "Restarting production environment..."
    npm run prod:stop
    sleep 2
    npm run dev:production
    print_status "Production environment restarted"
}

# Show status
show_status() {
    print_info "Service Status:"
    ps aux | grep -E "(npm|node)" | grep -v grep || echo "No production processes found"
    
    echo ""
    print_info "Service URLs:"
    echo "  🌐 Web App: http://localhost:9001"
    echo "  🔌 API: http://localhost:9000"
    echo ""
    print_info "Process Management:"
    echo "  Production PID: $(pgrep -f 'npm run dev:production' || echo 'Not running')"
}

# Show logs
show_logs() {
    print_info "Showing logs from all services..."
    echo "Production logs are in the terminal where npm run dev:production was started"
    echo "To view real-time logs, check the terminal running the production process"
}

# Show specific logs
show_specific_logs() {
    local service=$1
    print_info "Showing logs from $service..."
    echo "Service-specific logs are in the terminal where npm run dev:production was started"
    echo "To view real-time logs, check the terminal running the production process"
}

# Create database backup
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${timestamp}.sql"
    
    print_info "Creating database backup: $backup_file"
    
    mkdir -p backups
    
    # Note: This assumes you have a local PostgreSQL instance or Supabase running
    # You may need to adjust the connection details based on your setup
    if command -v pg_dump &> /dev/null; then
        pg_dump -h localhost -U postgres postgres > "backups/$backup_file" 2>/dev/null || {
            print_error "Failed to create backup. Please ensure PostgreSQL is running and accessible."
            print_info "You may need to configure database connection details."
        }
    else
        print_error "pg_dump not found. Please install PostgreSQL client tools."
    fi
    
    if [ -f "backups/$backup_file" ]; then
        print_status "Backup created: backups/$backup_file"
    fi
}

# Restore database from backup
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "Please specify a backup file"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    if [ ! -f "backups/$backup_file" ]; then
        print_error "Backup file not found: backups/$backup_file"
        exit 1
    fi
    
    print_warning "This will overwrite the current database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Restoring database from: $backup_file"
        
        # Note: This assumes you have a local PostgreSQL instance or Supabase running
        # You may need to adjust the connection details based on your setup
        if command -v psql &> /dev/null; then
            psql -h localhost -U postgres postgres < "backups/$backup_file" 2>/dev/null || {
                print_error "Failed to restore backup. Please ensure PostgreSQL is running and accessible."
                print_info "You may need to configure database connection details."
            }
        else
            print_error "psql not found. Please install PostgreSQL client tools."
        fi
        
        print_status "Database restored from: $backup_file"
    else
        print_info "Restore cancelled"
    fi
}

# Update and restart services
update_services() {
    print_info "Updating services..."
    
    # Install latest dependencies
    npm install
    
    # Restart services
    npm run prod:restart
    
    print_status "Services updated and restarted"
}

# Clean up unused processes
clean_processes() {
    print_info "Cleaning up unused processes..."
    
    # Kill any orphaned npm processes
    pkill -f "npm run dev:production" 2>/dev/null || echo "No production processes to clean"
    
    # Kill any orphaned node processes on our ports
    lsof -ti:9000 | xargs kill -9 2>/dev/null || echo "No processes on port 9000"
    lsof -ti:9001 | xargs kill -9 2>/dev/null || echo "No processes on port 9001"
    
    print_status "Process cleanup completed"
}

# Check health of all services
check_health() {
    print_info "Checking health of all services..."
    
    # Check if production process is running
    if pgrep -f "npm run dev:production" > /dev/null; then
        print_status "Production Process: Running"
    else
        print_error "Production Process: Not running"
    fi
    
    # Check API
    if curl -f http://localhost:9000/health > /dev/null 2>&1; then
        print_status "API: Healthy"
    else
        print_error "API: Unhealthy"
    fi
    
    # Check web app
    if curl -f http://localhost:9001 > /dev/null 2>&1; then
        print_status "Web App: Healthy"
    else
        print_error "Web App: Unhealthy"
    fi
}

# Note: Shell access functions removed as they were Docker-specific
# For debugging, use the terminal where npm run dev:production is running

# Main function
main() {
    case "${1:-help}" in
        start)
            start_production
            ;;
        stop)
            stop_production
            ;;
        restart)
            restart_production
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        logs-api)
            show_specific_logs api
            ;;
        logs-web)
            show_specific_logs web
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup "$2"
            ;;
        update)
            update_services
            ;;
        clean)
            clean_processes
            ;;
        health)
            check_health
            ;;
        help|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"
