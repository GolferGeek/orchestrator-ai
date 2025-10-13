-- Migration: Create global image orchestrator with proper hierarchy
-- Date: 2025-10-13
-- Description: Move image orchestrator and generators to global namespace with proper hierarchy configs

-- Step 1: Delete old my-org image agents (these are the old versions)
DELETE FROM public.agents 
WHERE organization_slug = 'my-org' 
AND slug IN ('image_orchestrator', 'image_openai_generator', 'image_google_generator');

-- Step 2: Move demo image agents to global namespace
UPDATE public.agents
SET organization_slug = 'global',
    updated_at = NOW()
WHERE organization_slug = 'demo'
AND slug IN ('image-orchestrator', 'image-generator-openai', 'image-generator-google');

-- Step 3: Add hierarchy config to image-generator-openai
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"reports_to": "image-orchestrator", "level": "specialist", "department": "images"}'::jsonb
),
    updated_at = NOW()
WHERE slug = 'image-generator-openai'
AND organization_slug = 'global';

-- Step 4: Add hierarchy config to image-generator-google
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"reports_to": "image-orchestrator", "level": "specialist", "department": "images"}'::jsonb
),
    updated_at = NOW()
WHERE slug = 'image-generator-google'
AND organization_slug = 'global';

-- Step 5: Ensure image-orchestrator has proper hierarchy config
UPDATE public.agents
SET config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{hierarchy}',
    '{"level": "orchestrator", "department": "images", "team": ["image-generator-openai", "image-generator-google"]}'::jsonb
),
    updated_at = NOW()
WHERE slug = 'image-orchestrator'
AND organization_slug = 'global';

-- Verify the migration
DO $$
DECLARE
    global_image_count INTEGER;
    demo_image_count INTEGER;
    myorg_image_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO global_image_count 
    FROM public.agents 
    WHERE organization_slug = 'global' 
    AND slug IN ('image-orchestrator', 'image-generator-openai', 'image-generator-google');
    
    SELECT COUNT(*) INTO demo_image_count 
    FROM public.agents 
    WHERE organization_slug = 'demo' 
    AND slug IN ('image-orchestrator', 'image-generator-openai', 'image-generator-google');
    
    SELECT COUNT(*) INTO myorg_image_count 
    FROM public.agents 
    WHERE organization_slug = 'my-org' 
    AND slug IN ('image_orchestrator', 'image_openai_generator', 'image_google_generator');

    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Global image agents: % (expected: 3)', global_image_count;
    RAISE NOTICE '  - Demo image agents remaining: % (expected: 0)', demo_image_count;
    RAISE NOTICE '  - My-org image agents remaining: % (expected: 0)', myorg_image_count;

    IF global_image_count != 3 THEN
        RAISE WARNING 'Expected 3 global image agents, found %', global_image_count;
    END IF;
    
    IF demo_image_count > 0 THEN
        RAISE WARNING 'Still have % image agents in demo namespace', demo_image_count;
    END IF;
    
    IF myorg_image_count > 0 THEN
        RAISE WARNING 'Still have % image agents in my-org namespace', myorg_image_count;
    END IF;
END $$;

