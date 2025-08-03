-- Migration: Fix exec_sql function to handle multiple rows and complex results
-- Date: 2025-02-03
-- Purpose: Replace the existing exec_sql function that only returns first row with one that returns all rows

-- Drop the existing function first (if it exists)
DROP FUNCTION IF EXISTS exec_sql(text);

-- Create the improved exec_sql function that handles multiple rows
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_row record;
  results jsonb[] := '{}';
  final_result jsonb;
BEGIN
  -- Security: Only allow SELECT statements for schema discovery  
  IF query ~* '^\s*(SELECT|WITH)\s+' THEN
    -- Execute the query and collect all rows
    FOR result_row IN EXECUTE query LOOP
      results := results || to_jsonb(result_row);
    END LOOP;
    
    -- Return results as JSON array
    final_result := to_jsonb(results);
    RETURN final_result;
  ELSE
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permissions to all necessary roles
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO anon;

-- Test the function works with a simple query
-- This should return a JSON array with one object containing the count
-- Comment: SELECT exec_sql('SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = ''public''');