-- Cleanup Migration: Demo User Admin Role & Remove Unwanted Models
-- This migration handles two cleanup tasks:
-- 1. Make demo user at playground.com an admin
-- 2. Remove Deep Seek 70B and GPT OSS 120B models that keep getting re-added

-- Task 1: Update demo user to be admin
-- Find and update the demo user to have admin role
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'demo.user@playground.com';

-- Also update any user profile record if it exists (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        UPDATE public.user_profiles 
        SET role = 'admin',
            updated_at = NOW()
        WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = 'demo.user@playground.com'
        );
    END IF;
END $$;

-- Task 2: Remove unwanted models that keep getting re-added
-- Remove Deep Seek 70B and GPT OSS 120B model entries from usage tables first (due to foreign keys)
DELETE FROM public.llm_usage 
WHERE model_name ILIKE '%deep%seek%70b%' 
   OR model_name ILIKE '%deepseek%70b%'
   OR model_name ILIKE '%deep-seek-70b%'
   OR model_name ILIKE '%gpt%oss%120b%'
   OR model_name ILIKE '%gpt-oss-120b%'
   OR model_name ILIKE '%gptoss120b%';

-- Also remove from backup table if they exist there
DELETE FROM public.llm_usage_backup 
WHERE model_name ILIKE '%deep%seek%70b%' 
   OR model_name ILIKE '%deepseek%70b%'
   OR model_name ILIKE '%deep-seek-70b%'
   OR model_name ILIKE '%gpt%oss%120b%'
   OR model_name ILIKE '%gpt-oss-120b%'
   OR model_name ILIKE '%gptoss120b%';

-- Now remove the actual model definitions from llm_models table
DELETE FROM public.llm_models 
WHERE model_name ILIKE '%deep%seek%70b%' 
   OR model_name ILIKE '%deepseek%70b%'
   OR model_name ILIKE '%deep-seek-70b%'
   OR model_name ILIKE '%gpt%oss%120b%'
   OR model_name ILIKE '%gpt-oss-120b%'
   OR model_name ILIKE '%gptoss120b%'
   OR model_name = 'deepseek-r1:70b'
   OR model_name = 'gpt-oss:120b';

-- Log the cleanup actions
DO $$
DECLARE
    demo_user_count INTEGER;
    deleted_usage_count INTEGER;
    deleted_backup_count INTEGER;
BEGIN
    -- Check if demo user was found and updated
    SELECT COUNT(*) INTO demo_user_count 
    FROM auth.users 
    WHERE email = 'demo.user@playground.com' 
      AND raw_app_meta_data->>'role' = 'admin';
    
    -- Get count of deleted records (this is approximate since DELETE already happened)
    GET DIAGNOSTICS deleted_usage_count = ROW_COUNT;
    
    -- Log results
    RAISE NOTICE 'Cleanup Migration Results:';
    RAISE NOTICE '- Demo users updated to admin: %', demo_user_count;
    RAISE NOTICE '- Unwanted model records cleaned up';
    RAISE NOTICE 'Migration completed successfully';
END $$;
