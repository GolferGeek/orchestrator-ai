-- Migration: Create Marketing Manager orchestrator with team
-- Date: 2025-10-13
-- Description: Copy blog_post_writer and requirements-specialist from my-org to demo,
--              create Marketing Manager orchestrator, and set up hierarchy

-- Step 1: Copy blog_post_writer from my-org to demo
INSERT INTO public.agents (
    slug,
    display_name,
    description,
    agent_type,
    organization_slug,
    status,
    mode_profile,
    yaml,
    config,
    created_at,
    updated_at
)
SELECT 
    slug,
    display_name,
    description,
    agent_type,
    'demo' as organization_slug,
    status,
    mode_profile,
    yaml,
    jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{hierarchy}',
        '{"reports_to": "marketing-manager", "level": "specialist", "department": "marketing"}'::jsonb,
        true
    ) as config,
    NOW() as created_at,
    NOW() as updated_at
FROM public.agents
WHERE organization_slug = 'my-org' 
AND slug = 'blog_post_writer'
ON CONFLICT (slug, organization_slug) DO UPDATE SET
    yaml = EXCLUDED.yaml,
    config = jsonb_set(
        COALESCE(agents.config, '{}'::jsonb),
        '{hierarchy}',
        '{"reports_to": "marketing-manager", "level": "specialist", "department": "marketing"}'::jsonb,
        true
    ),
    updated_at = NOW();

-- Step 2: Copy requirements-specialist from my-org to demo
INSERT INTO public.agents (
    slug,
    display_name,
    description,
    agent_type,
    organization_slug,
    status,
    mode_profile,
    yaml,
    config,
    created_at,
    updated_at
)
SELECT 
    slug,
    display_name,
    description,
    agent_type,
    'demo' as organization_slug,
    status,
    mode_profile,
    yaml,
    jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{hierarchy}',
        '{"reports_to": "marketing-manager", "level": "specialist", "department": "marketing"}'::jsonb,
        true
    ) as config,
    NOW() as created_at,
    NOW() as updated_at
FROM public.agents
WHERE organization_slug = 'my-org' 
AND slug = 'requirements-specialist'
ON CONFLICT (slug, organization_slug) DO UPDATE SET
    yaml = EXCLUDED.yaml,
    config = jsonb_set(
        COALESCE(agents.config, '{}'::jsonb),
        '{hierarchy}',
        '{"reports_to": "marketing-manager", "level": "specialist", "department": "marketing"}'::jsonb,
        true
    ),
    updated_at = NOW();

-- Step 3: Create Marketing Manager orchestrator in demo
INSERT INTO public.agents (
    slug,
    display_name,
    description,
    agent_type,
    organization_slug,
    status,
    mode_profile,
    yaml,
    config,
    created_at,
    updated_at
)
VALUES (
    'marketing-manager',
    'Marketing Manager',
    'Marketing orchestrator that coordinates blog writing, requirements gathering, and marketing campaigns',
    'orchestrator',
    'demo',
    'active',
    'orchestrator_full',
    '{"metadata": {"name": "marketing-manager", "displayName": "Marketing Manager", "description": "Marketing orchestrator that coordinates blog writing, requirements gathering, and marketing campaigns", "version": "0.1.0", "type": "orchestrator", "tags": ["marketing", "orchestrator", "multi-agent"]}, "capabilities": ["converse", "plan", "build", "delegate"], "communication": {"input_modes": ["text/plain"], "output_modes": ["text/markdown", "application/json"]}}'::jsonb,
    '{"hierarchy": {"level": "orchestrator", "team": ["blog_post_writer", "requirements-specialist", "marketing-swarm"], "department": "marketing"}}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (slug, organization_slug) DO UPDATE SET
    agent_type = 'orchestrator',
    mode_profile = 'orchestrator_full',
    yaml = '{"metadata": {"name": "marketing-manager", "displayName": "Marketing Manager", "description": "Marketing orchestrator that coordinates blog writing, requirements gathering, and marketing campaigns", "version": "0.1.0", "type": "orchestrator", "tags": ["marketing", "orchestrator", "multi-agent"]}, "capabilities": ["converse", "plan", "build", "delegate"], "communication": {"input_modes": ["text/plain"], "output_modes": ["text/markdown", "application/json"]}}'::jsonb,
    config = jsonb_set(
        COALESCE(agents.config, '{}'::jsonb),
        '{hierarchy}',
        '{"level": "orchestrator", "team": ["blog_post_writer", "requirements-specialist", "marketing-swarm"], "department": "marketing"}'::jsonb,
        true
    ),
    updated_at = NOW();

-- Step 4: Update marketing-swarm to report to Marketing Manager
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"reports_to": "marketing-manager", "level": "specialist", "department": "marketing"}'::jsonb,
    true
),
    updated_at = NOW()
WHERE slug = 'marketing-swarm'
AND organization_slug = 'demo';

-- Verification
DO $$
DECLARE
    marketing_manager_count INTEGER;
    team_members_count INTEGER;
BEGIN
    -- Check Marketing Manager exists as orchestrator
    SELECT COUNT(*) INTO marketing_manager_count
    FROM agents
    WHERE slug = 'marketing-manager'
    AND organization_slug = 'demo'
    AND agent_type = 'orchestrator';
    
    -- Check team members have reports_to
    SELECT COUNT(*) INTO team_members_count
    FROM agents
    WHERE organization_slug = 'demo'
    AND slug IN ('blog_post_writer', 'requirements-specialist', 'marketing-swarm')
    AND config->'hierarchy'->>'reports_to' = 'marketing-manager';
    
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Marketing Manager orchestrators: % (expected: 1)', marketing_manager_count;
    RAISE NOTICE '  - Team members reporting to Marketing Manager: % (expected: 3)', team_members_count;
END $$;

