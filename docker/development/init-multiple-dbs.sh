#!/bin/bash
set -e

# Create multiple databases for development
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create databases for different projects
    CREATE DATABASE orchestrator_ai;
    CREATE DATABASE hierarchy_ai;
    CREATE DATABASE client_demo_legal;
    CREATE DATABASE client_demo_marketing;
    
    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE orchestrator_ai TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE hierarchy_ai TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE client_demo_legal TO postgres;
    GRANT ALL PRIVILEGES ON DATABASE client_demo_marketing TO postgres;
EOSQL

# Apply migrations to orchestrator_ai database
if [ -d "/docker-entrypoint-initdb.d/migrations" ]; then
    echo "Applying migrations to orchestrator_ai database..."
    for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
        [ -f "$f" ] || continue
        echo "Processing $f..."
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "orchestrator_ai" < "$f"
    done
fi

echo "Multiple databases created successfully!"
echo "Available databases:"
echo "- orchestrator_ai (main development)"
echo "- hierarchy_ai (your other project)"
echo "- client_demo_legal (demo for legal industry)"
echo "- client_demo_marketing (demo for marketing industry)"