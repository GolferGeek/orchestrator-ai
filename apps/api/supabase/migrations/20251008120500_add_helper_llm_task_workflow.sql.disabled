-- Migration: Add n8n workflow - Helper: LLM Task
-- Source: n8n export (recreated after db reset)
-- Workflow ID: 9jxl03jCcqg17oOy
-- Description: Reusable helper workflow for multi-provider LLM requests (OpenAI, Ollama, Anthropic)
-- Trigger: Execute Workflow (internal only)
-- Created: 2025-10-08 12:05:00 UTC

INSERT INTO n8n.n8n_workflows (
  id,
  name,
  active,
  nodes,
  connections,
  settings,
  created_at,
  updated_at
)
SELECT
  '9jxl03jCcqg17oOy'::uuid,
  'Helper: LLM Task',
  false, -- Execute Workflow Trigger doesn't need to be active
  nodes::jsonb,
  connections::jsonb,
  settings::jsonb,
  NOW(),
  NOW()
FROM (
  SELECT
    pg_read_file('/tmp/helper-llm-task-export.json')::json->'nodes' as nodes,
    pg_read_file('/tmp/helper-llm-task-export.json')::json->'connections' as connections,
    pg_read_file('/tmp/helper-llm-task-export.json')::json->'settings' as settings
) AS workflow_data
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  nodes = EXCLUDED.nodes,
  connections = EXCLUDED.connections,
  settings = EXCLUDED.settings,
  updated_at = EXCLUDED.updated_at
WHERE n8n.n8n_workflows.updated_at < EXCLUDED.updated_at;

-- Track migration metadata
INSERT INTO n8n.migration_metadata (migration_file, source, workflow_id, notes)
VALUES (
  '20251008120500_add_helper_llm_task_workflow.sql',
  'n8n-export',
  '9jxl03jCcqg17oOy'::uuid,
  'Multi-provider LLM helper workflow - Supports OpenAI, Ollama, and Anthropic with optional status updates'
)
ON CONFLICT (migration_file) DO NOTHING;
