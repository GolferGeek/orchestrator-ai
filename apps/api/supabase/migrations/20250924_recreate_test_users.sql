-- Migration: Recreate test users with proper configuration
-- Date: 2025-09-24
-- Purpose: Remove and recreate demo.user@orchestratorai.io and golfergeek@gmail.com with correct settings

-- First, delete existing users and their identities
DELETE FROM auth.identities WHERE user_id IN (
    SELECT id FROM auth.users WHERE email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com')
);

DELETE FROM auth.users WHERE email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com');

-- Create demo.user@orchestratorai.io with only demo namespace access
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'demo.user@orchestratorai.io',
    crypt('DemoUser123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
        'provider', 'email',
        'display_name', 'Demo User',
        'namespaceAccess', ARRAY['demo']
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Create golfergeek@gmail.com with demo and my-org namespace access
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'golfergeek@gmail.com',
    crypt('GolferGeek123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
        'provider', 'email',
        'display_name', 'GolferGeek',
        'namespaceAccess', ARRAY['demo', 'my-org']
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
);

-- Create identity records for both users
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id as user_id,
    jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', true
    ) as identity_data,
    'email' as provider,
    u.id::text as provider_id,
    NOW() as last_sign_in_at,
    NOW() as created_at,
    NOW() as updated_at
FROM auth.users u
WHERE u.email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com');

-- Verify the users were created correctly
DO $$
DECLARE
    demo_user_count INT;
    golfer_user_count INT;
    demo_namespaces TEXT[];
    golfer_namespaces TEXT[];
BEGIN
    -- Check demo user
    SELECT COUNT(*),
           ARRAY_AGG(raw_user_meta_data->'namespaceAccess')
    INTO demo_user_count, demo_namespaces
    FROM auth.users
    WHERE email = 'demo.user@orchestratorai.io'
    GROUP BY email;

    -- Check golfergeek user
    SELECT COUNT(*),
           ARRAY_AGG(raw_user_meta_data->'namespaceAccess')
    INTO golfer_user_count, golfer_namespaces
    FROM auth.users
    WHERE email = 'golfergeek@gmail.com'
    GROUP BY email;

    IF demo_user_count != 1 THEN
        RAISE WARNING 'Demo user not created properly';
    ELSE
        RAISE NOTICE 'Demo user created with namespaces: %', demo_namespaces[1];
    END IF;

    IF golfer_user_count != 1 THEN
        RAISE WARNING 'GolferGeek user not created properly';
    ELSE
        RAISE NOTICE 'GolferGeek user created with namespaces: %', golfer_namespaces[1];
    END IF;

    -- Verify identities exist
    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'demo.user@orchestratorai.io')) THEN
        RAISE WARNING 'Demo user identity not created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'golfergeek@gmail.com')) THEN
        RAISE WARNING 'GolferGeek user identity not created';
    END IF;

    RAISE NOTICE 'Migration completed. Test users recreated with proper configuration.';
END $$;