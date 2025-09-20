#!/bin/bash

# Setup Cron Jobs for Unified Supabase Database Backups
# This script sets up cron jobs for both development and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Get the absolute path to the backup script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-unified.sh"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Configuration
DEFAULT_MAX_BACKUPS_DEV=${1:-10}   # Default to 10, or use first argument
DEFAULT_MAX_BACKUPS_PROD=${2:-20}  # Default to 20, or use second argument

# Cron job commands
# Development: Every 3 hours (more frequent for active development)
DEV_CRON_COMMAND="0 */3 * * * cd \"${PROJECT_ROOT}/apps/api\" && \"${BACKUP_SCRIPT}\" --env=dev --force --max-backups ${DEFAULT_MAX_BACKUPS_DEV} >> \"${SCRIPT_DIR}/backups/dev/cron.log\" 2>&1"

# Production: Every 6 hours (less frequent since it's more stable)
PROD_CRON_COMMAND="0 */6 * * * cd \"${PROJECT_ROOT}/apps/api\" && \"${BACKUP_SCRIPT}\" --env=prod --force --max-backups ${DEFAULT_MAX_BACKUPS_PROD} >> \"${SCRIPT_DIR}/backups/prod/cron.log\" 2>&1"

echo -e "${BLUE}Unified Supabase Database Backup - Cron Setup${NC}"
echo "=================================================="
echo
echo "This will set up automated backups for both environments:"
echo "  Development: Every 3 hours (keeps ${DEFAULT_MAX_BACKUPS_DEV} backups)"
echo "  Production:  Every 6 hours (keeps ${DEFAULT_MAX_BACKUPS_PROD} backups)"
echo
echo "Backup script: ${BACKUP_SCRIPT}"
echo "Project root: ${PROJECT_ROOT}"
echo

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo -e "${RED}Error: Backup script not found at ${BACKUP_SCRIPT}${NC}"
    exit 1
fi

# Check if backup script is executable
if [ ! -x "$BACKUP_SCRIPT" ]; then
    echo -e "${YELLOW}Making backup script executable...${NC}"
    chmod +x "$BACKUP_SCRIPT"
fi

# Create backup directories
echo -e "${BLUE}Creating backup directories...${NC}"
mkdir -p "${SCRIPT_DIR}/backups/dev"
mkdir -p "${SCRIPT_DIR}/backups/prod"

# Check current cron jobs
echo -e "${BLUE}Current cron jobs:${NC}"
crontab -l 2>/dev/null || echo "No cron jobs found"
echo

# Check if our cron jobs already exist
EXISTING_DEV=$(crontab -l 2>/dev/null | grep "backup-unified.sh.*--env=dev" || true)
EXISTING_PROD=$(crontab -l 2>/dev/null | grep "backup-unified.sh.*--env=prod" || true)

if [ -n "$EXISTING_DEV" ] || [ -n "$EXISTING_PROD" ]; then
    echo -e "${YELLOW}Existing backup cron jobs found:${NC}"
    [ -n "$EXISTING_DEV" ] && echo "  Dev: $EXISTING_DEV"
    [ -n "$EXISTING_PROD" ] && echo "  Prod: $EXISTING_PROD"
    echo
    echo -n "Do you want to replace them? (yes/no): "
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        echo -e "${BLUE}Setup cancelled${NC}"
        exit 0
    fi
    
    # Remove existing backup cron jobs
    echo -e "${BLUE}Removing existing backup cron jobs...${NC}"
    crontab -l 2>/dev/null | grep -v "backup-unified.sh" | crontab -
fi

# Add new cron jobs
echo -e "${BLUE}Adding new cron jobs...${NC}"

# Get current crontab (if any)
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Add our cron jobs
NEW_CRON="${CURRENT_CRON}
# Supabase Database Backups - Development (every 3 hours)
${DEV_CRON_COMMAND}

# Supabase Database Backups - Production (every 6 hours)  
${PROD_CRON_COMMAND}"

# Install the new crontab
echo "$NEW_CRON" | crontab -

echo -e "${GREEN}✅ Cron jobs installed successfully!${NC}"
echo
echo -e "${BLUE}Backup Schedule:${NC}"
echo "  Development: Every 3 hours (0 */3 * * *)"
echo "  Production:  Every 6 hours (0 */6 * * *)"
echo
echo -e "${BLUE}Backup Locations:${NC}"
echo "  Development: ${SCRIPT_DIR}/backups/dev/"
echo "  Production:  ${SCRIPT_DIR}/backups/prod/"
echo
echo -e "${BLUE}Log Files:${NC}"
echo "  Development: ${SCRIPT_DIR}/backups/dev/cron.log"
echo "  Production:  ${SCRIPT_DIR}/backups/prod/cron.log"
echo
echo -e "${BLUE}Manual Backup Commands:${NC}"
echo "  Development: ${BACKUP_SCRIPT} --env=dev"
echo "  Production:  ${BACKUP_SCRIPT} --env=prod"
echo
echo -e "${BLUE}List Backups:${NC}"
echo "  Development: ${BACKUP_SCRIPT} --env=dev --list"
echo "  Production:  ${BACKUP_SCRIPT} --env=prod --list"
echo

# Test the backup script
echo -e "${BLUE}Testing backup script...${NC}"
if "$BACKUP_SCRIPT" --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backup script is working correctly${NC}"
else
    echo -e "${RED}❌ Backup script test failed${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Setup complete! Your databases will now be automatically backed up.${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wait for the first automatic backup (within 3-6 hours)"
echo "2. Check the log files to ensure backups are working:"
echo "   tail -f ${SCRIPT_DIR}/backups/dev/cron.log"
echo "   tail -f ${SCRIPT_DIR}/backups/prod/cron.log"
echo "3. Test manual backups:"
echo "   ${BACKUP_SCRIPT} --env=dev --list"
echo "   ${BACKUP_SCRIPT} --env=prod --list"
echo
echo -e "${BLUE}To remove automated backups later:${NC}"
echo "  crontab -l | grep -v 'backup-unified.sh' | crontab -"
