-- Migration: Create exec_sql function for MCP server
-- This function allows the MCP server to execute arbitrary SQL queries
-- and return results in a format compatible with the Supabase JavaScript client

CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Execute the dynamic SQL and return results as JSON
    EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
    
    -- If no rows returned, return empty array instead of null
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information as JSON
        RETURN json_build_object(
            'error', true,
            'message', SQLERRM,
            'code', SQLSTATE,
            'query', query
        );
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

-- Add comment explaining the function
COMMENT ON FUNCTION exec_sql(text) IS 'Execute arbitrary SQL queries and return results as JSON array. Used by MCP server for dynamic query execution.';