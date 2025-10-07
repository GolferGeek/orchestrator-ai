-- Create n8n schema for workflow automation
CREATE SCHEMA IF NOT EXISTS n8n;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA n8n TO postgres;
GRANT CREATE ON SCHEMA n8n TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA n8n TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA n8n TO postgres;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA n8n GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA n8n GRANT ALL ON SEQUENCES TO postgres;

-- Move n8n_workflows table to n8n schema
ALTER TABLE public.n8n_workflows SET SCHEMA n8n;

-- Update foreign key constraint to reference the moved table
ALTER TABLE public.migration_metadata 
DROP CONSTRAINT IF EXISTS migration_metadata_workflow_id_fkey;

ALTER TABLE public.migration_metadata 
ADD CONSTRAINT migration_metadata_workflow_id_fkey 
FOREIGN KEY (workflow_id) REFERENCES n8n.n8n_workflows(id);

-- Add comment explaining the schema organization
COMMENT ON SCHEMA n8n IS 'Schema for n8n workflow automation tables and data';
COMMENT ON TABLE n8n.n8n_workflows IS 'Stores n8n workflow definitions for sync between environments (moved from public schema)';
COMMENT ON TABLE public.migration_metadata IS 'Tracks n8n workflow migration sources and metadata (stays in public for API access)';
