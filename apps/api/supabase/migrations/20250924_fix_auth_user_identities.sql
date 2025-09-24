-- Migration: Fix missing email provider identities for auth users
-- Date: 2025-09-24
-- Purpose: Add missing identity records with email provider for users that were created without them

-- Add email provider identities for users that don't have them
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    u.id as user_id,
    jsonb_build_object(
        'sub', u.id::text,
        'email', u.email,
        'email_verified', COALESCE(u.email_confirmed_at IS NOT NULL, false)
    ) as identity_data,
    'email' as provider,
    u.id::text as provider_id,  -- Use user ID as provider_id for email provider
    u.last_sign_in_at,
    u.created_at,
    NOW() as updated_at
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id AND i.provider = 'email'
WHERE i.id IS NULL
  AND u.email IS NOT NULL;

-- Update raw_user_meta_data to include provider if missing
UPDATE auth.users
SET raw_user_meta_data =
    CASE
        WHEN raw_user_meta_data IS NULL THEN
            jsonb_build_object('provider', 'email')
        WHEN NOT raw_user_meta_data ? 'provider' THEN
            raw_user_meta_data || jsonb_build_object('provider', 'email')
        ELSE
            raw_user_meta_data
    END
WHERE id IN (
    SELECT u.id
    FROM auth.users u
    JOIN auth.identities i ON u.id = i.user_id
    WHERE i.provider = 'email'
      AND (u.raw_user_meta_data IS NULL OR NOT u.raw_user_meta_data ? 'provider')
);

-- Reset password for demo user to match expected test password
UPDATE auth.users
SET
    encrypted_password = crypt('DemoUser123!', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'demo.user@orchestratorai.io';

-- Also reset password for golfergeek user if needed
UPDATE auth.users
SET
    encrypted_password = crypt('DemoUser123!', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'golfergeek@gmail.com';

-- Add namespaceAccess to user metadata for proper multi-namespace support
UPDATE auth.users
SET
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('namespaceAccess', '["demo", "my-org"]'::jsonb),
    updated_at = NOW()
WHERE email = 'demo.user@orchestratorai.io';

UPDATE auth.users
SET
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('namespaceAccess', '["demo", "my-org"]'::jsonb),
    updated_at = NOW()
WHERE email = 'golfergeek@gmail.com';

-- Verify the changes
DO $$
DECLARE
    users_without_identity INT;
    users_without_provider INT;
    users_with_password INT;
BEGIN
    SELECT COUNT(*) INTO users_without_identity
    FROM auth.users u
    LEFT JOIN auth.identities i ON u.id = i.user_id AND i.provider = 'email'
    WHERE u.email IS NOT NULL AND i.id IS NULL;

    SELECT COUNT(*) INTO users_without_provider
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND (u.raw_user_meta_data IS NULL OR NOT u.raw_user_meta_data ? 'provider');

    SELECT COUNT(*) INTO users_with_password
    FROM auth.users u
    WHERE u.email IN ('demo.user@orchestratorai.io', 'golfergeek@gmail.com')
      AND u.encrypted_password IS NOT NULL;

    IF users_without_identity > 0 THEN
        RAISE WARNING 'Still have % users without email identity', users_without_identity;
    END IF;

    IF users_without_provider > 0 THEN
        RAISE WARNING 'Still have % users without provider in metadata', users_without_provider;
    END IF;

    IF users_with_password != 2 THEN
        RAISE WARNING 'Not all test users have passwords set';
    END IF;

    RAISE NOTICE 'Migration completed. All email users should now have identity records and passwords.';
END $$;