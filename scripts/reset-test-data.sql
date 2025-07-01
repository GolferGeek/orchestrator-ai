-- Reset Test Data Script
-- This script safely removes test data while preserving the schema
-- Useful for resetting the database during development and testing

-- Start transaction to ensure atomicity
BEGIN;

-- Display current state before cleanup
DO $$
DECLARE
    msg_count INTEGER;
    user_prefs_count INTEGER;
    custom_cmd_count INTEGER;
    metrics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO msg_count FROM public.messages;
    SELECT COUNT(*) INTO user_prefs_count FROM public.user_preferences;
    SELECT COUNT(*) INTO custom_cmd_count FROM public.cidafm_commands WHERE is_builtin = false;
    SELECT COUNT(*) INTO metrics_count FROM public.model_performance_metrics;
    
    RAISE NOTICE 'Current database state:';
    RAISE NOTICE '- Total messages: %', msg_count;
    RAISE NOTICE '- User preferences: %', user_prefs_count;
    RAISE NOTICE '- Custom CIDAFM commands: %', custom_cmd_count;
    RAISE NOTICE '- Performance metrics: %', metrics_count;
END $$;

-- Remove test data in dependency order
RAISE NOTICE 'Removing test data...';

-- Remove message CIDAFM usage (depends on messages)
DELETE FROM public.message_cidafm_usage 
WHERE message_id IN (
    SELECT id FROM public.messages 
    WHERE user_id IN (
        '11111111-aaaa-bbbb-cccc-111111111111',
        '22222222-aaaa-bbbb-cccc-222222222222',
        '33333333-aaaa-bbbb-cccc-333333333333'
    )
);

-- Remove test messages
DELETE FROM public.messages 
WHERE user_id IN (
    '11111111-aaaa-bbbb-cccc-111111111111',
    '22222222-aaaa-bbbb-cccc-222222222222',
    '33333333-aaaa-bbbb-cccc-333333333333'
);

-- Remove test user preferences
DELETE FROM public.user_preferences 
WHERE user_id IN (
    '11111111-aaaa-bbbb-cccc-111111111111',
    '22222222-aaaa-bbbb-cccc-222222222222',
    '33333333-aaaa-bbbb-cccc-333333333333'
);

-- Remove test API keys
DELETE FROM public.user_api_keys 
WHERE user_id IN (
    '11111111-aaaa-bbbb-cccc-111111111111',
    '22222222-aaaa-bbbb-cccc-222222222222',
    '33333333-aaaa-bbbb-cccc-333333333333'
);

-- Remove custom CIDAFM commands created by test users
DELETE FROM public.cidafm_commands 
WHERE user_id IN (
    '11111111-aaaa-bbbb-cccc-111111111111',
    '22222222-aaaa-bbbb-cccc-222222222222',
    '33333333-aaaa-bbbb-cccc-333333333333'
) AND is_builtin = false;

-- Remove all performance metrics (these are synthetic test data)
DELETE FROM public.model_performance_metrics;

-- Drop test views
DROP VIEW IF EXISTS public.test_user_summaries;
DROP VIEW IF EXISTS public.test_model_popularity;

-- Vacuum to reclaim space
VACUUM ANALYZE public.messages;
VACUUM ANALYZE public.user_preferences;
VACUUM ANALYZE public.cidafm_commands;
VACUUM ANALYZE public.model_performance_metrics;

-- Display final state
DO $$
DECLARE
    msg_count INTEGER;
    user_prefs_count INTEGER;
    custom_cmd_count INTEGER;
    metrics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO msg_count FROM public.messages;
    SELECT COUNT(*) INTO user_prefs_count FROM public.user_preferences;
    SELECT COUNT(*) INTO custom_cmd_count FROM public.cidafm_commands WHERE is_builtin = false;
    SELECT COUNT(*) INTO metrics_count FROM public.model_performance_metrics;
    
    RAISE NOTICE 'Database state after cleanup:';
    RAISE NOTICE '- Total messages: %', msg_count;
    RAISE NOTICE '- User preferences: %', user_prefs_count;
    RAISE NOTICE '- Custom CIDAFM commands: %', custom_cmd_count;
    RAISE NOTICE '- Performance metrics: %', metrics_count;
    RAISE NOTICE 'Test data cleanup completed successfully!';
END $$;

-- Commit the transaction
COMMIT;

-- Optional: Reset sequences if needed
-- This ensures that new records get clean IDs starting from expected values
-- Uncomment if you want to reset auto-incrementing sequences

-- SELECT setval(pg_get_serial_sequence('public.messages', 'id'), 1, false);
-- SELECT setval(pg_get_serial_sequence('public.user_preferences', 'id'), 1, false);
-- SELECT setval(pg_get_serial_sequence('public.cidafm_commands', 'id'), 1, false);