-- Seed file to create demo users in auth system
-- This runs after migrations and ensures demo users exist for development

-- Create demo user in auth.users table
-- Note: This uses Supabase's internal auth functions
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
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    'authenticated',
    'authenticated',
    'demo.user@playground.com',
    crypt('demouser', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding identity record
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
    '{"sub": "b29a590e-b07f-49df-a25b-574c956b5035", "email": "demo.user@playground.com", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Update the public.users table to match the auth user ID and give admin roles
UPDATE public.users 
SET id = 'b29a590e-b07f-49df-a25b-574c956b5035',
    roles = '["user", "admin"]'::jsonb
WHERE email = 'demo.user@playground.com';

-- Verify the setup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo.user@playground.com') AND
       EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.user@playground.com') THEN
        RAISE NOTICE 'Demo user successfully created in both auth.users and public.users';
    ELSE
        RAISE WARNING 'Demo user creation may have failed - check both tables';
    END IF;
END $$;
