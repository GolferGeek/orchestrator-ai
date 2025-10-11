#!/bin/bash

# Daily n8n Database Backup Script
# Creates timestamped backups of the n8n database

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./storage/backups}"
N8N_DB_HOST="${N8N_DB_HOST:-127.0.0.1}"
N8N_DB_PORT="${N8N_DB_PORT:-7012}"
N8N_DB_NAME="${N8N_DB_NAME:-postgres}"
N8N_DB_USER="${N8N_DB_USER:-postgres}"
N8N_DB_PASSWORD="${N8N_DB_PASSWORD:-postgres}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/golfergeek_n8n_backup_$TIMESTAMP.sql"

echo "Creating n8n backup: $BACKUP_FILE"

# Create the backup using Docker container to avoid version mismatch
docker exec supabase_db_api-dev pg_dump \
  --host=localhost \
  --port=5432 \
  --username="$N8N_DB_USER" \
  --dbname="$N8N_DB_NAME" \
  --schema=n8n \
  --verbose \
  --clean \
  --if-exists \
  --create \
  --format=plain \
  > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "Backup created successfully: $BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Keep only the last 7 days of backups
find "$BACKUP_DIR" -name "golfergeek_n8n_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Old backups cleaned up (kept last 7 days)"
