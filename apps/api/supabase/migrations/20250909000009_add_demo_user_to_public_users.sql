-- Add demo.user@playground.com to public.users table to match the auth user
-- This ensures the user exists in both auth.users and public.users tables

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
    '30a4ba3d-83c1-4fff-a0d6-1640d35aae44',  -- Match the auth.users ID
    'demo.user@playground.com',
    'Demo User',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    false,
    'UTC',
    'en-US',
    'active',
    '["user"]'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = CURRENT_TIMESTAMP;

-- Verify the user was created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.user@playground.com') THEN
        RAISE NOTICE 'Successfully created/updated demo.user@playground.com in public.users table';
    ELSE
        RAISE EXCEPTION 'Failed to create demo.user@playground.com in public.users table';
    END IF;
END $$;
