-- Migration: Add n8n workflow - Marketing Swarm - Flexible LLM (Recreated)
-- Source: Recreated after db reset on 2025-10-08
-- Workflow IDs:
--   Helper: LLM Task - 9jxl03jCcqg17oOy
--   Marketing Swarm - Flexible LLM - 1LaQnwqSoTxmnw3Z
--
-- Description:
--   This migration recreates the Marketing Swarm workflow system that was lost in the database reset.
--   The system consists of two workflows:
--   1. Helper: LLM Task - Reusable Execute Workflow for multi-provider LLM requests
--   2. Marketing Swarm - Flexible LLM - Main webhook workflow that generates marketing content
--
-- Features:
--   - Multi-provider LLM support (OpenAI, Ollama, Anthropic)
--   - Real-time status updates via webhooks
--   - Generates: web posts, SEO content, and social media posts
--
-- Note: The actual workflow JSON is managed in n8n and can be exported/synced using:
--   ./apps/api/scripts/export-n8n-workflow.sh <workflow-id>
--
-- To restore these workflows to n8n after this migration runs, use:
--   1. Access n8n UI at http://localhost:5678
--   2. Import workflows manually, or
--   3. Use n8n API to recreate from the templates in /apps/n8n/workflows/

-- Create workflows table if schema exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'n8n') THEN
    -- Placeholder entries to track that these workflows exist
    -- Actual workflow definitions are managed in n8n
    INSERT INTO n8n.migration_metadata (migration_file, source, notes)
    VALUES
      ('20251008120600_add_marketing_swarm_flexible_llm.sql', 'dev',
       'Helper: LLM Task (9jxl03jCcqg17oOy) and Marketing Swarm - Flexible LLM (1LaQnwqSoTxmnw3Z) workflows at /webhook/marketing-swarm-flexible')
    ON CONFLICT (migration_file) DO NOTHING;
  END IF;
END $$;

-- Add comment explaining workflow management
COMMENT ON TABLE n8n.migration_metadata IS
'Tracks n8n workflow migrations. Full workflow definitions are stored in n8n database.
For version control, export workflows using: curl http://localhost:5678/api/v1/workflows/<id> -H "X-N8N-API-KEY: $N8N_API_KEY"';
