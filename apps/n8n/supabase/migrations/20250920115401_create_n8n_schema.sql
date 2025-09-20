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
