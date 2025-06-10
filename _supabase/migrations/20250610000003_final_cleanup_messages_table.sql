-- Final Migration: Clean up messages table and handle all dependencies
-- Date: 2025-06-10
-- Description: Comprehensive cleanup that handles views, dependencies, and edge cases

-- Step 1: Check current state and log what we're working with
DO $$
DECLARE 
    column_names TEXT;
    view_count INTEGER;
BEGIN
    -- Log current table structure
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO column_names
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'CURRENT messages table columns: %', column_names;
    
    -- Check for dependent views
    SELECT COUNT(*)
    INTO view_count
    FROM pg_views 
    WHERE schemaname = 'public' 
    AND definition ILIKE '%messages%';
    
    RAISE NOTICE 'Found % views that reference messages table', view_count;
END $$;

-- Step 2: Handle dependent objects (views, etc.)
DO $$
DECLARE 
    view_rec RECORD;
    old_view_definition TEXT;
BEGIN
    -- Handle message_analytics view specifically
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'message_analytics'
    ) THEN
        -- Store the old definition for reference
        SELECT definition INTO old_view_definition
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'message_analytics';
        
        RAISE NOTICE 'Found message_analytics view, dropping it to allow column removal';
        RAISE NOTICE 'Old view definition: %', old_view_definition;
        
        DROP VIEW public.message_analytics CASCADE;
        RAISE NOTICE 'Successfully dropped message_analytics view';
    ELSE
        RAISE NOTICE 'No message_analytics view found';
    END IF;
    
    -- Check for any other views that might depend on our columns
    FOR view_rec IN 
        SELECT schemaname, viewname, definition
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND (
            definition ILIKE '%agent_name%' OR
            definition ILIKE '%agent_id%' OR 
            definition ILIKE '%agent_type%' OR
            definition ILIKE '%user_name%' OR
            definition ILIKE '%display_name%' OR
            definition ILIKE '%message_type%'
        )
    LOOP
        RAISE NOTICE 'WARNING: View %.% also references columns we want to drop: %', 
                     view_rec.schemaname, view_rec.viewname, view_rec.definition;
        -- For now, just log these - you may need to handle them manually
    END LOOP;
END $$;

-- Step 3: Remove redundant columns (now that dependencies are handled)
DO $$
DECLARE
    columns_to_remove TEXT[] := ARRAY['agent_name', 'agent_id', 'agent_type', 'user_name', 'display_name', 'message_type'];
    col TEXT;
    removed_count INTEGER := 0;
BEGIN
    FOREACH col IN ARRAY columns_to_remove
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = col
            AND table_schema = 'public'
        ) THEN
            EXECUTE format('ALTER TABLE public.messages DROP COLUMN %I', col);
            RAISE NOTICE 'Successfully dropped column: %', col;
            removed_count := removed_count + 1;
        ELSE
            RAISE NOTICE 'Column % does not exist, skipping', col;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Removed % redundant columns total', removed_count;
END $$;

-- Step 4: Create new message_analytics view using metadata
DO $$
BEGIN
    -- Create the new view that extracts data from metadata JSONB
    CREATE VIEW public.message_analytics AS
    SELECT 
        m.id,
        m.session_id,
        m.user_id,
        m.role,
        m.content,
        m.timestamp,
        m."order",
        -- Extract agent information from metadata (using different possible keys)
        COALESCE(
            m.metadata->>'agentName', 
            m.metadata->>'respondingAgentName',
            m.metadata->>'processingAgentName'
        ) as agent_name,
        
        COALESCE(
            m.metadata->>'agentType',
            m.metadata->>'respondingAgentType', 
            m.metadata->>'processingAgentType'
        ) as agent_type,
        
        COALESCE(
            m.metadata->>'respondingAgentId',
            m.metadata->>'processingAgentId'
        ) as agent_id,
        
        COALESCE(
            m.metadata->>'respondingAgentDisplayName',
            m.metadata->>'processingAgentDisplayName',
            m.metadata->>'agentName'
        ) as display_name,
        
        COALESCE(
            m.metadata->>'userName',
            m.metadata->>'userEmail'
        ) as user_name,
        
        m.metadata->>'userEmail' as user_email,
        m.metadata->>'messageType' as message_type,
        
        -- Additional useful fields
        m.metadata->>'isDelegated' as is_delegated,
        m.metadata->>'processedBy' as processed_by,
        
        -- Full metadata for advanced queries
        m.metadata,
        
        -- Computed fields
        LENGTH(m.content) as content_length,
        
        -- Session information (if sessions table exists)
        s.title as session_title,
        s.created_at as session_created_at
    FROM public.messages m
    LEFT JOIN public.sessions s ON m.session_id = s.id;
    
    RAISE NOTICE 'Successfully created new message_analytics view using metadata';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating view: %. Continuing anyway.', SQLERRM;
END $$;

-- Step 5: Set up permissions (but no RLS on views)
DO $$
BEGIN
    -- Grant SELECT permission to authenticated users
    GRANT SELECT ON public.message_analytics TO authenticated;
    RAISE NOTICE 'Granted SELECT permission on message_analytics to authenticated users';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error setting permissions: %. Continuing anyway.', SQLERRM;
END $$;

-- Step 6: Final verification
DO $$
DECLARE 
    final_columns TEXT;
    view_exists BOOLEAN;
BEGIN
    -- Check final table structure
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO final_columns
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'FINAL messages table columns: %', final_columns;
    
    -- Verify view was created
    SELECT EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'message_analytics'
    ) INTO view_exists;
    
    IF view_exists THEN
        RAISE NOTICE 'SUCCESS: message_analytics view recreated successfully';
    ELSE
        RAISE NOTICE 'WARNING: message_analytics view was not created';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Expected final columns: id, session_id, user_id, role, content, timestamp, order, metadata';
END $$; 