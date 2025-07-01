-- Seed test data for LLM evaluation system
-- This migration creates realistic test data for development and testing purposes

-- Insert test user data (using realistic test UUIDs)
-- Note: In production, users will be managed by Supabase Auth
DO $$
DECLARE
    test_user_1 UUID := '11111111-aaaa-bbbb-cccc-111111111111';
    test_user_2 UUID := '22222222-aaaa-bbbb-cccc-222222222222';
    test_user_3 UUID := '33333333-aaaa-bbbb-cccc-333333333333';
    
    -- Provider and model UUIDs from previous seed
    openai_provider UUID := '11111111-1111-1111-1111-111111111111';
    anthropic_provider UUID := '22222222-2222-2222-2222-222222222222';
    google_provider UUID := '33333333-3333-3333-3333-333333333333';
    
    gpt4o_model UUID;
    gpt4o_mini_model UUID;
    claude35_sonnet_model UUID;
    claude35_haiku_model UUID;
    gemini_pro_model UUID;
    gemini_flash_model UUID;
BEGIN
    -- Get model UUIDs (they're auto-generated, so we need to fetch them)
    SELECT id INTO gpt4o_model FROM public.models WHERE model_id = 'gpt-4o' LIMIT 1;
    SELECT id INTO gpt4o_mini_model FROM public.models WHERE model_id = 'gpt-4o-mini' LIMIT 1;
    SELECT id INTO claude35_sonnet_model FROM public.models WHERE model_id = 'claude-3-5-sonnet-20241022' LIMIT 1;
    SELECT id INTO claude35_haiku_model FROM public.models WHERE model_id = 'claude-3-5-haiku-20241022' LIMIT 1;
    SELECT id INTO gemini_pro_model FROM public.models WHERE model_id = 'gemini-1.5-pro' LIMIT 1;
    SELECT id INTO gemini_flash_model FROM public.models WHERE model_id = 'gemini-1.5-flash' LIMIT 1;

    -- Insert sample messages with realistic usage patterns
    -- User 1: Heavy GPT-4o user with mixed results
    INSERT INTO public.messages (user_id, provider_id, model_id, user_message, assistant_response, input_tokens, output_tokens, total_cost, response_time_ms, user_rating, speed_rating, accuracy_rating, timestamp) VALUES
    -- Recent conversations (last 7 days)
    (test_user_1, openai_provider, gpt4o_model, 'Explain quantum computing', 'Quantum computing is a revolutionary computing paradigm that leverages quantum mechanical phenomena...', 3, 152, 0.00158, 1450, 5, 4, 5, NOW() - INTERVAL '1 hour'),
    (test_user_1, openai_provider, gpt4o_model, '^concise What are the benefits of microservices?', 'Microservices offer: 1) Independent scaling 2) Technology diversity 3) Fault isolation 4) Faster deployment...', 8, 89, 0.00109, 1200, 4, 4, 4, NOW() - INTERVAL '2 hours'),
    (test_user_1, openai_provider, gpt4o_mini_model, 'Write a Python function to calculate fibonacci', 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)', 9, 45, 0.00028, 800, 5, 5, 5, NOW() - INTERVAL '1 day'),
    (test_user_1, openai_provider, gpt4o_model, '&professional Please review this code for security issues', 'Upon reviewing the provided code, I have identified several security concerns that require immediate attention...', 12, 248, 0.00252, 1890, 4, 3, 5, NOW() - INTERVAL '2 days'),
    (test_user_1, openai_provider, gpt4o_mini_model, '^bullet-points List the main features of React', '• Component-based architecture\n• Virtual DOM for performance\n• Unidirectional data flow\n• Rich ecosystem...', 8, 67, 0.00041, 950, 4, 5, 4, NOW() - INTERVAL '3 days'),
    
    -- Older conversations (2-4 weeks ago)
    (test_user_1, openai_provider, gpt4o_model, 'Explain machine learning algorithms', 'Machine learning algorithms can be broadly categorized into supervised, unsupervised, and reinforcement learning...', 5, 312, 0.00315, 2100, 5, 3, 5, NOW() - INTERVAL '2 weeks'),
    (test_user_1, anthropic_provider, claude35_sonnet_model, 'Help me design a database schema for an e-commerce site', 'I''ll help you design a comprehensive database schema for an e-commerce platform. Here''s a normalized approach...', 15, 456, 0.00685, 1650, 4, 4, 4, NOW() - INTERVAL '3 weeks'),
    
    -- User 2: Cost-conscious user preferring cheaper models
    (test_user_2, openai_provider, gpt4o_mini_model, 'What is the difference between REST and GraphQL?', 'REST and GraphQL are both API design paradigms with distinct approaches...', 10, 145, 0.00089, 1100, 4, 4, 4, NOW() - INTERVAL '30 minutes'),
    (test_user_2, google_provider, gemini_flash_model, '^beginner-friendly Explain what is Docker', 'Docker is like a shipping container for your applications. Just as shipping containers...', 8, 123, 0.00037, 750, 5, 5, 4, NOW() - INTERVAL '4 hours'),
    (test_user_2, anthropic_provider, claude35_haiku_model, 'Help me write a simple todo app in JavaScript', 'Here''s a simple todo app using vanilla JavaScript...', 12, 234, 0.00177, 980, 4, 4, 4, NOW() - INTERVAL '1 day'),
    (test_user_2, google_provider, gemini_flash_model, '&friendly Can you explain async/await in JavaScript?', 'Hey there! I''d be happy to explain async/await in JavaScript in a friendly way...', 9, 198, 0.00061, 820, 5, 5, 5, NOW() - INTERVAL '2 days'),
    (test_user_2, openai_provider, gpt4o_mini_model, 'What are the best practices for code reviews?', 'Effective code reviews are essential for maintaining code quality. Here are key best practices...', 11, 167, 0.00102, 1050, 4, 4, 4, NOW() - INTERVAL '1 week'),
    (test_user_2, google_provider, gemini_pro_model, 'Analyze this large CSV file and provide insights', 'I''ll analyze your CSV file systematically. Based on the data patterns I observe...', 25, 387, 0.00483, 1750, 4, 3, 4, NOW() - INTERVAL '2 weeks'),
    
    -- User 3: Researcher using high-end models for complex tasks
    (test_user_3, anthropic_provider, claude35_sonnet_model, 'Analyze the implications of quantum supremacy on current cryptography standards', 'Quantum supremacy represents a pivotal moment in computational history with profound implications for cryptography...', 18, 567, 0.00852, 2200, 5, 3, 5, NOW() - INTERVAL '1 hour'),
    (test_user_3, openai_provider, gpt4o_model, '&technical ^detailed Explain the Byzantine Generals Problem and its solutions', 'The Byzantine Generals Problem is a fundamental challenge in distributed computing that models the difficulty of achieving consensus...', 15, 678, 0.00678, 2450, 5, 2, 5, NOW() - INTERVAL '6 hours'),
    (test_user_3, anthropic_provider, claude35_sonnet_model, 'Compare and contrast different consensus algorithms in blockchain', 'Consensus algorithms form the backbone of blockchain networks, each with distinct trade-offs...', 12, 445, 0.00668, 1950, 4, 3, 5, NOW() - INTERVAL '1 day'),
    (test_user_3, google_provider, gemini_pro_model, '!step-by-step Break down the process of implementing a neural network from scratch', 'I''ll break down neural network implementation into manageable steps. Let me start with Step 1...', 16, 234, 0.00292, 1400, 5, 4, 5, NOW() - INTERVAL '3 days'),
    (test_user_3, openai_provider, gpt4o_model, 'Research the latest developments in quantum error correction', 'Recent advances in quantum error correction have shown promising developments across several key areas...', 8, 534, 0.00534, 2800, 4, 2, 5, NOW() - INTERVAL '1 week');

    -- Insert sample CIDAFM usage patterns for the messages
    -- User 1 primarily uses response modifiers
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type) 
    SELECT m.id, 'concise', '^' 
    FROM public.messages m 
    WHERE m.user_id = test_user_1 AND m.user_message LIKE '%^concise%';
    
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'professional', '&'
    FROM public.messages m 
    WHERE m.user_id = test_user_1 AND m.user_message LIKE '%&professional%';
    
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'bullet-points', '^'
    FROM public.messages m 
    WHERE m.user_id = test_user_1 AND m.user_message LIKE '%^bullet-points%';
    
    -- User 2 uses beginner-friendly and friendly modifiers
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'beginner-friendly', '^'
    FROM public.messages m 
    WHERE m.user_id = test_user_2 AND m.user_message LIKE '%^beginner-friendly%';
    
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'friendly', '&'
    FROM public.messages m 
    WHERE m.user_id = test_user_2 AND m.user_message LIKE '%&friendly%';
    
    -- User 3 uses technical and detailed modifiers, plus execution commands
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'technical', '&'
    FROM public.messages m 
    WHERE m.user_id = test_user_3 AND m.user_message LIKE '%&technical%';
    
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'detailed', '^'
    FROM public.messages m 
    WHERE m.user_id = test_user_3 AND m.user_message LIKE '%^detailed%';
    
    INSERT INTO public.message_cidafm_usage (message_id, command_name, command_type)
    SELECT m.id, 'step-by-step', '!'
    FROM public.messages m 
    WHERE m.user_id = test_user_3 AND m.user_message LIKE '%!step-by-step%';

