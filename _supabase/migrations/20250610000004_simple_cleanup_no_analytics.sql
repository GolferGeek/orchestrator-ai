-- Simple Migration: Remove message_analytics view and clean up redundant columns
-- Date: 2025-06-10
-- Description: Drop unnecessary view and remove redundant columns, keep it simple

-- Step 1: Log current state
DO $$
DECLARE 
    column_names TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO column_names
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'BEFORE: messages table columns: %', column_names;
END $$;

-- Step 2: Drop the message_analytics view entirely (we don't need it)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'message_analytics'
    ) THEN
        DROP VIEW public.message_analytics CASCADE;
        RAISE NOTICE 'Dropped message_analytics view permanently';
    ELSE
        RAISE NOTICE 'No message_analytics view to drop';
    END IF;
END $$;

-- Step 3: Remove redundant columns (now that view is gone)
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
            RAISE NOTICE 'Dropped column: %', col;
            removed_count := removed_count + 1;
        ELSE
            RAISE NOTICE 'Column % does not exist', col;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total columns removed: %', removed_count;
END $$;

-- Step 4: Final verification
DO $$
DECLARE 
    final_columns TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
    INTO final_columns
    FROM information_schema.columns 
    WHERE table_name = 'messages' AND table_schema = 'public';
    
    RAISE NOTICE 'AFTER: messages table columns: %', final_columns;
    RAISE NOTICE 'Expected: id, session_id, user_id, role, content, timestamp, order, metadata';
    RAISE NOTICE 'Cleanup completed! All agent/user data is now in metadata JSONB column.';
END $$; 