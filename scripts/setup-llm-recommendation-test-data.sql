-- Setup test data for LLM recommendations endpoint
-- This creates sample evaluations for the marketing_swarm agent using existing models

-- Use existing conversation or create one
DO $$
DECLARE
    conv_id UUID;
BEGIN
    SELECT id INTO conv_id FROM conversations WHERE user_id = 'b29a590e-b07f-49df-a25b-574c956b5035' LIMIT 1;

    IF conv_id IS NULL THEN
        INSERT INTO conversations (id, user_id, created_at, updated_at)
        VALUES (gen_random_uuid(), 'b29a590e-b07f-49df-a25b-574c956b5035', NOW(), NOW())
        RETURNING id INTO conv_id;
    END IF;

    -- Create sample tasks with evaluations for marketing_swarm agent
    INSERT INTO tasks (
        id,
        user_id,
        conversation_id,
        prompt,
        response,
        status,
        created_at,
        updated_at,
        evaluation,
        llm_metadata,
        response_metadata
    )
    VALUES
        -- High-rated ollama/gpt-oss:20b evaluations
        (
            gen_random_uuid(),
            'b29a590e-b07f-49df-a25b-574c956b5035',
            conv_id,
        'Create marketing campaign for product launch',
        'Here is your marketing campaign...',
        'completed',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days',
        jsonb_build_object(
            'user_rating', 5,
            'speed_rating', 4,
            'accuracy_rating', 5,
            'user_notes', 'Excellent campaign strategy',
            'evaluation_timestamp', (NOW() - INTERVAL '4 days')::text
        ),
        jsonb_build_object(
            'model_name', 'ollama/gpt-oss:20b',
            'provider', 'ollama',
            'response_time_ms', 1200,
            'total_cost', 0.002
        ),
        jsonb_build_object(
            'agent_name', 'marketing_swarm',
            'agent_identifier', 'marketing_swarm'
        )
    ),
    (
        gen_random_uuid(),
        'b29a590e-b07f-49df-a25b-574c956b5035',
        conv_id,
        'Generate social media content strategy',
        'Social media strategy generated...',
        'completed',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days',
        jsonb_build_object(
            'user_rating', 4,
            'speed_rating', 5,
            'accuracy_rating', 4,
            'evaluation_timestamp', (NOW() - INTERVAL '2 days')::text
        ),
        jsonb_build_object(
            'model_name', 'ollama/gpt-oss:20b',
            'provider', 'ollama',
            'response_time_ms', 800,
            'total_cost', 0.0015
        ),
        jsonb_build_object(
            'agent_name', 'marketing_swarm',
            'agent_identifier', 'marketing_swarm'
        )
    ),
    (
        gen_random_uuid(),
        'b29a590e-b07f-49df-a25b-574c956b5035',
        conv_id,
        'Create email marketing templates',
        'Email templates created...',
        'completed',
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '1 day',
        jsonb_build_object(
            'user_rating', 5,
            'speed_rating', 5,
            'accuracy_rating', 5,
            'user_notes', 'Perfect templates!',
            'evaluation_timestamp', NOW()::text
        ),
        jsonb_build_object(
            'model_name', 'ollama/gpt-oss:20b',
            'provider', 'ollama',
            'response_time_ms', 950,
            'total_cost', 0.0018
        ),
        jsonb_build_object(
            'agent_name', 'marketing_swarm',
            'agent_identifier', 'marketing_swarm'
        )
    );
END $$;

-- Verify the data
SELECT
    response_metadata->>'agent_name' as agent,
    llm_metadata->>'model_name' as model,
    evaluation->>'user_rating' as rating,
    COUNT(*) as count
FROM tasks
WHERE evaluation IS NOT NULL
    AND response_metadata->>'agent_name' = 'marketing_swarm'
GROUP BY 1, 2, 3
ORDER BY 2, 3 DESC;