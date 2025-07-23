-- Migration: Add schema discovery RPC functions for MCP
-- This enables the MCP server to discover database tables without hardcoding

-- Function 1: Get table names from information_schema
CREATE OR REPLACE FUNCTION get_table_names()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;

-- Function 2: Execute raw SQL queries (for advanced schema discovery)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Security: Only allow SELECT statements for schema discovery
  IF query ~* '^\s*(SELECT|WITH)\s+' THEN
    EXECUTE query INTO result;
    RETURN result;
  ELSE
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Function 3: Get detailed table information
CREATE OR REPLACE FUNCTION get_table_info(table_name_param text DEFAULT NULL)
RETURNS TABLE(
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND (table_name_param IS NULL OR c.table_name = table_name_param)
  ORDER BY c.table_name, c.ordinal_position;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_table_names() TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_info(text) TO authenticated;

-- Also grant to anon for broader compatibility (you can remove this if not needed)
GRANT EXECUTE ON FUNCTION get_table_names() TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION get_table_info(text) TO anon;