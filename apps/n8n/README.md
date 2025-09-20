# n8n Local Development

This directory contains the self-hosted n8n setup used during local API development. The configuration is optimized to reuse the shared Supabase Postgres database referenced in the project root `.env` file.

## What gets provisioned

- `docker-compose.yml` – runs the official `docker.n8n.io/n8nio/n8n` image
- Named Docker volume `orchestrator-n8n-data` that persists credentials, encryption keys, and logs under `/home/node/.n8n`
- Environment variables sourced from your root `.env`

## Prerequisites

- Docker Desktop (already required for local Supabase)
- Root `.env` populated with `DATABASE_URL` plus the `N8N_*` entries documented below

## Useful commands

From the repo root:

```bash
# start the stack (called automatically by npm run dev:api)
docker compose -f apps/n8n/docker-compose.yml up -d

# view logs
docker compose -f apps/n8n/docker-compose.yml logs -f

# stop the stack
docker compose -f apps/n8n/docker-compose.yml down
```

> Note: `npm run dev:api` handles bringing the stack up and down. Use the manual commands only when you need to troubleshoot n8n independently of the API lifecycle. The helper script auto-loads the root `.env` when `DATABASE_URL` isn’t already present in your shell.

## Environment variables

Add the following to your root `.env` (values shown represent the defaults we use locally):

```
GENERIC_TIMEZONE=America/Chicago
TZ=America/Chicago
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_ENCRYPTION_KEY=<generated-32-byte-base64-value>
```

`N8N_ENCRYPTION_KEY` must stay stable across restarts; n8n uses it to encrypt credentials stored in Postgres.

The compose file also derives Postgres connection details from `DATABASE_URL` at runtime. No additional DB-specific variables are necessary unless you want to override the default schema (`public`) or tweak SSL flags.

## First run checklist

1. Ensure Docker Desktop is running.
2. Run `npm run dev:api`.
3. Confirm the logs show `orchestrator-n8n` started successfully and connected to Postgres.
4. Open http://localhost:5678 to complete the initial n8n onboarding.

## Troubleshooting

- **Authentication failures**: verify `DATABASE_URL` points to the Supabase instance and includes the correct password. For Supabase Cloud, SSL is required; we default to `DB_POSTGRESDB_SSL=true` and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` to accommodate their certificate chain.
- **Port conflicts**: adjust `N8N_PORT` in your `.env` and restart.
- **Resetting state**: stop the stack and remove the Docker volume with `docker volume rm orchestrator-n8n-data`. This will delete all workflows/credentials, so use sparingly.
