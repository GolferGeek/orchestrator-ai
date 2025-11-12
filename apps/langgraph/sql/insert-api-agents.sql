-- Auto-generated SQL from JSON agent files
-- Generated: 2025-11-05T12:52:43.915Z
-- Source: storage/snapshots/agents/
-- 
-- ⚠️  THIS FILE IS AUTO-GENERATED - DO NOT EDIT MANUALLY ⚠️
-- 
-- Workflow:
--   1. Edit JSON files in: storage/snapshots/agents/
--   2. Regenerate SQL: npm run db:generate-sql-from-json apps/langgraph/sql/insert-api-agents.sql
--   3. Import to database: npm run db:import-langgraph-agents
-- 
-- Or skip SQL and import directly from JSON:
--   npm run db:import-langgraph-agents

-- 1. Marketing Swarm (LangGraph) (marketing-swarm-langgraph)
INSERT INTO agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    version,
    status,
    yaml,
    context
) VALUES (
    'demo',
    'marketing-swarm-langgraph',
    'Marketing Swarm (LangGraph)',
    'Generate comprehensive marketing content using LangGraph workflow. Creates blog posts, SEO-optimized content, and social media posts for product announcements.',
    'api',
    'build',
    '1.0.0',
    'active',
    '{\n    "metadata": {\n        "name": "marketing-swarm-langgraph",\n        "displayName": "Marketing Swarm (LangGraph)",\n        "description": "Generate comprehensive marketing content using LangGraph workflow",\n        "version": "1.0.0",\n        "type": "api",\n        "department": "marketing"\n    },\n    "configuration": {\n        "api": {\n            "endpoint": "http://localhost:7200/workflows/marketing-swarm",\n            "method": "POST",\n            "headers": {\n                "Content-Type": "application/json"\n            },\n            "body": {\n                "taskId": "{{taskId}}",\n                "conversationId": "{{conversationId}}",\n                "userId": "{{userId}}",\n                "prompt": "{{userMessage}}",\n                "provider": "{{llmSelection.providerName}}",\n                "model": "{{llmSelection.modelName}}",\n                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}"\n            },\n            "authentication": {\n                "type": "none"\n            },\n            "response_mapping": {\n                "status_field": "success",\n                "result_field": "data"\n            },\n            "timeout": 180000\n        },\n        "deliverable": {\n            "format": "json",\n            "type": "marketing-campaign"\n        },\n        "execution_capabilities": {\n            "supports_converse": false,\n            "supports_plan": false,\n            "supports_build": true\n        }\n    }\n}',
    '{"input_modes":["application/json"],"output_modes":["application/json"],"supported_modes":["build"],"execution_modes":["immediate","polling","websocket"]}'::jsonb
) ON CONFLICT (organization_slug, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    yaml = EXCLUDED.yaml,
    updated_at = now();

-- 2. Metrics Agent (LangGraph) (metrics-agent-langgraph)
INSERT INTO agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    version,
    status,
    yaml,
    context
) VALUES (
    'demo',
    'metrics-agent-langgraph',
    'Metrics Agent (LangGraph)',
    'Analyze business metrics and generate data-driven insights using LangGraph workflow. Queries KPI database and creates comprehensive reports with trends and recommendations.',
    'api',
    'build',
    '1.0.0',
    'active',
    '{\n    "metadata": {\n        "name": "metrics-agent-langgraph",\n        "displayName": "Metrics Agent (LangGraph)",\n        "description": "Analyze business metrics and generate data-driven insights using LangGraph workflow",\n        "version": "1.0.0",\n        "type": "api",\n        "department": "finance"\n    },\n    "configuration": {\n        "api": {\n            "endpoint": "http://localhost:7200/workflows/metrics-agent",\n            "method": "POST",\n            "headers": {\n                "Content-Type": "application/json"\n            },\n            "body": {\n                "taskId": "{{taskId}}",\n                "conversationId": "{{conversationId}}",\n                "userId": "{{userId}}",\n                "prompt": "{{userMessage}}",\n                "provider": "{{llmSelection.providerName}}",\n                "model": "{{llmSelection.modelName}}",\n                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}"\n            },\n            "authentication": {\n                "type": "none"\n            },\n            "response_mapping": {\n                "status_field": "success",\n                "result_field": "data"\n            },\n            "timeout": 120000\n        },\n        "deliverable": {\n            "format": "markdown",\n            "type": "metrics-report"\n        },\n        "execution_capabilities": {\n            "supports_converse": false,\n            "supports_plan": false,\n            "supports_build": true\n        }\n    }\n}',
    '{"input_modes":["application/json"],"output_modes":["application/json","text/markdown"],"supported_modes":["build"],"execution_modes":["immediate","polling","websocket"]}'::jsonb
) ON CONFLICT (organization_slug, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    yaml = EXCLUDED.yaml,
    updated_at = now();

-- 3. Requirements Writer (LangGraph) (requirements-writer-langgraph)
INSERT INTO agents (
    organization_slug,
    slug,
    display_name,
    description,
    agent_type,
    mode_profile,
    version,
    status,
    yaml,
    context
) VALUES (
    'demo',
    'requirements-writer-langgraph',
    'Requirements Writer (LangGraph)',
    'Transform ideas into professional requirements documents using LangGraph workflow. Creates PRDs, TRDs, API docs, user stories, or architecture documents with AI-powered analysis.',
    'api',
    'build',
    '1.0.0',
    'active',
    '{\n    "metadata": {\n        "name": "requirements-writer-langgraph",\n        "displayName": "Requirements Writer (LangGraph)",\n        "description": "Transform ideas into professional requirements documents using LangGraph workflow",\n        "version": "1.0.0",\n        "type": "api",\n        "department": "engineering"\n    },\n    "configuration": {\n        "api": {\n            "endpoint": "http://localhost:7200/workflows/requirements-writer",\n            "method": "POST",\n            "headers": {\n                "Content-Type": "application/json"\n            },\n            "body": {\n                "taskId": "{{taskId}}",\n                "conversationId": "{{conversationId}}",\n                "userId": "{{userId}}",\n                "prompt": "{{userMessage}}",\n                "provider": "{{llmSelection.providerName}}",\n                "model": "{{llmSelection.modelName}}",\n                "statusWebhook": "{{env.WEBHOOK_STATUS_URL}}?taskId={{taskId}}",\n                "metadata": "{{payload.metadata}}"\n            },\n            "authentication": {\n                "type": "none"\n            },\n            "response_mapping": {\n                "status_field": "success",\n                "result_field": "data"\n            },\n            "timeout": 240000\n        },\n        "deliverable": {\n            "format": "markdown",\n            "type": "requirements-document"\n        },\n        "execution_capabilities": {\n            "supports_converse": false,\n            "supports_plan": false,\n            "supports_build": true\n        }\n    }\n}',
    '{"input_modes":["application/json"],"output_modes":["application/json","text/markdown"],"supported_modes":["build"],"execution_modes":["immediate","polling","websocket"]}'::jsonb
) ON CONFLICT (organization_slug, slug) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    yaml = EXCLUDED.yaml,
    updated_at = now();

-- Verify the inserts
SELECT organization_slug, slug, display_name, agent_type, status FROM agents
WHERE slug IN ('marketing-swarm-langgraph', 'metrics-agent-langgraph', 'requirements-writer-langgraph')
ORDER BY slug;
