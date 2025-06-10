-- Check dependencies before cleaning up messages table
-- Date: 2025-06-10

-- Check what views exist that might depend on messages table columns
DO $$
DECLARE 
    view_rec RECORD;
BEGIN
    RAISE NOTICE 'Checking views that depend on messages table...';
    
    FOR view_rec IN 
        SELECT schemaname, viewname, definition 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND definition ILIKE '%messages%'
    LOOP
        RAISE NOTICE 'View: %.% - Definition: %', view_rec.schemaname, view_rec.viewname, view_rec.definition;
    END LOOP;
END $$;

-- Check specific dependencies on columns we want to remove
DO $$
DECLARE 
    dep_rec RECORD;
    columns_to_check TEXT[] := ARRAY['agent_name', 'agent_id', 'agent_type', 'user_name', 'display_name', 'message_type'];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY columns_to_check
    LOOP
        RAISE NOTICE 'Checking dependencies for column: %', col;
        
        -- Check if column exists first
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'messages' 
            AND column_name = col
            AND table_schema = 'public'
        ) THEN
            RAISE NOTICE 'Column % exists in messages table', col;
            
            -- This is a simplified check - in practice you'd use pg_depend for more detailed analysis
            FOR dep_rec IN 
                SELECT schemaname, viewname 
                FROM pg_views 
                WHERE schemaname = 'public' 
                AND definition ILIKE '%' || col || '%'
            LOOP
                RAISE NOTICE 'View %.% depends on column %', dep_rec.schemaname, dep_rec.viewname, col;
            END LOOP;
        ELSE
            RAISE NOTICE 'Column % does not exist in messages table', col;
        END IF;
    END LOOP;
END $$; 