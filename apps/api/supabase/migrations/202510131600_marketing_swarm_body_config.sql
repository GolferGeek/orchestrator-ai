-- Migration: Add request body configuration to Marketing Swarm agent
-- Date: 2025-10-13
-- Description: Configure the Marketing Swarm agent's webhook body with proper template variables

UPDATE agents
SET yaml = jsonb_set(
    yaml::jsonb,
    '{configuration,api,body}',
    '{
        "taskId": "{{payload.taskId}}",
        "conversationId": "{{conversationId}}",
        "userId": "{{metadata.userId}}",
        "announcement": "{{userMessage}}",
        "statusWebHook": "http://localhost:7100/webhooks/status",
        "provider": "{{payload.llmSelection.provider}}",
        "model": "{{payload.llmSelection.model}}"
    }'::jsonb,
    true
)::text,
updated_at = NOW()
WHERE slug = 'marketing-swarm' AND organization_slug = 'demo';

