-- Migration: Clean up messages table by updating dependent views and removing redundant columns
-- Date: 2025-06-10
-- Description: Update views to use metadata JSONB, then remove redundant columns

-- First, let's backup and recreate the message_analytics view to use metadata
DO $$
BEGIN
    -- Check if message_analytics view exists
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'message_analytics'
    ) THEN
        RAISE NOTICE 'Found message_analytics view, will recreate it to use metadata';
        
        -- Drop the view so we can modify the underlying table
        DROP VIEW IF EXISTS public.message_analytics;
        RAISE NOTICE 'Dropped message_analytics view';
    END IF;
END $$;

-- Remove redundant columns now that views are dropped
DO $$
BEGIN
    -- Remove agent_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_name;
        RAISE NOTICE 'Dropped agent_name column from messages table';
    END IF;

    -- Remove agent_id column if it exists  
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_id;
        RAISE NOTICE 'Dropped agent_id column from messages table';
    END IF;

    -- Remove agent_type column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'agent_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN agent_type;
        RAISE NOTICE 'Dropped agent_type column from messages table';
    END IF;

    -- Remove user_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'user_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN user_name;
        RAISE NOTICE 'Dropped user_name column from messages table';
    END IF;

    -- Remove display_name column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'display_name' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN display_name;
        RAISE NOTICE 'Dropped display_name column from messages table';
    END IF;

    -- Remove message_type column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'message_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.messages DROP COLUMN message_type;
        RAISE NOTICE 'Dropped message_type column from messages table';
    END IF;
END $$;

-- Recreate message_analytics view using metadata JSONB instead of individual columns
CREATE OR REPLACE VIEW public.message_analytics AS
SELECT 
    m.id,
    m.session_id,
    m.user_id,
    m.role,
    m.timestamp,
    m.order,
    -- Extract agent information from metadata
    m.metadata->>'agentName' as agent_name,
    m.metadata->>'agentType' as agent_type,
    m.metadata->>'respondingAgentId' as agent_id,
    m.metadata->>'processingAgentDisplayName' as display_name,
    m.metadata->>'userName' as user_name,
    m.metadata->>'userEmail' as user_email,
    m.metadata->>'messageType' as message_type,
    -- Additional useful metadata fields
    m.metadata->>'isDelegated' as is_delegated,
    m.metadata->>'processedBy' as processed_by,
    -- Full metadata for complex queries
    m.metadata,
    -- Message content length for analytics
    LENGTH(m.content) as content_length,
    -- Session information
    s.title as session_title,
    s.created_at as session_created_at
FROM public.messages m
LEFT JOIN public.sessions s ON m.session_id = s.id;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.message_analytics TO authenticated;

-- Note: RLS policies are not needed on views - they inherit from underlying tables

-- Verify final table structure
DO $$
DECLARE 
    column_names TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO column_names
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'Final messages table columns: %', column_names;
    RAISE NOTICE 'Recreated message_analytics view to use metadata JSONB';
END $$; 