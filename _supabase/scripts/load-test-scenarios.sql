-- Load Test Scenarios Script
-- This script loads specific test scenarios for different use cases
-- Usage: \i scripts/load-test-scenarios.sql

-- Available test scenarios:
-- 1. minimal: Basic data for smoke testing
-- 2. development: Rich data set for feature development
-- 3. performance: High-volume data for performance testing
-- 4. analytics: Diverse data for testing analytics features

-- Set the scenario type (change this to load different scenarios)
\set scenario 'development'

-- Scenario selector function
DO $$
DECLARE
    scenario_type TEXT := :'scenario';
BEGIN
    RAISE NOTICE 'Loading test scenario: %', scenario_type;
    
    CASE scenario_type
        WHEN 'minimal' THEN
            -- Minimal scenario: Just basic functionality testing
            RAISE NOTICE 'Loading minimal test data...';
            
            -- Single test user
            INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, timestamp) VALUES
            ('test-user-minimal', '11111111-1111-1111-1111-111111111111', 
             (SELECT id FROM public.models WHERE model_id = 'gpt-4o-mini' LIMIT 1),
             'Hello world', 'Hello! How can I help you today?', 2, 8, 0.0001, 500, 5, NOW());
            
            RAISE NOTICE 'Minimal scenario loaded: 1 user, 1 message';
            
        WHEN 'development' THEN
            -- Development scenario: Rich data set (this is our main test data)
            RAISE NOTICE 'Loading development test data...';
            
            -- Execute the main test data migration content
            -- (This would typically call the migration file, but for demonstration 
            -- we'll include key elements here)
            
            -- Development data includes 3 users with different usage patterns
            RAISE NOTICE 'Development scenario: Use the main test data migration (20250701100000_seed_test_data.sql)';
            
        WHEN 'performance' THEN
            -- Performance scenario: High-volume data
            RAISE NOTICE 'Loading performance test data...';
            
            -- Generate high-volume test data
            INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, timestamp)
            SELECT 
                'perf-user-' || (i % 10)::TEXT, -- 10 different users
                (ARRAY['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'])[((i % 3) + 1)], -- Rotate providers
                (SELECT id FROM public.models ORDER BY RANDOM() LIMIT 1), -- Random model
                'Performance test message ' || i::TEXT,
                'Performance test response ' || i::TEXT,
                FLOOR(RANDOM() * 100 + 10)::INTEGER, -- 10-110 input tokens
                FLOOR(RANDOM() * 200 + 50)::INTEGER, -- 50-250 output tokens
                ROUND((RANDOM() * 0.01 + 0.001)::NUMERIC, 6), -- $0.001-0.011
                FLOOR(RANDOM() * 2000 + 500)::INTEGER, -- 500-2500ms
                FLOOR(RANDOM() * 2 + 4)::INTEGER, -- 4-5 rating
                NOW() - (RANDOM() * INTERVAL '30 days') -- Random time in last 30 days
            FROM generate_series(1, 10000) AS i; -- 10,000 messages
            
            RAISE NOTICE 'Performance scenario loaded: 10 users, 10,000 messages';
            
        WHEN 'analytics' THEN
            -- Analytics scenario: Diverse data patterns for testing analytics
            RAISE NOTICE 'Loading analytics test data...';
            
            -- Create diverse usage patterns for analytics testing
            -- Different cost ranges, usage patterns, time distributions, etc.
            
            -- High-spend user
            INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, timestamp)
            SELECT 
                'analytics-high-spend',
                '11111111-1111-1111-1111-111111111111', -- OpenAI
                (SELECT id FROM public.models WHERE model_id = 'gpt-4o' LIMIT 1), -- Expensive model
                'High-cost query ' || i::TEXT,
                'Detailed expensive response ' || i::TEXT,
                FLOOR(RANDOM() * 500 + 100)::INTEGER, -- Large inputs
                FLOOR(RANDOM() * 1000 + 500)::INTEGER, -- Large outputs
                ROUND((RANDOM() * 0.1 + 0.05)::NUMERIC, 4), -- $0.05-0.15 per message
                FLOOR(RANDOM() * 3000 + 1000)::INTEGER, -- Slower responses
                5, -- Always high rating
                NOW() - (i * INTERVAL '2 hours') -- Distributed over time
            FROM generate_series(1, 50) AS i;
            
            -- Budget-conscious user  
            INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, timestamp)
            SELECT 
                'analytics-budget-user',
                '33333333-3333-3333-3333-333333333333', -- Google
                (SELECT id FROM public.models WHERE model_id = 'gemini-1.5-flash' LIMIT 1), -- Cheap model
                'Budget query ' || i::TEXT,
                'Quick response ' || i::TEXT,
                FLOOR(RANDOM() * 50 + 5)::INTEGER, -- Small inputs
                FLOOR(RANDOM() * 100 + 20)::INTEGER, -- Small outputs
                ROUND((RANDOM() * 0.002 + 0.0001)::NUMERIC, 6), -- $0.0001-0.0021 per message
                FLOOR(RANDOM() * 500 + 200)::INTEGER, -- Fast responses
                FLOOR(RANDOM() * 2 + 3)::INTEGER, -- 3-4 rating
                NOW() - (i * INTERVAL '30 minutes') -- Frequent usage
            FROM generate_series(1, 200) AS i;
            
            -- Weekend vs weekday patterns
            INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, timestamp)
            SELECT 
                'analytics-weekend-user',
                '22222222-2222-2222-2222-222222222222', -- Anthropic
                (SELECT id FROM public.models WHERE model_id = 'claude-3-5-haiku-20241022' LIMIT 1),
                'Weekend query ' || i::TEXT,
                'Weekend response ' || i::TEXT,
                FLOOR(RANDOM() * 100 + 20)::INTEGER,
                FLOOR(RANDOM() * 150 + 50)::INTEGER,
                ROUND((RANDOM() * 0.01 + 0.002)::NUMERIC, 4),
                FLOOR(RANDOM() * 1000 + 800)::INTEGER,
                FLOOR(RANDOM() * 2 + 4)::INTEGER, -- 4-5 rating
                -- Generate weekend timestamps (Saturday/Sunday)
                date_trunc('week', NOW()) + (RANDOM() * 2 + 5)::INTEGER * INTERVAL '1 day' + (RANDOM() * INTERVAL '18 hours') + INTERVAL '6 hours'
            FROM generate_series(1, 30) AS i;
            
            RAISE NOTICE 'Analytics scenario loaded: 3 user patterns, 280 messages with diverse analytics patterns';
            
        ELSE
            RAISE EXCEPTION 'Unknown scenario type: %. Available: minimal, development, performance, analytics', scenario_type;
    END CASE;
