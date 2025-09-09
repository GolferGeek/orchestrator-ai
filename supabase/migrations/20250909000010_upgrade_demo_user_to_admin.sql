-- Upgrade demo.user@playground.com to have both user and admin roles
-- This ensures the demo user has full access to admin screens

UPDATE public.users 
SET roles = '["user", "admin"]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'demo.user@playground.com';

-- Verify the upgrade
DO $$
DECLARE
    user_roles jsonb;
BEGIN
    SELECT roles INTO user_roles 
    FROM public.users 
    WHERE email = 'demo.user@playground.com';
    
    IF user_roles ? 'admin' AND user_roles ? 'user' THEN
        RAISE NOTICE '✅ Successfully upgraded demo.user@playground.com to admin role';
        RAISE NOTICE 'User roles: %', user_roles;
    ELSE
        RAISE WARNING '⚠️  Failed to upgrade demo.user@playground.com - current roles: %', user_roles;
    END IF;
END $$;
