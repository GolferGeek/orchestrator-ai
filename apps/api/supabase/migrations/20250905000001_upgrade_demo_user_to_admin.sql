-- Upgrade demo.user@playground.com to admin role
-- This enables full access to LLM admin components and privacy admin panels for demo purposes

-- Update the demo user to have admin privileges
UPDATE public.users 
SET 
    roles = '["user","admin"]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'demo.user@playground.com';

-- Verify the update was successful
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE email = 'demo.user@playground.com' 
        AND roles @> '["admin"]'::jsonb
    ) THEN
        RAISE EXCEPTION 'Failed to upgrade demo.user@playground.com to admin role';
    END IF;
    
    RAISE NOTICE 'Successfully upgraded demo.user@playground.com to admin role';
END $$;
