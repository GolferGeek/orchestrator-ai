# n8n Workflow Automation Setup

This directory contains a single shared n8n instance that both development and production environments use. The instance runs independently and both dev and prod scripts simply ensure it's running.

## What gets provisioned

### Single Shared Instance (Port 5678)
- `docker-compose.yml` – runs the official `docker.n8n.io/n8nio/n8n` image
- Named Docker volume `orchestrator-n8n-data` that persists credentials, encryption keys, and logs
- Uses `n8n` database schema in your Supabase instance
- Environment variables sourced from your root `.env`

## Prerequisites

- Docker Desktop (already required for local Supabase)
- Root `.env` populated with `DATABASE_URL` plus the `N8N_*` entries documented below

## Useful commands

From the repo root:

```bash
# n8n management
./apps/n8n/manage.sh up              # Start n8n instance (if not running)
./apps/n8n/manage.sh down            # Stop n8n instance
./apps/n8n/manage.sh restart         # Restart n8n instance
./apps/n8n/manage.sh logs -f         # View n8n logs
./apps/n8n/manage.sh ps              # Check n8n status

# npm scripts
npm run n8n:up                       # Start n8n instance
npm run n8n:down                     # Stop n8n instance
npm run n8n:logs                     # View n8n logs
npm run n8n:status                   # Check n8n status
```

> Note: Both `npm run dev:api` and `npm run server:restart` automatically ensure n8n is running before starting their respective services.

## Environment variables

### Required Environment Variables (`.env`)
Add the following to your root `.env`:

```
GENERIC_TIMEZONE=America/Chicago
TZ=America/Chicago
N8N_PROTOCOL=http
N8N_ENCRYPTION_KEY=<generated-32-byte-base64-value>
N8N_DB_SCHEMA=n8n
```

**Important Notes:**
- `N8N_ENCRYPTION_KEY` must stay stable across restarts
- n8n uses this key to encrypt credentials stored in Postgres
- Uses the `n8n` database schema in your Supabase instance
- The compose file derives Postgres connection details from `DATABASE_URL` at runtime

## First run checklist

1. Ensure Docker Desktop is running.
2. Run `./apps/n8n/manage.sh up` or `npm run n8n:up`.
3. Confirm the logs show `orchestrator-n8n` started successfully and connected to Postgres.
4. Open http://localhost:5678 to complete the initial n8n onboarding.

## n8n MCP Integration

This project includes the **n8n Model Context Protocol (MCP)** server for building workflows directly from your codebase using AI assistants like Claude/Cursor.

### What the n8n MCP Provides:
- **AI-Powered Workflow Creation**: Build n8n workflows using natural language
- **Comprehensive n8n Documentation**: AI has access to all n8n node documentation
- **Direct Integration**: Create workflows without leaving your IDE
- **Workflow Sync**: Works with our migration system for team collaboration

### Usage in Cursor/Claude:
Once configured (see `.cursor/mcp.json`), you can:

```
"Create an n8n workflow that:
1. Listens for webhook calls
2. Validates the incoming data
3. Stores it in our Supabase database
4. Sends a Slack notification"
```

The AI will generate the complete n8n workflow configuration using the MCP server.

### Workflow Development Process:

#### Recommended: Build in n8n UI and Export
1. **Design in n8n**: Open http://localhost:5678 and build your workflow visually
2. **Test thoroughly**: Run the workflow and verify it works as expected
3. **Export workflow and create migration**:
   ```bash
   # Get API credentials from apps/n8n/.env
   source apps/n8n/.env

   # Export workflow to temp file
   WORKFLOW_NAME="Your Workflow Name"
   curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_API_URL/api/v1/workflows" | \
     jq ".data[] | select(.name == \"$WORKFLOW_NAME\")" > /tmp/workflow.json

   # Extract workflow data
   WORKFLOW_ID=$(jq -r '.id' /tmp/workflow.json)
   WORKFLOW_ACTIVE=$(jq -r '.active' /tmp/workflow.json)
   WORKFLOW_NODES=$(jq -c '.nodes' /tmp/workflow.json)
   WORKFLOW_CONNECTIONS=$(jq -c '.connections' /tmp/workflow.json)
   WORKFLOW_SETTINGS=$(jq -c '.settings // {}' /tmp/workflow.json)

   # Create migration directly in apps/api/supabase/migrations/
   TIMESTAMP=$(date +%Y%m%d%H%M%S)
   SLUG=$(echo "$WORKFLOW_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
   MIGRATION_FILE="apps/api/supabase/migrations/${TIMESTAMP}_add_n8n_${SLUG}.sql"

   # Generate migration SQL (escape single quotes for SQL)
   # See existing n8n migrations for the complete template
   ```
4. **Commit migration**: Commit the migration file in `apps/api/supabase/migrations/` - it will auto-run on next API startup

#### Alternative: Use AI with n8n MCP
1. **Design with AI**: Describe your workflow to Claude/Cursor (requires MCP setup in `.cursor/mcp.json`)
2. **Generate & Import**: AI creates the workflow JSON and can help create it in n8n via API
3. **Export**: Follow the export process above to create a migration

**Important Notes**:
- Workflows are stored in n8n's internal database (Docker volume `orchestrator-n8n-data`)
- Migrations sync workflows to the `n8n.n8n_workflows` table in Supabase for version control
- Your n8n API key is stored in `apps/n8n/.env` as `N8N_API_KEY`
- **All n8n workflow migrations go directly in `apps/api/supabase/migrations/`** - they run automatically on API startup
- See existing n8n migrations (files starting with `*_add_n8n_*.sql`) for the SQL template format

## Troubleshooting

- **Authentication failures**: verify `DATABASE_URL` points to the Supabase instance and includes the correct password. For Supabase Cloud, SSL is required; we default to `DB_POSTGRESDB_SSL=true` and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` to accommodate their certificate chain.
- **Port conflicts**: n8n runs on port 5678
  - If you need a different port, modify the docker-compose.yml file
- **MCP Connection Issues**: Restart Cursor if n8n MCP server isn't responding
- **Resetting state**: 
  - `docker volume rm orchestrator-n8n-data`
  - This will delete all workflows/credentials, so use sparingly
- **Shared instance**: Both dev and prod use the same n8n instance, so workflows are shared between environments
