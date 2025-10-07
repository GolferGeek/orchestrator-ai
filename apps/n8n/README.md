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
1. **Design with AI**: Describe your workflow in natural language
2. **Generate Configuration**: AI creates the n8n workflow JSON
3. **Save to Database**: Insert workflow into `n8n.n8n_workflows` table
4. **Export as Migration**: Use `npm run n8n:create-migration "Workflow Name"`
5. **Share with Team**: Commit migration for team sync

## Troubleshooting

- **Authentication failures**: verify `DATABASE_URL` points to the Supabase instance and includes the correct password. For Supabase Cloud, SSL is required; we default to `DB_POSTGRESDB_SSL=true` and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` to accommodate their certificate chain.
- **Port conflicts**: n8n runs on port 5678
  - If you need a different port, modify the docker-compose.yml file
- **MCP Connection Issues**: Restart Cursor if n8n MCP server isn't responding
- **Resetting state**: 
  - `docker volume rm orchestrator-n8n-data`
  - This will delete all workflows/credentials, so use sparingly
- **Shared instance**: Both dev and prod use the same n8n instance, so workflows are shared between environments
