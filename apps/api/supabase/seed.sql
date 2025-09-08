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

-- Verify the setup and create sample data
DO $$
DECLARE
    demo_user_id UUID := 'b29a590e-b07f-49df-a25b-574c956b5035';
    conv_id UUID;
    deliverable_id UUID;
    task_id UUID;
    usage_id UUID;
    i INTEGER;
    j INTEGER;
    d INTEGER;
BEGIN
    -- Verify demo user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo.user@playground.com') AND
       EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.user@playground.com') THEN
        RAISE NOTICE 'Demo user successfully created in both auth.users and public.users';
    ELSE
        RAISE WARNING 'Demo user creation may have failed - check both tables';
        RETURN;
    END IF;

    -- Create comprehensive sample data
    RAISE NOTICE 'Creating sample conversations, deliverables, tasks, and LLM usage data...';

    -- Create 10 sample conversations with deliverables, tasks, and LLM usage
    FOR i IN 1..10 LOOP
        -- Generate conversation ID
        conv_id := gen_random_uuid();
        
        -- Create conversation
        INSERT INTO public.agent_conversations (
            id,
            user_id,
            agent_name,
            agent_type,
            started_at,
            last_active_at,
            created_at,
            updated_at,
            metadata
        ) VALUES (
            conv_id,
            demo_user_id,
            CASE i
                WHEN 1 THEN 'Dashboard Builder Agent'
                WHEN 2 THEN 'Authentication Agent'
                WHEN 3 THEN 'Database Designer Agent'
                WHEN 4 THEN 'API Security Agent'
                WHEN 5 THEN 'Mobile UX Agent'
                WHEN 6 THEN 'Payment Integration Agent'
                WHEN 7 THEN 'Email Template Agent'
                WHEN 8 THEN 'Search Optimization Agent'
                WHEN 9 THEN 'Performance Agent'
                WHEN 10 THEN 'Security Audit Agent'
            END,
            'conversation_agent',
            NOW() - INTERVAL '1 day' * (10 - i),
            NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours',
            NOW() - INTERVAL '1 day' * (10 - i),
            NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours',
            jsonb_build_object(
                'title', CASE i
                    WHEN 1 THEN 'Build React Dashboard Component'
                    WHEN 2 THEN 'Implement User Authentication System'
                    WHEN 3 THEN 'Design Database Schema'
                    WHEN 4 THEN 'Create API Rate Limiting Strategy'
                    WHEN 5 THEN 'Develop Mobile App Navigation'
                    WHEN 6 THEN 'Setup Payment Integration'
                    WHEN 7 THEN 'Build Email Template System'
                    WHEN 8 THEN 'Implement Search Functionality'
                    WHEN 9 THEN 'Optimize Application Performance'
                    WHEN 10 THEN 'Conduct Security Audit'
                END,
                'project_type', CASE i % 3 WHEN 0 THEN 'web_app' WHEN 1 THEN 'mobile_app' ELSE 'api' END,
                'complexity', CASE i % 3 WHEN 0 THEN 'high' WHEN 1 THEN 'medium' ELSE 'low' END,
                'priority', CASE i % 3 WHEN 0 THEN 'urgent' WHEN 1 THEN 'normal' ELSE 'low' END
            )
        );

        -- Create 1 deliverable per conversation (due to unique constraint)
        FOR d IN 1..1 LOOP
            deliverable_id := gen_random_uuid();
            
            INSERT INTO public.deliverables (
                id,
                conversation_id,
                user_id,
                title,
                content,
                created_at,
                updated_at
            ) VALUES (
                deliverable_id,
                conv_id,
                demo_user_id,
                CASE i
                    WHEN 1 THEN 'Dashboard Component Specification'
                    WHEN 2 THEN 'Authentication Implementation Guide'
                    WHEN 3 THEN 'Database Schema Documentation'
                    WHEN 4 THEN 'Rate Limiting Strategy Document'
                    WHEN 5 THEN 'Mobile Navigation Wireframes'
                    WHEN 6 THEN 'Payment Integration Setup Guide'
                    WHEN 7 THEN 'Email Template Design System'
                    WHEN 8 THEN 'Search Algorithm Documentation'
                    WHEN 9 THEN 'Performance Optimization Report'
                    WHEN 10 THEN 'Security Audit Checklist'
                END,
                CASE i
                    WHEN 1 THEN 'Comprehensive specification for building a responsive React dashboard component with real-time data visualization, user interactions, and accessibility features.'
                    WHEN 2 THEN 'Step-by-step implementation guide for JWT-based authentication system with role-based access control, password reset, and session management.'
                    WHEN 3 THEN 'Complete database schema design with entity relationships, indexes, constraints, and migration strategies for scalable data architecture.'
                    WHEN 4 THEN 'Strategic document outlining API rate limiting implementation using Redis, token bucket algorithms, and graceful degradation patterns.'
                    WHEN 5 THEN 'Detailed wireframes and navigation flow for mobile application with intuitive user experience and platform-specific design patterns.'
                    WHEN 6 THEN 'Comprehensive setup guide for integrating Stripe payment processing with webhook handling, error management, and PCI compliance.'
                    WHEN 7 THEN 'Design system for responsive email templates with cross-client compatibility, dynamic content, and A/B testing capabilities.'
                    WHEN 8 THEN 'Technical documentation for implementing full-text search with Elasticsearch, relevance scoring, and performance optimization.'
                    WHEN 9 THEN 'Detailed performance analysis report with bottleneck identification, optimization recommendations, and implementation roadmap.'
                    WHEN 10 THEN 'Comprehensive security audit checklist covering OWASP top 10, penetration testing, and compliance requirements.'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '30 minutes',
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '90 minutes'
            );

        END LOOP;

        -- Create 2-4 tasks per conversation
        FOR j IN 1..(2 + (i % 3)) LOOP
            task_id := gen_random_uuid();
            
            INSERT INTO public.tasks (
                id,
                agent_conversation_id,
                user_id,
                method,
                prompt,
                response,
                status,
                started_at,
                completed_at,
                created_at,
                updated_at,
                metadata
            ) VALUES (
                task_id,
                conv_id,
                demo_user_id,
                CASE j
                    WHEN 1 THEN 'setup_project_structure'
                    WHEN 2 THEN 'implement_core_functionality'
                    WHEN 3 THEN 'add_testing_validation'
                    WHEN 4 THEN 'deploy_and_monitor'
                END,
                CASE j
                    WHEN 1 THEN 'Initialize project with proper folder structure, dependencies, and configuration files'
                    WHEN 2 THEN 'Develop the main features and business logic according to specifications'
                    WHEN 3 THEN 'Create comprehensive test suite and implement validation rules'
                    WHEN 4 THEN 'Deploy to production environment and set up monitoring systems'
                END,
                CASE j
                    WHEN 1 THEN 'Project structure initialized successfully with all required dependencies and configuration files.'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN 'Core functionality implemented and tested.' WHEN 1 THEN 'Implementation in progress...' ELSE '' END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN 'Testing suite completed with 95% coverage.' WHEN 1 THEN 'Writing tests...' ELSE '' END
                    WHEN 4 THEN ''
                END,
                CASE j
                    WHEN 1 THEN 'completed'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN 'completed' WHEN 1 THEN 'in_progress' ELSE 'pending' END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN 'completed' WHEN 1 THEN 'in_progress' ELSE 'pending' END
                    WHEN 4 THEN 'pending'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                CASE j
                    WHEN 1 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '30 minutes'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '45 minutes' ELSE NULL END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '60 minutes' ELSE NULL END
                    WHEN 4 THEN NULL
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '5 minutes',
                jsonb_build_object(
                    'title', CASE j
                        WHEN 1 THEN 'Setup project structure'
                        WHEN 2 THEN 'Implement core functionality'
                        WHEN 3 THEN 'Add testing and validation'
                        WHEN 4 THEN 'Deploy and monitor'
                    END,
                    'priority', CASE j
                        WHEN 1 THEN 'high'
                        WHEN 2 THEN 'high'
                        WHEN 3 THEN 'medium'
                        WHEN 4 THEN 'low'
                    END,
                    'estimated_hours', (j * 4) + (i % 3),
                    'complexity', CASE j WHEN 1 THEN 'low' WHEN 2 THEN 'high' ELSE 'medium' END,
                    'tags', ARRAY['development', CASE j WHEN 3 THEN 'testing' WHEN 4 THEN 'deployment' ELSE 'implementation' END]
                )
            );
        END LOOP;

        -- Create 3-5 LLM usage records per conversation
        FOR j IN 1..(3 + (i % 3)) LOOP
            usage_id := gen_random_uuid();
            
            -- Get a random model with matching provider
            WITH random_model AS (
                SELECT provider_name, model_name 
                FROM public.llm_models 
                ORDER BY random() 
                LIMIT 1 
                OFFSET ((i + j) % (SELECT COUNT(*) FROM public.llm_models))
            )
            INSERT INTO public.llm_usage (
                id,
                run_id,
                conversation_id,
                user_id,
                provider_name,
                model_name,
                input_tokens,
                output_tokens,
                input_cost,
                output_cost,
                duration_ms,
                status,
                caller_type,
                caller_name,
                agent_name,
                data_classification,
                started_at,
                completed_at,
                created_at,
                updated_at
            ) 
            SELECT 
                usage_id,
                gen_random_uuid(),
                conv_id,
                demo_user_id,
                rm.provider_name,
                rm.model_name,
                100 + (i * 50) + (j * 25),
                200 + (i * 75) + (j * 30),
                ROUND((100 + (i * 50) + (j * 25)) * 0.000015, 6),
                ROUND((200 + (i * 75) + (j * 30)) * 0.00006, 6),
                1500 + (i * 200) + (j * 100),
                'completed',
                CASE j % 3
                    WHEN 0 THEN 'web_interface'
                    WHEN 1 THEN 'api_call'
                    ELSE 'background_task'
                END,
                CASE j % 3
                    WHEN 0 THEN 'chat_interface'
                    WHEN 1 THEN 'api_endpoint'
                    ELSE 'scheduled_job'
                END,
                CASE j % 4
                    WHEN 0 THEN 'conversation_agent'
                    WHEN 1 THEN 'task_agent'
                    WHEN 2 THEN 'analysis_agent'
                    ELSE 'summary_agent'
                END,
                CASE i % 3
                    WHEN 0 THEN 'public'
                    WHEN 1 THEN 'internal'
                    ELSE 'confidential'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '1 minute' * ((1500 + (i * 200) + (j * 100)) / 1000),
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '2 minutes',
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '2 minutes'
            FROM random_model rm;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Successfully created comprehensive sample data:';
    RAISE NOTICE '   - 10 agent conversations with realistic titles and metadata';
    RAISE NOTICE '   - 10 deliverables with detailed descriptions';
    RAISE NOTICE '   - 25+ tasks with various statuses and priorities';
    RAISE NOTICE '   - 40+ LLM usage records across multiple providers';
    RAISE NOTICE '   - Realistic costs, tokens, and timing data';
    RAISE NOTICE '   - Data spans the last 10 days for testing analytics';
    RAISE NOTICE '   - All data properly linked to demo user: %', demo_user_id;
END $$;
