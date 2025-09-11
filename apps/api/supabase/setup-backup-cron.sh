#!/bin/bash

# Setup Cron Job for Supabase Local Database Backups
# This script sets up a cron job to run backups every 3 hours

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the absolute path to the backup script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-local-db.sh"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Configuration
MAX_BACKUPS=${1:-10}  # Default to 10, or use first argument

# Cron job command (runs every 3 hours)
CRON_COMMAND="0 */3 * * * cd \"${PROJECT_ROOT}/apps/api\" && \"${BACKUP_SCRIPT}\" --force --max-backups ${MAX_BACKUPS} >> \"${SCRIPT_DIR}/backups/cron.log\" 2>&1"

echo -e "${BLUE}Supabase Local Database Backup - Cron Setup${NC}"
echo "=============================================="
echo
echo "This will set up an automated backup that runs every 3 hours."
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

# Check current cron jobs
echo -e "${BLUE}Current cron jobs:${NC}"
crontab -l 2>/dev/null || echo "No cron jobs found"
echo

# Check if our cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-local-db.sh"; then
    echo -e "${YELLOW}Supabase backup cron job already exists!${NC}"
    echo
    echo "Existing backup-related cron jobs:"
    crontab -l 2>/dev/null | grep "backup-local-db.sh" || true
    echo
    echo -n "Do you want to replace it? (yes/no): "
    read -r replace_confirmation
    
    if [ "$replace_confirmation" != "yes" ]; then
        echo "Setup cancelled."
        exit 0
    fi
    
    # Remove existing backup cron jobs
    echo -e "${YELLOW}Removing existing backup cron jobs...${NC}"
    crontab -l 2>/dev/null | grep -v "backup-local-db.sh" | crontab -
fi

# Add the new cron job
echo -e "${BLUE}Adding new cron job...${NC}"
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo -e "${GREEN}✅ Cron job added successfully!${NC}"
echo
echo "Cron job details:"
echo "  Schedule: Every 3 hours (0 */3 * * *)"
echo "  Command: ${BACKUP_SCRIPT} --force"
echo "  Log file: ${SCRIPT_DIR}/backups/cron.log"
echo

# Show updated cron jobs
echo -e "${BLUE}Updated cron jobs:${NC}"
crontab -l

echo
echo -e "${GREEN}Setup complete!${NC}"
echo
echo "The backup system will:"
echo "  • Run automatically every 3 hours"
echo "  • Keep the 10 most recent backups"
echo "  • Log all activity to cron.log"
echo
echo "Manual commands:"
echo "  • Run backup now: ${BACKUP_SCRIPT}"
echo "  • List backups: ${BACKUP_SCRIPT} --list"
echo "  • Restore backup: ${BACKUP_SCRIPT} --restore <backup_file>"
echo "  • View logs: tail -f ${SCRIPT_DIR}/backups/cron.log"
echo
echo -e "${YELLOW}Note: Make sure Supabase is running (supabase start) for backups to work!${NC}"
