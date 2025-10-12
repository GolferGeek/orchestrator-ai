-- Migration: Move global agents to demo organization
-- Date: 2025-10-12
-- Description: For simplicity, all global agents are now assigned to demo organization
--              instead of using multi-tenant inheritance logic.

-- Move all agents with organization_slug = 'global' to 'demo'
UPDATE public.agents
SET organization_slug = 'demo',
    updated_at = NOW()
WHERE organization_slug = 'global';

-- Verify the migration
DO $$
DECLARE
    global_count INTEGER;
    demo_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO global_count FROM public.agents WHERE organization_slug = 'global';
    SELECT COUNT(*) INTO demo_count FROM public.agents WHERE organization_slug = 'demo';

    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Global agents remaining: %', global_count;
    RAISE NOTICE '  - Demo agents now: %', demo_count;

    IF global_count > 0 THEN
        RAISE WARNING 'Still have % agents with organization_slug = global', global_count;
    END IF;
END $$;
