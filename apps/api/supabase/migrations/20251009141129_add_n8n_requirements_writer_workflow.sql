-- Migration: Add N8N Requirements Writer Workflow
-- This migration stores metadata about the N8N Requirements Writer workflow
-- for integration with OrchestratorAI

-- Create table to track N8N workflows integrated with OrchestratorAI
CREATE TABLE IF NOT EXISTS public.n8n_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    n8n_workflow_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    webhook_path TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    agent_type TEXT NOT NULL, -- 'engineering', 'marketing', etc.
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'error'
    workflow_config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    last_execution_at TIMESTAMPTZ,
    execution_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_n8n_workflows_n8n_id ON public.n8n_workflows(n8n_workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workflows_agent ON public.n8n_workflows(agent_type, agent_name);
CREATE INDEX IF NOT EXISTS idx_n8n_workflows_webhook ON public.n8n_workflows(webhook_path);
CREATE INDEX IF NOT EXISTS idx_n8n_workflows_status ON public.n8n_workflows(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_n8n_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_n8n_workflows_updated_at
    BEFORE UPDATE ON public.n8n_workflows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_n8n_workflows_updated_at();

-- Insert Requirements Writer workflow metadata
INSERT INTO public.n8n_workflows (
    n8n_workflow_id,
    name,
    description,
    webhook_path,
    webhook_url,
    agent_type,
    agent_name,
    status,
    workflow_config,
    metadata
) VALUES (
    'ZW2pecdLbpoyyY0B',
    'Requirements Writer Agent',
    'N8N-based Requirements Writer agent that generates comprehensive requirements documents including PRDs, TRDs, API specs, user stories, architecture docs, and general requirements. Replaces the TypeScript function-based agent with a visual N8N workflow.',
    'requirements',
    'http://localhost:5678/webhook/requirements',
    'engineering',
    'requirements_writer',
    'inactive',
    '{
        "nodes": [
            {
                "id": "webhook1",
                "name": "Requirements Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 2,
                "position": [240, 300],
                "description": "Receives POST requests with requirements to generate documents"
            },
            {
                "id": "code1",
                "name": "Generate Requirements",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [460, 300],
                "description": "Generates comprehensive requirements document using JavaScript template"
            },
            {
                "id": "respond1",
                "name": "Respond to Webhook",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1,
                "position": [680, 300],
                "description": "Returns JSON response with document and metadata"
            }
        ],
        "connections": {
            "Requirements Webhook": {
                "main": [[{"node": "Generate Requirements", "type": "main", "index": 0}]]
            },
            "Generate Requirements": {
                "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
            }
        },
        "settings": {
            "executionOrder": "v1",
            "timezone": "America/Chicago",
            "saveDataErrorExecution": "all",
            "saveDataSuccessExecution": "all"
        }
    }'::JSONB,
    '{
        "implementation": "n8n",
        "original_agent": "TypeScript function-based",
        "comparison": {
            "features": "100% feature parity",
            "advantages": [
                "Visual workflow management",
                "Built-in monitoring",
                "Better scalability",
                "Easy maintenance"
            ]
        },
        "document_types": [
            "prd",
            "trd",
            "api",
            "user_story",
            "architecture",
            "general"
        ],
        "workflow_steps": [
            "analyze_request",
            "determine_document_type",
            "extract_features",
            "assess_complexity",
            "generate_document",
            "finalize_response"
        ],
        "capabilities": [
            "requirements_writing",
            "technical_documentation",
            "user_story_creation",
            "api_specification",
            "system_architecture",
            "document_generation",
            "complexity_analysis",
            "feature_extraction"
        ],
        "created_via": "mcp",
        "created_at": "2025-10-09T14:04:37.770Z",
        "version": "1.0.0"
    }'::JSONB
) ON CONFLICT (n8n_workflow_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    webhook_path = EXCLUDED.webhook_path,
    webhook_url = EXCLUDED.webhook_url,
    agent_type = EXCLUDED.agent_type,
    agent_name = EXCLUDED.agent_name,
    workflow_config = EXCLUDED.workflow_config,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Create table for N8N workflow execution logs
CREATE TABLE IF NOT EXISTS public.n8n_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.n8n_workflows(id) ON DELETE CASCADE,
    n8n_execution_id TEXT,
    status TEXT NOT NULL, -- 'success', 'error', 'running'
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    execution_time_ms INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Create indexes for execution logs
CREATE INDEX IF NOT EXISTS idx_n8n_executions_workflow ON public.n8n_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_status ON public.n8n_workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_n8n_executions_started ON public.n8n_workflow_executions(started_at DESC);

-- Enable Row Level Security
ALTER TABLE public.n8n_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for n8n_workflows
CREATE POLICY "Allow authenticated users to read workflows"
    ON public.n8n_workflows
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role full access to workflows"
    ON public.n8n_workflows
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Create RLS policies for n8n_workflow_executions
CREATE POLICY "Allow authenticated users to read execution logs"
    ON public.n8n_workflow_executions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role full access to execution logs"
    ON public.n8n_workflow_executions
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.n8n_workflows TO authenticated;
GRANT SELECT ON public.n8n_workflow_executions TO authenticated;
GRANT ALL ON public.n8n_workflows TO service_role;
GRANT ALL ON public.n8n_workflow_executions TO service_role;

-- Add helpful comments
COMMENT ON TABLE public.n8n_workflows IS 'Tracks N8N workflows integrated with OrchestratorAI agents';
COMMENT ON COLUMN public.n8n_workflows.n8n_workflow_id IS 'N8N workflow ID from the N8N instance';
COMMENT ON COLUMN public.n8n_workflows.webhook_path IS 'Webhook path (e.g., "requirements")';
COMMENT ON COLUMN public.n8n_workflows.webhook_url IS 'Full webhook URL (e.g., "http://localhost:5678/webhook/requirements")';
COMMENT ON COLUMN public.n8n_workflows.agent_type IS 'Agent category (engineering, marketing, etc.)';
COMMENT ON COLUMN public.n8n_workflows.agent_name IS 'Specific agent name (e.g., "requirements_writer")';
COMMENT ON COLUMN public.n8n_workflows.workflow_config IS 'N8N workflow configuration (nodes, connections, settings)';
COMMENT ON COLUMN public.n8n_workflows.metadata IS 'Additional metadata (capabilities, document types, etc.)';

COMMENT ON TABLE public.n8n_workflow_executions IS 'Logs of N8N workflow executions for monitoring and debugging';
COMMENT ON COLUMN public.n8n_workflow_executions.n8n_execution_id IS 'N8N execution ID from the N8N instance';
COMMENT ON COLUMN public.n8n_workflow_executions.execution_time_ms IS 'Execution time in milliseconds';