END $$;

-- Create scenario-specific views and utilities

-- View for quick scenario identification
CREATE OR REPLACE VIEW public.test_scenario_summary AS
SELECT 
    'Current loaded scenario' as description,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_messages,
    SUM(total_cost) as total_cost,
    MIN(timestamp) as earliest_message,
    MAX(timestamp) as latest_message,
    CASE 
        WHEN COUNT(*) <= 10 THEN 'minimal'
        WHEN COUNT(*) <= 100 THEN 'development' 
        WHEN COUNT(*) <= 1000 THEN 'analytics'
        ELSE 'performance'
    END as likely_scenario
FROM public.messages
WHERE user_id LIKE '%test%' OR user_id LIKE '%perf%' OR user_id LIKE '%analytics%' OR user_id LIKE '%minimal%';

-- Utility function to clean specific scenario data
CREATE OR REPLACE FUNCTION public.clean_scenario_data(scenario_pattern TEXT)
RETURNS TEXT AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.message_cidafm_usage 
    WHERE message_id IN (
        SELECT id FROM public.messages WHERE user_id LIKE scenario_pattern
    );
    
    DELETE FROM public.messages WHERE user_id LIKE scenario_pattern;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM public.user_preferences WHERE user_id LIKE scenario_pattern;
    DELETE FROM public.user_api_keys WHERE user_id LIKE scenario_pattern;
    
    RETURN 'Cleaned ' || deleted_count || ' messages for pattern: ' || scenario_pattern;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON public.test_scenario_summary TO authenticated;
GRANT SELECT ON public.test_scenario_summary TO service_role;
GRANT EXECUTE ON FUNCTION public.clean_scenario_data(TEXT) TO service_role;

-- Display loaded scenario summary
SELECT * FROM public.test_scenario_summary;

RAISE NOTICE 'Test scenario loading complete. Use "SELECT * FROM public.test_scenario_summary;" to view current state.';