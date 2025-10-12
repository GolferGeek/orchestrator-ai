-- Ensure the n8n schema and supporting tables exist before workflow seeds run.
-- This migration backfills the schema expected by marketing workflow imports.

CREATE SCHEMA IF NOT EXISTS n8n;

CREATE TABLE IF NOT EXISTS n8n.n8n_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_n8n_workflows_updated_at
  ON n8n.n8n_workflows(updated_at DESC);

CREATE TABLE IF NOT EXISTS n8n.migration_metadata (
  migration_file TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  workflow_id TEXT,
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE n8n.migration_metadata IS
  'Tracks workflow imports applied via Supabase migrations.';
