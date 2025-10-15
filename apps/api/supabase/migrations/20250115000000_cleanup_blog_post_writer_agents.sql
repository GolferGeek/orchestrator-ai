-- Migration: Clean up duplicate blog_post_writer agents and ensure proper LLM configuration
-- Date: 2025-01-15
-- Description: Remove duplicate blog_post_writer agents and ensure the demo organization agent has proper LLM configuration

-- First, let's see what we have
DO $$
DECLARE
    agent_count INTEGER;
    demo_agent_id UUID;
    my_org_agent_id UUID;
BEGIN
    -- Count existing blog_post_writer agents
    SELECT COUNT(*) INTO agent_count FROM agents WHERE slug = 'blog_post_writer';
    RAISE NOTICE 'Found % blog_post_writer agents', agent_count;
    
    -- Get the IDs of both agents
    SELECT id INTO demo_agent_id FROM agents WHERE slug = 'blog_post_writer' AND organization_slug = 'demo';
    SELECT id INTO my_org_agent_id FROM agents WHERE slug = 'blog_post_writer' AND organization_slug = 'my-org';
    
    RAISE NOTICE 'Demo agent ID: %', demo_agent_id;
    RAISE NOTICE 'My-org agent ID: %', my_org_agent_id;
    
    -- Update the demo organization agent with proper LLM configuration
    IF demo_agent_id IS NOT NULL THEN
        UPDATE agents 
        SET 
            config = jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{llm_defaults}',
                '{
                    "provider": "ollama",
                    "model": "gpt-oss:20b",
                    "temperature": 0.7,
                    "maxTokens": 2000
                }'::jsonb
            ),
            updated_at = NOW()
        WHERE id = demo_agent_id;
        
        RAISE NOTICE 'Updated demo agent with proper LLM configuration';
    END IF;
    
    -- Remove the my-org agent (duplicate)
    IF my_org_agent_id IS NOT NULL THEN
        -- First, delete any related conversations
        DELETE FROM conversations WHERE agent_id = my_org_agent_id;
        
        -- Then delete the agent
        DELETE FROM agents WHERE id = my_org_agent_id;
        
        RAISE NOTICE 'Removed duplicate my-org blog_post_writer agent';
    END IF;
    
    -- Verify the final state
    SELECT COUNT(*) INTO agent_count FROM agents WHERE slug = 'blog_post_writer';
    RAISE NOTICE 'Final count: % blog_post_writer agents', agent_count;
    
    -- Show the final configuration
    IF demo_agent_id IS NOT NULL THEN
        RAISE NOTICE 'Final demo agent config: %', (SELECT config FROM agents WHERE id = demo_agent_id);
    END IF;
END $$;

-- Add a comment to the migration
COMMENT ON TABLE agents IS 'Agents table - cleaned up duplicate blog_post_writer agents on 2025-01-15';
