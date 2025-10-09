-- Create n8n workflows table for sync system
-- This stores workflow definitions that can be synced between environments
CREATE TABLE IF NOT EXISTS n8n_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connections JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name)
);

-- Create migration metadata table for n8n workflow sync
-- Track migration sources and workflow associations
CREATE TABLE IF NOT EXISTS migration_metadata (
  migration_file TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('dev', 'prod', 'staging')),
  workflow_id UUID REFERENCES n8n_workflows(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_n8n_workflows_name ON n8n_workflows(name);
CREATE INDEX idx_n8n_workflows_active ON n8n_workflows(active);
CREATE INDEX idx_n8n_workflows_updated ON n8n_workflows(updated_at);

CREATE INDEX idx_migration_metadata_source ON migration_metadata(source);
CREATE INDEX idx_migration_metadata_workflow ON migration_metadata(workflow_id);
CREATE INDEX idx_migration_metadata_synced ON migration_metadata(synced_at);

-- Comments for documentation
COMMENT ON TABLE n8n_workflows IS 'Stores n8n workflow definitions for sync between environments';
COMMENT ON TABLE migration_metadata IS 'Tracks the source and metadata of n8n workflow migrations';
COMMENT ON COLUMN migration_metadata.source IS 'Origin of the migration: dev, prod, or staging';
COMMENT ON COLUMN migration_metadata.workflow_id IS 'References the n8n workflow this migration manages';