END $$;

-- Insert some sample user preferences
INSERT INTO public.user_preferences (user_id, preferred_provider_id, preferred_model_id, default_temperature, default_max_tokens, active_cidafm_commands, created_at) VALUES
-- User 1: Prefers OpenAI GPT-4o with professional settings
('11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 
 (SELECT id FROM public.models WHERE model_id = 'gpt-4o' LIMIT 1), 
 0.7, 2000, ARRAY['professional', 'concise'], NOW() - INTERVAL '1 month'),

-- User 2: Prefers cost-effective models with friendly tone
('22222222-aaaa-bbbb-cccc-222222222222', '33333333-3333-3333-3333-333333333333',
 (SELECT id FROM public.models WHERE model_id = 'gemini-1.5-flash' LIMIT 1),
 0.8, 1500, ARRAY['friendly', 'beginner-friendly'], NOW() - INTERVAL '3 weeks'),

-- User 3: Prefers high-capability models for research
('33333333-aaaa-bbbb-cccc-333333333333', '22222222-2222-2222-2222-222222222222',
 (SELECT id FROM public.models WHERE model_id = 'claude-3-5-sonnet-20241022' LIMIT 1),
 0.5, 4000, ARRAY['technical', 'detailed'], NOW() - INTERVAL '2 months');

