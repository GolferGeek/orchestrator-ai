-- Migration: Reset demo user password to DemoUser123!
-- Created: 2025-10-14
-- Purpose: Fix demo user login credentials for testing

BEGIN;

-- Update demo user password using Supabase's crypt function
UPDATE auth.users
SET
  encrypted_password = crypt('DemoUser123!', gen_salt('bf')),
  updated_at = NOW()
WHERE email = 'demo.user@orchestratorai.io';

-- Verify the update
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count
  FROM auth.users
  WHERE email = 'demo.user@orchestratorai.io';

  IF user_count = 0 THEN
    RAISE EXCEPTION 'Demo user not found after password reset';
  END IF;

  RAISE NOTICE 'Demo user password reset successfully';
END $$;

COMMIT;
