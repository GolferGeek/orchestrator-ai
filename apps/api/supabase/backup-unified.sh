#!/bin/bash

# Unified Supabase Database Backup Script
# Supports both development and production environments
# Usage: ./backup-unified.sh [--env=dev|prod] [--force] [--restore backup_file]

set -e

# Default configuration
DEFAULT_ENV="dev"
DEFAULT_MAX_BACKUPS_DEV=10
DEFAULT_MAX_BACKUPS_PROD=20
PROJECT_NAME="api"

# Environment-specific configuration
DEV_CONTAINER="supabase_db_${PROJECT_NAME}-dev"
PROD_CONTAINER="supabase_db_${PROJECT_NAME}-production"
DEV_PORT="7012"
PROD_PORT="9012"
DEV_API_PORT="7010"
PROD_API_PORT="9010"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Global variables
ENVIRONMENT=""
FORCE_MODE="false"
RESTORE_MODE="false"
RESTORE_FILE=""
LIST_MODE="false"
MAX_BACKUPS=""
BACKUP_DIR=""
LOG_FILE=""
DB_CONTAINER=""
TIMESTAMP=""
BACKUP_FILE=""

# Logging functions
log() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
    else
        echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    fi
}

error() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    else
        echo -e "${RED}[ERROR]${NC} $1"
    fi
}

success() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
    else
        echo -e "${GREEN}[SUCCESS]${NC} $1"
    fi
}

warning() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
    else
        echo -e "${YELLOW}[WARNING]${NC} $1"
    fi
}

info() {
    if [ -n "$LOG_FILE" ]; then
        echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
    else
        echo -e "${PURPLE}[INFO]${NC} $1"
    fi
}

# Detect environment automatically if not specified
detect_environment() {
    if [ -z "$ENVIRONMENT" ]; then
        # Check which containers are running
        if docker ps --format "{{.Names}}" | grep -q "supabase_db_${PROJECT_NAME}-production"; then
            ENVIRONMENT="prod"
            info "Auto-detected production environment (container running)"
        elif docker ps --format "{{.Names}}" | grep -q "supabase_db_${PROJECT_NAME}-dev"; then
            ENVIRONMENT="dev"
            info "Auto-detected development environment (container running)"
        else
            # Fallback to checking ports
            if lsof -i :9012 >/dev/null 2>&1; then
                ENVIRONMENT="prod"
                info "Auto-detected production environment (port 9012 in use)"
            elif lsof -i :7012 >/dev/null 2>&1; then
                ENVIRONMENT="dev"
                info "Auto-detected development environment (port 7012 in use)"
            else
                error "Cannot detect environment. No Supabase containers or ports found."
                error "Please specify --env=dev or --env=prod"
                exit 1
            fi
        fi
    fi
}

# Initialize environment-specific configuration
init_environment() {
    detect_environment
    
    case "$ENVIRONMENT" in
        "dev")
            DB_CONTAINER="$DEV_CONTAINER"
            BACKUP_DIR="$(dirname "$0")/backups/dev"
            MAX_BACKUPS="${MAX_BACKUPS:-$DEFAULT_MAX_BACKUPS_DEV}"
            info "Environment: Development (port $DEV_PORT)"
            ;;
        "prod")
            DB_CONTAINER="$PROD_CONTAINER"
            BACKUP_DIR="$(dirname "$0")/backups/prod"
            MAX_BACKUPS="${MAX_BACKUPS:-$DEFAULT_MAX_BACKUPS_PROD}"
            info "Environment: Production (port $PROD_PORT)"
            ;;
        *)
            error "Invalid environment: $ENVIRONMENT. Use 'dev' or 'prod'"
            exit 1
            ;;
    esac
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
    LOG_FILE="${BACKUP_DIR}/backup.log"
    
    log "Configuration:"
    log "  Environment: $ENVIRONMENT"
    log "  Container: $DB_CONTAINER"
    log "  Backup dir: $BACKUP_DIR"
    log "  Max backups: $MAX_BACKUPS"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if Supabase container is running
check_supabase() {
    if ! docker ps --format "{{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
        error "Supabase database container '${DB_CONTAINER}' is not running."
        error "Please start the ${ENVIRONMENT} environment first:"
        if [ "$ENVIRONMENT" = "dev" ]; then
            error "  supabase start --config ./supabase/config.dev.toml"
        else
            error "  supabase start --config ./supabase/config.production.toml"
        fi
        exit 1
    fi
}

# Create backup directory if it doesn't exist
ensure_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    if [ ! -f "$LOG_FILE" ]; then
        touch "$LOG_FILE"
    fi
}

# Perform database backup
backup_database() {
    log "Starting backup of Supabase ${ENVIRONMENT} database..."
    log "Container: ${DB_CONTAINER}"
    log "Backup file: ${BACKUP_FILE}"
    
    # Create the backup using pg_dump
    if docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --clean --if-exists --create > "$BACKUP_FILE"; then
        # Get file size for logging
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        success "Database backup completed successfully!"
        success "Backup file: ${BACKUP_FILE} (${BACKUP_SIZE})"
        
        # Verify backup file is not empty
        if [ ! -s "$BACKUP_FILE" ]; then
            error "Backup file is empty! Something went wrong."
            rm -f "$BACKUP_FILE"
            exit 1
        fi
        
        return 0
    else
        error "Database backup failed!"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
}

