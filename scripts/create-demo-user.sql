-- Quick script to create demo user in both auth.users and public.users
-- Run this anytime the demo user is missing without doing a full database reset

-- First, try to create the auth user (will fail silently if exists)
-- Note: This uses Supabase's signup API instead of direct SQL for proper password hashing

-- Create/update the public.users record
INSERT INTO public.users (
    id, 
    email, 
    display_name, 
    created_at, 
    updated_at, 
    phone_verified, 
    timezone, 
    locale, 
    status, 
    roles
) VALUES (
    'b29a590e-b07f-49df-a25b-574c956b5035',  -- Fixed UUID for consistency
    'demo.user@playground.com',
    'Demo User',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    false,
    'UTC',
    'en-US',
    'active',
    '["user", "admin"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP
ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP;

-- Verify both users exist
DO $$
DECLARE
    auth_exists boolean;
    public_exists boolean;
BEGIN
    -- Check auth.users
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'demo.user@playground.com') INTO auth_exists;
    
    -- Check public.users  
    SELECT EXISTS(SELECT 1 FROM public.users WHERE email = 'demo.user@playground.com') INTO public_exists;
    
    IF auth_exists AND public_exists THEN
        RAISE NOTICE '✅ Demo user exists in both auth.users and public.users';
    ELSIF auth_exists AND NOT public_exists THEN
        RAISE NOTICE '⚠️  Demo user exists in auth.users but missing from public.users';
    ELSIF NOT auth_exists AND public_exists THEN
        RAISE NOTICE '⚠️  Demo user exists in public.users but missing from auth.users - use Supabase signup API';
    ELSE
        RAISE NOTICE '❌ Demo user missing from both tables - use Supabase signup API first';
    END IF;
END $$;
