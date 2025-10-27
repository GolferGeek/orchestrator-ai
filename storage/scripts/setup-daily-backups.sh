#!/bin/bash

# Setup Daily Automated Backups
# Creates a cron job to run daily backups

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-all-daily.sh"

echo "Setting up daily automated backups..."
echo "Project root: $PROJECT_ROOT"
echo "Backup script: $BACKUP_SCRIPT"

# Create the cron job entry
CRON_ENTRY="0 2 * * * cd $PROJECT_ROOT && $BACKUP_SCRIPT >> storage/backups/backup.log 2>&1"

echo "Cron job to be added:"
echo "$CRON_ENTRY"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-all-daily.sh"; then
    echo "Daily backup cron job already exists!"
    echo "Current cron jobs:"
    crontab -l | grep backup
else
    echo "Adding daily backup cron job..."
    
    # Add the cron job
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    
    echo "Daily backup cron job added successfully!"
    echo "Backups will run daily at 2:00 AM"
fi

echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove the backup cron job: crontab -e (then delete the line)"
echo ""
echo "Backup logs will be written to: storage/backups/backup.log"
