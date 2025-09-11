#!/bin/bash

# Supabase Local Database Backup Script
# Backs up the local Supabase database every 3 hours and keeps 10 most recent backups
# Usage: ./backup-local-db.sh [--force] [--restore backup_file]

set -e

# Configuration
BACKUP_DIR="$(dirname "$0")/backups"
PROJECT_NAME="api"
DB_CONTAINER="supabase_db_${PROJECT_NAME}"
MAX_BACKUPS=10
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/supabase_backup_${TIMESTAMP}.sql"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
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
    if ! docker ps --format "table {{.Names}}" | grep -q "^${DB_CONTAINER}$"; then
        error "Supabase database container '${DB_CONTAINER}' is not running."
        error "Please run 'supabase start' first."
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
    log "Starting backup of Supabase database..."
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
    
    # Count current backups
    BACKUP_COUNT=$(find "$BACKUP_DIR" -name "supabase_backup_*.sql" | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
        # Remove oldest backups
        EXCESS_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
        find "$BACKUP_DIR" -name "supabase_backup_*.sql" -type f -exec stat -f "%m %N" {} \; | \
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
    echo -e "\n${BLUE}Available backups:${NC}"
    if [ -d "$BACKUP_DIR" ] && [ "$(find "$BACKUP_DIR" -name "supabase_backup_*.sql" | wc -l)" -gt 0 ]; then
        find "$BACKUP_DIR" -name "supabase_backup_*.sql" -type f -exec stat -f "%m %N" {} \; | \
            sort -nr | \
            while read -r timestamp file; do
                SIZE=$(du -h "$file" | cut -f1)
                DATE=$(date -r "${timestamp}" '+%Y-%m-%d %H:%M:%S')
                echo "  $(basename "$file") - ${SIZE} - ${DATE}"
            done
    else
        echo "  No backups found"
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
    
    warning "This will COMPLETELY REPLACE your current database!"
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
    echo "Supabase Local Database Backup Script"
    echo
    echo "Usage:"
    echo "  $0                           # Create a backup"
    echo "  $0 --force                   # Create a backup without prompts"
    echo "  $0 --list                    # List available backups"
    echo "  $0 --restore <backup_file>   # Restore from backup"
    echo "  $0 --max-backups <number>    # Set max backups to keep (default: $MAX_BACKUPS)"
    echo "  $0 --help                    # Show this help"
    echo
    echo "Configuration:"
    echo "  Backup directory: $BACKUP_DIR"
    echo "  Max backups kept: $MAX_BACKUPS"
    echo "  Database container: $DB_CONTAINER"
    echo
    echo "Examples:"
    echo "  $0 --max-backups 5           # Keep only 5 backups"
    echo "  $0 --force --max-backups 20  # Create backup and keep 20 total"
    echo
}

# Parse command line arguments
FORCE_MODE="false"
RESTORE_MODE="false"
RESTORE_FILE=""
LIST_MODE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
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
                log "Setting max backups to: $MAX_BACKUPS"
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
        log "=== Supabase Local Database Backup Started ==="
        backup_database
        cleanup_old_backups
        list_backups
        log "=== Backup Process Completed ==="
    fi
}

# Run main function
main "$@"
