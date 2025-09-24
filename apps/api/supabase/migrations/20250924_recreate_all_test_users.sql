-- Migration: Recreate all test users with proper configuration
-- Date: 2025-09-24
-- Purpose: Delete all existing users and recreate them with proper auth setup

-- First, delete all existing users from public.users
DELETE FROM public.users;

-- Delete all identities
DELETE FROM auth.identities;

-- Delete all auth users
DELETE FROM auth.users;

-- ============================================================================
-- CREATE DEMO.USER@ORCHESTRATORAI.IO (demo namespace only, admin + user roles)
-- ============================================================================

-- Create demo user in auth.users table
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_user_meta_data
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    'authenticated',
    'authenticated',
    'demo.user@orchestratorai.io',
    extensions.crypt('DemoUser123!', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    jsonb_build_object(
        'provider', 'email',
        'namespaceAccess', ARRAY['demo']
    )
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding identity record for demo user
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    '2f1ee5e9-cae2-4f66-a1e0-bd2c02a11321',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    '{"sub": "b29a590e-b07f-49df-a25b-574c956b5035", "email": "demo.user@orchestratorai.io", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create the demo user in public.users table
INSERT INTO public.users (id, email, display_name, roles, namespace_access)
VALUES (
    'b29a590e-b07f-49df-a25b-574c956b5035',
    'demo.user@orchestratorai.io',
    'Demo User',
    '["user", "admin"]'::jsonb,
    '["demo"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    roles = EXCLUDED.roles,
    namespace_access = EXCLUDED.namespace_access;

-- ============================================================================
-- CREATE GOLFERGEEK@GMAIL.COM (demo + my-org namespaces, admin + user roles)
-- ============================================================================

-- Create golfergeek user in auth.users table
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_user_meta_data
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a123e4b7-8c9d-4e5f-b6a7-9d8c7e6f5a4b',
    'authenticated',
    'authenticated',
    'golfergeek@gmail.com',
    extensions.crypt('GolferGeek123!', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    jsonb_build_object(
        'provider', 'email',
        'namespaceAccess', ARRAY['demo', 'my-org']
    )
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding identity record for golfergeek
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    '3a2b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    'a123e4b7-8c9d-4e5f-b6a7-9d8c7e6f5a4b',
    '{"sub": "a123e4b7-8c9d-4e5f-b6a7-9d8c7e6f5a4b", "email": "golfergeek@gmail.com", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'a123e4b7-8c9d-4e5f-b6a7-9d8c7e6f5a4b',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create the golfergeek user in public.users table
INSERT INTO public.users (id, email, display_name, roles, namespace_access)
VALUES (
    'a123e4b7-8c9d-4e5f-b6a7-9d8c7e6f5a4b',
    'golfergeek@gmail.com',
    'GolferGeek',
    '["user", "admin"]'::jsonb,
    '["demo", "my-org"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    roles = EXCLUDED.roles,
    namespace_access = EXCLUDED.namespace_access;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    auth_user_count INTEGER;
    identity_count INTEGER;
    public_user_count INTEGER;
BEGIN
    -- Count users in each table
    SELECT COUNT(*) INTO auth_user_count FROM auth.users
    WHERE email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com');

    SELECT COUNT(*) INTO identity_count FROM auth.identities
    WHERE user_id IN (
        SELECT id FROM auth.users
        WHERE email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com')
    );

    SELECT COUNT(*) INTO public_user_count FROM public.users
    WHERE email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com');

    -- Report results
    IF auth_user_count = 2 AND identity_count = 2 AND public_user_count = 2 THEN
        RAISE NOTICE 'Success: Both users created in all required tables';

        -- Show namespace access for verification
        RAISE NOTICE 'demo.user@orchestratorai.io namespaces: %',
            (SELECT namespace_access FROM public.users WHERE email = 'demo.user@orchestratorai.io');
        RAISE NOTICE 'golfergeek@gmail.com namespaces: %',
            (SELECT namespace_access FROM public.users WHERE email = 'golfergeek@gmail.com');
    ELSE
        RAISE WARNING 'User creation incomplete. Auth users: %, Identities: %, Public users: %',
            auth_user_count, identity_count, public_user_count;
    END IF;
END $$;