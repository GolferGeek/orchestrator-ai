-- Move migration_metadata table to n8n schema for better organization
-- This table is specifically for n8n workflow migration tracking

-- Move the table to n8n schema
ALTER TABLE public.migration_metadata SET SCHEMA n8n;

-- Update the comment to reflect the new location
COMMENT ON TABLE n8n.migration_metadata IS 'Tracks n8n workflow migration sources and metadata (moved to n8n schema for better organization)';