# Clean up old backups (keep only the most recent MAX_BACKUPS)
cleanup_old_backups() {
    log "Cleaning up old backups (keeping ${MAX_BACKUPS} most recent)..."
    
    # Count current backups for this environment
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "supabase_backup_${ENVIRONMENT}_*.sql" | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        # Remove oldest backups
        EXCESS_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
        find "$BACKUP_DIR" -name "supabase_backup_${ENVIRONMENT}_*.sql" -type f -exec stat -f "%m %N" {} \; | \
            sort -n | \
            head -n "$EXCESS_COUNT" | \
            cut -d' ' -f2- | \
            while read -r file; do
                log "Removing old backup: $(basename "$file")"
                rm -f "$file"
            done
        success "Cleaned up ${EXCESS_COUNT} old backup(s)"
    else
        log "No cleanup needed (${BACKUP_COUNT}/${MAX_BACKUPS} backups)"
    fi
}

# List available backups
list_backups() {
    echo -e "\n${BLUE}Available ${ENVIRONMENT} backups:${NC}"
    if [ -d "$BACKUP_DIR" ] && [ "$(find "$BACKUP_DIR" -name "supabase_backup_${ENVIRONMENT}_*.sql" | wc -l)" -gt 0 ]; then
        find "$BACKUP_DIR" -name "supabase_backup_${ENVIRONMENT}_*.sql" -type f -exec stat -f "%m %N" {} \; | \
            sort -nr | \
            while read -r timestamp file; do
                SIZE=$(du -h "$file" | cut -f1)
                DATE=$(date -r "${timestamp}" '+%Y-%m-%d %H:%M:%S')
                echo "  $(basename "$file") - ${SIZE} - ${DATE}"
            done
    else
        echo "  No ${ENVIRONMENT} backups found"
    fi
    echo
}

# Restore from backup
restore_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        exit 1
    fi
    
    warning "This will COMPLETELY REPLACE your current ${ENVIRONMENT} database!"
    warning "Backup file: $backup_file"
    
    if [ "$FORCE_MODE" != "true" ]; then
        echo -n "Are you sure you want to continue? (yes/no): "
        read -r confirmation
        if [ "$confirmation" != "yes" ]; then
            log "Restore cancelled by user"
            exit 0
        fi
    fi
    
    log "Starting database restore from: $backup_file"
    
    # Restore the database
    if docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres < "$backup_file"; then
        success "Database restore completed successfully!"
    else
        error "Database restore failed!"
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Unified Supabase Database Backup Script"
    echo
    echo "Usage:"
    echo "  $0                                    # Auto-detect environment and create backup"
    echo "  $0 --env=dev                         # Create development backup"
    echo "  $0 --env=prod                        # Create production backup"
    echo "  $0 --env=dev --force                 # Create dev backup without prompts"
    echo "  $0 --env=prod --list                 # List production backups"
    echo "  $0 --env=dev --restore <backup_file> # Restore development database"
    echo "  $0 --env=prod --max-backups 30       # Set max prod backups to keep"
    echo "  $0 --help                            # Show this help"
    echo
    echo "Environment Detection:"
    echo "  The script can auto-detect the environment by checking:"
    echo "  1. Running Docker containers"
    echo "  2. Active ports (7012=dev, 9012=prod)"
    echo "  3. Or specify explicitly with --env=dev|prod"
    echo
    echo "Default Configuration:"
    echo "  Development: Keep 10 backups, container: supabase_db_api-dev"
    echo "  Production:  Keep 20 backups, container: supabase_db_api-production"
    echo
    echo "Examples:"
    echo "  $0 --env=dev --max-backups 5         # Keep only 5 dev backups"
    echo "  $0 --env=prod --force                # Create prod backup silently"
    echo "  $0 --env=dev --list                  # List all dev backups"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env=*)
            ENVIRONMENT="${1#*=}"
            if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
                error "Invalid environment: $ENVIRONMENT. Use 'dev' or 'prod'"
                exit 1
            fi
            shift
            ;;
        --force)
            FORCE_MODE="true"
            shift
            ;;
        --restore)
            RESTORE_MODE="true"
            RESTORE_FILE="$2"
            shift 2
            ;;
        --list)
            LIST_MODE="true"
            shift
            ;;
        --max-backups)
            if [[ "$2" =~ ^[0-9]+$ ]] && [ "$2" -gt 0 ]; then
                MAX_BACKUPS="$2"
            else
                error "Invalid max-backups value: $2 (must be a positive integer)"
                exit 1
            fi
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    init_environment
    ensure_backup_dir
    check_docker
    
    if [ "$LIST_MODE" = "true" ]; then
        list_backups
        exit 0
    fi
    
    check_supabase
    
    if [ "$RESTORE_MODE" = "true" ]; then
        restore_database "$RESTORE_FILE"
    else
        # Regular backup mode
        log "=== Supabase ${ENVIRONMENT} Database Backup Started ==="
        backup_database
        cleanup_old_backups
        list_backups
        log "=== Backup Process Completed ==="
    fi
}

# Run main function
main "$@"
