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

## Troubleshooting

- **Authentication failures**: verify `DATABASE_URL` points to the Supabase instance and includes the correct password. For Supabase Cloud, SSL is required; we default to `DB_POSTGRESDB_SSL=true` and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` to accommodate their certificate chain.
- **Port conflicts**: n8n runs on port 5678
  - If you need a different port, modify the docker-compose.yml file
- **Resetting state**: 
  - `docker volume rm orchestrator-n8n-data`
  - This will delete all workflows/credentials, so use sparingly
- **Shared instance**: Both dev and prod use the same n8n instance, so workflows are shared between environments
