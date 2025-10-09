#!/bin/bash

# Restore Database from Backup Script
# Usage: ./restore-from-backup.sh [supabase|n8n] [backup_file]

set -e

if [ $# -lt 2 ]; then
    echo "Usage: $0 [supabase|n8n] [backup_file]"
    echo ""
    echo "Examples:"
    echo "  $0 supabase storage/backups/golfergeek_supabase_backup_20250113_143022.sql.gz"
    echo "  $0 n8n storage/backups/golfergeek_n8n_backup_20250113_143022.sql.gz"
    echo ""
    echo "Available backups:"
    ls -la storage/backups/ 2>/dev/null || echo "No backups found in storage/backups/"
    exit 1
fi

DB_TYPE="$1"
BACKUP_FILE="$2"

# Configuration
SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-127.0.0.1}"
SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-54322}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

N8N_DB_HOST="${N8N_DB_HOST:-127.0.0.1}"
N8N_DB_PORT="${N8N_DB_PORT:-7012}"
N8N_DB_NAME="${N8N_DB_NAME:-postgres}"
N8N_DB_USER="${N8N_DB_USER:-postgres}"
N8N_DB_PASSWORD="${N8N_DB_PASSWORD:-postgres}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

# Set database connection parameters based on type
if [ "$DB_TYPE" = "supabase" ]; then
    DB_HOST="$SUPABASE_DB_HOST"
    DB_PORT="$SUPABASE_DB_PORT"
    DB_NAME="$SUPABASE_DB_NAME"
    DB_USER="$SUPABASE_DB_USER"
    DB_PASSWORD="$SUPABASE_DB_PASSWORD"
    CONTAINER_NAME="orchestrator-supabase-db"
elif [ "$DB_TYPE" = "n8n" ]; then
    DB_HOST="$N8N_DB_HOST"
    DB_PORT="$N8N_DB_PORT"
    DB_NAME="$N8N_DB_NAME"
    DB_USER="$N8N_DB_USER"
    DB_PASSWORD="$N8N_DB_PASSWORD"
    CONTAINER_NAME="orchestrator-n8n"
else
    echo "Error: Database type must be 'supabase' or 'n8n'"
    exit 1
fi

echo "Restoring $DB_TYPE database from: $BACKUP_FILE"
echo "Target: $DB_HOST:$DB_PORT/$DB_NAME"

# Confirm before proceeding
read -p "This will DESTROY the current $DB_TYPE database. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop the relevant container to ensure clean restore
echo "Stopping $CONTAINER_NAME container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || echo "Container not running or doesn't exist"

# Wait a moment for clean shutdown
sleep 2

# Start the container
echo "Starting $CONTAINER_NAME container..."
docker start "$CONTAINER_NAME" 2>/dev/null || echo "Container start failed or already running"

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Check if backup is compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing and restoring backup..."
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="postgres" \
        --verbose
else
    echo "Restoring backup..."
    PGPASSWORD="$DB_PASSWORD" psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="postgres" \
        --verbose \
        --file="$BACKUP_FILE"
fi

echo "Restore completed successfully!"

# Restart the container to ensure everything is working
echo "Restarting $CONTAINER_NAME container..."
docker restart "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "Database restore process completed!"