-- Insert sample API keys/credentials (encrypted/hashed in real usage)
-- Note: These are dummy values for testing
INSERT INTO public.user_api_keys (user_id, provider_id, encrypted_api_key, key_name, is_active, created_at) VALUES
('11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'encrypted_dummy_openai_key_user1', 'My OpenAI Key', true, NOW() - INTERVAL '1 month'),
('11111111-aaaa-bbbb-cccc-111111111111', '22222222-2222-2222-2222-222222222222', 'encrypted_dummy_anthropic_key_user1', 'Anthropic Research', true, NOW() - INTERVAL '3 weeks'),

('22222222-aaaa-bbbb-cccc-222222222222', '33333333-3333-3333-3333-333333333333', 'encrypted_dummy_google_key_user2', 'Google Gemini', true, NOW() - INTERVAL '2 weeks'),
('22222222-aaaa-bbbb-cccc-222222222222', '11111111-1111-1111-1111-111111111111', 'encrypted_dummy_openai_key_user2', 'OpenAI Personal', true, NOW() - INTERVAL '1 week'),

('33333333-aaaa-bbbb-cccc-333333333333', '22222222-2222-2222-2222-222222222222', 'encrypted_dummy_anthropic_key_user3', 'Claude Research', true, NOW() - INTERVAL '2 months'),
('33333333-aaaa-bbbb-cccc-333333333333', '11111111-1111-1111-1111-111111111111', 'encrypted_dummy_openai_key_user3', 'OpenAI o1 Access', true, NOW() - INTERVAL '1 month'),
('33333333-aaaa-bbbb-cccc-333333333333', '33333333-3333-3333-3333-333333333333', 'encrypted_dummy_google_key_user3', 'Gemini Pro Large Context', true, NOW() - INTERVAL '3 weeks');

-- Insert some custom CIDAFM commands created by users
INSERT INTO public.cidafm_commands (type, name, description, user_id, is_builtin, is_active) VALUES
-- User 1 custom commands
('^', 'executive-summary', 'Provide a brief executive summary suitable for business stakeholders', '11111111-aaaa-bbbb-cccc-111111111111', false, true),
('&', 'corporate-tone', 'Use formal corporate communication style with business terminology', '11111111-aaaa-bbbb-cccc-111111111111', false, true),

-- User 2 custom commands  
('^', 'eli5', 'Explain like I''m 5 years old - use very simple language and analogies', '22222222-aaaa-bbbb-cccc-222222222222', false, true),
('&', 'encouraging', 'Be supportive and encouraging, especially for learning scenarios', '22222222-aaaa-bbbb-cccc-222222222222', false, true),

-- User 3 custom commands
('^', 'research-paper-style', 'Structure response like an academic research paper with citations', '33333333-aaaa-bbbb-cccc-333333333333', false, true),
('&', 'peer-review-mode', 'Provide critical analysis as if conducting academic peer review', '33333333-aaaa-bbbb-cccc-333333333333', false, true),
('!', 'literature-search', 'Search for and reference relevant academic literature on the topic', '33333333-aaaa-bbbb-cccc-333333333333', false, true);

-- Insert some model performance tracking data
-- This would normally be calculated from actual usage, but we'll seed some realistic values
DO $$
DECLARE
    test_date DATE;
    i INTEGER;
BEGIN
    -- Create daily performance metrics for the last 30 days
    FOR i IN 0..29 LOOP
        test_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        -- GPT-4o performance metrics
        INSERT INTO public.model_performance_metrics (model_id, date, total_requests, total_tokens, total_cost, avg_response_time, avg_user_rating, avg_speed_rating, avg_accuracy_rating) 
        VALUES (
            (SELECT id FROM public.models WHERE model_id = 'gpt-4o' LIMIT 1),
            test_date,
            FLOOR(RANDOM() * 50 + 10)::INTEGER, -- 10-60 requests per day
            FLOOR(RANDOM() * 15000 + 5000)::INTEGER, -- 5k-20k tokens per day
            ROUND((RANDOM() * 5 + 1)::NUMERIC, 4), -- $1-6 per day
            FLOOR(RANDOM() * 1000 + 1000)::INTEGER, -- 1000-2000ms response time
            ROUND((RANDOM() * 1.5 + 3.5)::NUMERIC, 1), -- 3.5-5.0 user rating
            ROUND((RANDOM() * 1.5 + 3.0)::NUMERIC, 1), -- 3.0-4.5 speed rating
            ROUND((RANDOM() * 1.0 + 4.0)::NUMERIC, 1) -- 4.0-5.0 accuracy rating
        );
        
        -- GPT-4o-mini performance metrics (higher volume, lower cost)
        INSERT INTO public.model_performance_metrics (model_id, date, total_requests, total_tokens, total_cost, avg_response_time, avg_user_rating, avg_speed_rating, avg_accuracy_rating)
        VALUES (
            (SELECT id FROM public.models WHERE model_id = 'gpt-4o-mini' LIMIT 1),
            test_date,
            FLOOR(RANDOM() * 100 + 50)::INTEGER, -- 50-150 requests per day
            FLOOR(RANDOM() * 20000 + 10000)::INTEGER, -- 10k-30k tokens per day
            ROUND((RANDOM() * 1.5 + 0.5)::NUMERIC, 4), -- $0.5-2 per day
            FLOOR(RANDOM() * 500 + 500)::INTEGER, -- 500-1000ms response time
            ROUND((RANDOM() * 1.0 + 3.5)::NUMERIC, 1), -- 3.5-4.5 user rating
            ROUND((RANDOM() * 1.0 + 4.0)::NUMERIC, 1), -- 4.0-5.0 speed rating
            ROUND((RANDOM() * 1.0 + 3.8)::NUMERIC, 1) -- 3.8-4.8 accuracy rating
        );
        
        -- Claude 3.5 Sonnet performance metrics
        INSERT INTO public.model_performance_metrics (model_id, date, total_requests, total_tokens, total_cost, avg_response_time, avg_user_rating, avg_speed_rating, avg_accuracy_rating)
        VALUES (
            (SELECT id FROM public.models WHERE model_id = 'claude-3-5-sonnet-20241022' LIMIT 1),
            test_date,
            FLOOR(RANDOM() * 30 + 15)::INTEGER, -- 15-45 requests per day
            FLOOR(RANDOM() * 12000 + 8000)::INTEGER, -- 8k-20k tokens per day  
            ROUND((RANDOM() * 3 + 2)::NUMERIC, 4), -- $2-5 per day
            FLOOR(RANDOM() * 800 + 1200)::INTEGER, -- 1200-2000ms response time
            ROUND((RANDOM() * 1.0 + 4.0)::NUMERIC, 1), -- 4.0-5.0 user rating
            ROUND((RANDOM() * 1.0 + 3.5)::NUMERIC, 1), -- 3.5-4.5 speed rating
            ROUND((RANDOM() * 0.8 + 4.2)::NUMERIC, 1) -- 4.2-5.0 accuracy rating
        );
        
        -- Gemini Flash performance metrics (very high volume, very low cost)
        INSERT INTO public.model_performance_metrics (model_id, date, total_requests, total_tokens, total_cost, avg_response_time, avg_user_rating, avg_speed_rating, avg_accuracy_rating)
        VALUES (
            (SELECT id FROM public.models WHERE model_id = 'gemini-1.5-flash' LIMIT 1),
            test_date,
            FLOOR(RANDOM() * 200 + 100)::INTEGER, -- 100-300 requests per day
            FLOOR(RANDOM() * 30000 + 20000)::INTEGER, -- 20k-50k tokens per day
            ROUND((RANDOM() * 0.8 + 0.2)::NUMERIC, 4), -- $0.2-1 per day
            FLOOR(RANDOM() * 300 + 400)::INTEGER, -- 400-700ms response time
            ROUND((RANDOM() * 1.0 + 3.8)::NUMERIC, 1), -- 3.8-4.8 user rating
            ROUND((RANDOM() * 0.5 + 4.5)::NUMERIC, 1), -- 4.5-5.0 speed rating
            ROUND((RANDOM() * 1.0 + 3.5)::NUMERIC, 1) -- 3.5-4.5 accuracy rating
        );
    END LOOP;
END $$;

-- Create some usage summary views for testing
CREATE OR REPLACE VIEW public.test_user_summaries AS
SELECT 
    u.user_id,
    COUNT(m.id) as total_messages,
    SUM(m.input_tokens + m.output_tokens) as total_tokens,
    SUM(m.total_cost) as total_cost,
    AVG(m.response_time_ms) as avg_response_time,
    AVG(m.user_rating) as avg_user_rating,
    MIN(m.timestamp) as first_message,
    MAX(m.timestamp) as last_message
FROM (
    SELECT DISTINCT user_id FROM public.messages WHERE user_id IN (
        '11111111-aaaa-bbbb-cccc-111111111111',
        '22222222-aaaa-bbbb-cccc-222222222222', 
        '33333333-aaaa-bbbb-cccc-333333333333'
    )
) u
LEFT JOIN public.messages m ON u.user_id = m.user_id
GROUP BY u.user_id;

-- Create a view for model popularity testing
CREATE OR REPLACE VIEW public.test_model_popularity AS
SELECT 
    p.name as provider_name,
    m.name as model_name,
    m.model_id,
    COUNT(msg.id) as usage_count,
    SUM(msg.total_cost) as total_revenue,
    AVG(msg.user_rating) as avg_rating,
    AVG(msg.response_time_ms) as avg_response_time
FROM public.models m
JOIN public.providers p ON m.provider_id = p.id
LEFT JOIN public.messages msg ON m.id = msg.model_id
GROUP BY p.name, m.name, m.model_id
ORDER BY usage_count DESC;

-- Grant appropriate permissions
GRANT SELECT ON public.test_user_summaries TO authenticated;
GRANT SELECT ON public.test_user_summaries TO service_role;
GRANT SELECT ON public.test_model_popularity TO authenticated;
GRANT SELECT ON public.test_model_popularity TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.messages IS 'Test data includes realistic conversation patterns across 3 user types: business user, cost-conscious developer, and researcher';
COMMENT ON VIEW public.test_user_summaries IS 'Summary statistics for test users to validate analytics functionality';
COMMENT ON VIEW public.test_model_popularity IS 'Model usage statistics for testing recommendation and analytics features';
COMMENT ON TABLE public.model_performance_metrics IS 'Synthetic performance data for the last 30 days to test analytics dashboards';

-- Insert a final validation query to confirm test data integrity
DO $$
DECLARE
    message_count INTEGER;
    user_count INTEGER;
    command_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO message_count FROM public.messages WHERE user_id IN (
        '11111111-aaaa-bbbb-cccc-111111111111',
        '22222222-aaaa-bbbb-cccc-222222222222',
        '33333333-aaaa-bbbb-cccc-333333333333'
    );
    
    SELECT COUNT(DISTINCT user_id) INTO user_count FROM public.user_preferences;
    SELECT COUNT(*) INTO command_count FROM public.cidafm_commands WHERE is_builtin = false;
    
    RAISE NOTICE 'Test data seeded successfully:';
    RAISE NOTICE '- Messages: %', message_count;
    RAISE NOTICE '- Users with preferences: %', user_count;
    RAISE NOTICE '- Custom CIDAFM commands: %', command_count;
    RAISE NOTICE '- Performance metrics: % days of data', (SELECT COUNT(DISTINCT date) FROM public.model_performance_metrics);
END $$;