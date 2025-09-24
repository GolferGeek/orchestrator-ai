-- Add namespace_access column to store allowed agent namespaces per user
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS namespace_access JSONB DEFAULT '["my-org"]'::jsonb NOT NULL;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

COMMENT ON COLUMN public.users.namespace_access IS 'List of agent namespaces the user may access (e.g., ["demo","my-org"]).';

-- Seed demo accounts for initial access control testing
DO $$
DECLARE
  demo_user_id uuid;
  owner_user_id uuid;
BEGIN
  -- Ensure demo user exists in auth.users
  SELECT id INTO demo_user_id FROM auth.users WHERE email = 'demo.user@orchestratorai.io';

  IF demo_user_id IS NULL THEN
    demo_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      is_super_admin,
      created_at,
      updated_at
    )
    VALUES (
      demo_user_id,
      'demo.user@orchestratorai.io',
      crypt('DemoUser123!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('display_name', 'Demo User'),
      'authenticated',
      'authenticated',
      false,
      now(),
      now()
    );
  END IF;

  INSERT INTO public.users (
    id,
    email,
    display_name,
    role,
    roles,
    namespace_access,
    created_at,
    updated_at
  )
  VALUES (
    demo_user_id,
    'demo.user@orchestratorai.io',
    'Demo User',
    'user',
    ARRAY['user'],
    jsonb_build_array('demo'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET namespace_access = EXCLUDED.namespace_access,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        roles = EXCLUDED.roles;

  -- Ensure golfergeek account exists with demo + my-org access
  SELECT id INTO owner_user_id FROM auth.users WHERE email = 'golfergeek@gmail.com';

  IF owner_user_id IS NULL THEN
    owner_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      is_super_admin,
      created_at,
      updated_at
    )
    VALUES (
      owner_user_id,
      'golfergeek@gmail.com',
      crypt('GolferGeek123!', gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('display_name', 'Golfer Geek'),
      'authenticated',
      'authenticated',
      false,
      now(),
      now()
    );
  END IF;

  INSERT INTO public.users (
    id,
    email,
    display_name,
    role,
    roles,
    namespace_access,
    created_at,
    updated_at
  )
  VALUES (
    owner_user_id,
    'golfergeek@gmail.com',
    'Golfer Geek',
    'admin',
    ARRAY['admin'],
    jsonb_build_array('demo', 'my-org'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET namespace_access = EXCLUDED.namespace_access,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        roles = EXCLUDED.roles;
END
$$;
