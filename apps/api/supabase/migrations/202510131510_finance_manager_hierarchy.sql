-- Migration: Add hierarchy to Finance Manager orchestrator
-- Date: 2025-10-13
-- Description: Configure Data Summarizer and Supabase Agent to report to Finance Manager

-- Step 1: Add hierarchy config to Data Summarizer (summarizer)
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"reports_to": "finance-manager", "level": "specialist", "department": "finance"}'::jsonb,
    true
),
    updated_at = NOW()
WHERE slug = 'summarizer';

-- Step 2: Add hierarchy config to Supabase Database Agent (supabase-agent)
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"reports_to": "finance-manager", "level": "specialist", "department": "finance"}'::jsonb,
    true
),
    updated_at = NOW()
WHERE slug = 'supabase-agent';

-- Step 3: Add team config to Finance Manager orchestrator
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"level": "orchestrator", "team": ["summarizer", "supabase-agent"], "department": "finance"}'::jsonb,
    true
),
    updated_at = NOW()
WHERE slug = 'finance-manager';

-- Verification
DO $$
DECLARE
    finance_count INTEGER;
    team_members_count INTEGER;
BEGIN
    -- Check Finance Manager has team config
    SELECT COUNT(*) INTO finance_count
    FROM agents
    WHERE slug = 'finance-manager'
    AND config->'hierarchy'->>'level' = 'orchestrator';
    
    -- Check team members have reports_to
    SELECT COUNT(*) INTO team_members_count
    FROM agents
    WHERE slug IN ('summarizer', 'supabase-agent')
    AND config->'hierarchy'->>'reports_to' = 'finance-manager';
    
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Finance Manager orchestrators: % (expected: 1)', finance_count;
    RAISE NOTICE '  - Team members reporting to Finance Manager: % (expected: 2)', team_members_count;
END $$;

