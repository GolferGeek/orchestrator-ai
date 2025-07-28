-- Supabase RPC Function for Raw SQL Execution
-- This function allows the MCP system to execute complex SQL queries

CREATE OR REPLACE FUNCTION execute_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    row_count integer;
BEGIN
    -- Security check: only allow SELECT statements
    IF lower(trim(query)) NOT LIKE 'select%' THEN
        RAISE EXCEPTION 'Only SELECT statements are allowed';
    END IF;
    
    -- Additional security checks
    IF query ~* '\b(drop|delete|truncate|alter|insert|update|create)\b' THEN
        RAISE EXCEPTION 'Potentially dangerous SQL operations detected';
    END IF;
    
    -- Execute the query and return results as JSONB
    EXECUTE format('
        SELECT jsonb_agg(row_to_json(t.*))
        FROM (%s) t
    ', query) INTO result;
    
    -- If result is null, return empty array
    IF result IS NULL THEN
        result := '[]'::jsonb;
    END IF;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Return error information
        RETURN jsonb_build_object(
            'error', true,
            'message', SQLERRM,
            'code', SQLSTATE,
            'hint', 'Check your SQL syntax and permissions'
        );
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;

-- Example usage (comment out for production):
-- SELECT execute_sql('SELECT COUNT(*) FROM companies LIMIT 1');
-- SELECT execute_sql('SELECT companies.name, SUM(kpi_data.value) as total_revenue FROM companies JOIN departments ON companies.id = departments.company_id JOIN kpi_data ON departments.id = kpi_data.department_id JOIN kpi_metrics ON kpi_data.metric_id = kpi_metrics.id WHERE kpi_metrics.name = ''Monthly Revenue'' GROUP BY companies.id, companies.name ORDER BY total_revenue DESC LIMIT 5');