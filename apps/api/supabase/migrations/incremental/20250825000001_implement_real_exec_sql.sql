-- Replace dummy exec_sql function with real SQL execution
-- This enables dynamic SQL execution for the metrics agent

-- Drop existing function first
DROP FUNCTION IF EXISTS public.exec_sql(text);

-- Create new function with proper return type
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json AS $$
DECLARE
    result json;
    row_count integer;
BEGIN
    -- Security check: only allow SELECT statements for safety
    IF NOT query ILIKE 'SELECT%' THEN
        RETURN json_build_object(
            'error', 'Only SELECT statements are allowed',
            'status', 'error'
        );
    END IF;
    
    -- Execute the query and convert result to JSON
    BEGIN
        EXECUTE 'WITH query_result AS (' || query || ') SELECT json_agg(query_result) FROM query_result'
        INTO result;
        
        -- Handle case where query returns no rows
        IF result IS NULL THEN
            result := '[]'::json;
        END IF;
        
        -- Get row count
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        RETURN json_build_object(
            'data', result,
            'status', 'success',
            'row_count', row_count
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object(
            'error', SQLERRM,
            'status', 'error',
            'sqlstate', SQLSTATE
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;