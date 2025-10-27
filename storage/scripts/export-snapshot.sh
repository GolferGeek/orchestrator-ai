#!/bin/bash
# Export database snapshot for intern distribution

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
SNAPSHOT_DIR="storage/snapshots/$TIMESTAMP"
LATEST_DIR="storage/snapshots/latest"
DB_HOST="127.0.0.1"
DB_PORT="7012"
DB_USER="postgres"
DB_NAME="postgres"

# Create snapshot directory
mkdir -p "$SNAPSHOT_DIR"

echo "📸 Creating database snapshot: $TIMESTAMP"

# Export schemas (structure only)
echo "📦 Exporting schemas: public, n8n, company, observability..."
export PGPASSWORD=postgres
docker exec -e PGPASSWORD=postgres supabase_db_api-dev pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema=public \
  --schema=n8n \
  --schema=company \
  --schema=observability \
  --schema-only \
  --no-owner \
  --no-acl \
  > "$SNAPSHOT_DIR/schema.sql"

# Add drop statements at the beginning
echo "🧹 Adding cleanup statements..."
cat > "$SNAPSHOT_DIR/schema.tmp" << 'EOF'
-- Database Snapshot
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Schemas: public, n8n, company, observability

-- Cleanup existing schemas (WARNING: This will delete all data!)
DROP SCHEMA IF EXISTS observability CASCADE;
DROP SCHEMA IF EXISTS company CASCADE;
DROP SCHEMA IF EXISTS n8n CASCADE;
-- Note: public schema is not dropped as it's required by PostgreSQL

-- Recreate schemas
CREATE SCHEMA IF NOT EXISTS n8n;
CREATE SCHEMA IF NOT EXISTS company;
CREATE SCHEMA IF NOT EXISTS observability;

EOF

cat "$SNAPSHOT_DIR/schema.sql" >> "$SNAPSHOT_DIR/schema.tmp"
mv "$SNAPSHOT_DIR/schema.tmp" "$SNAPSHOT_DIR/schema.sql"

# Export seed data
echo "🌱 Exporting seed data..."
docker exec -e PGPASSWORD=postgres supabase_db_api-dev pg_dump \
  -h localhost \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --table=public.agents \
  --table=public.providers \
  --table=public.models \
  --data-only \
  --no-owner \
  --no-acl \
  --column-inserts \
  > "$SNAPSHOT_DIR/seed.sql"

# Add truncate statements at the beginning
cat > "$SNAPSHOT_DIR/seed.tmp" << 'EOF'
-- Seed Data Export
-- Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
-- Tables: agents, providers, models

-- Clear existing data
TRUNCATE TABLE public.agents CASCADE;
TRUNCATE TABLE public.providers CASCADE;
TRUNCATE TABLE public.models CASCADE;

EOF

cat "$SNAPSHOT_DIR/seed.sql" >> "$SNAPSHOT_DIR/seed.tmp"
mv "$SNAPSHOT_DIR/seed.tmp" "$SNAPSHOT_DIR/seed.sql"

# Create metadata file
cat > "$SNAPSHOT_DIR/metadata.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "created_at": "$(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "schemas": ["public", "n8n", "company", "observability"],
  "seed_tables": ["agents", "providers", "models"],
  "db_host": "$DB_HOST",
  "db_port": "$DB_PORT"
}
EOF

# Update 'latest' symlink/directory
rm -rf "$LATEST_DIR"
cp -r "$SNAPSHOT_DIR" "$LATEST_DIR"

echo "✅ Snapshot created successfully!"
echo "📂 Location: $SNAPSHOT_DIR"
echo "🔗 Latest: $LATEST_DIR"
echo ""
echo "📤 Share the 'storage/snapshots/latest' directory with interns"
