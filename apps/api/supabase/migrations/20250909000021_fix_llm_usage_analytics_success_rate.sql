-- Fix LLM Usage Analytics View - Add Success Rate Calculation
-- The current view only includes completed requests, so success rate is always 100%
-- This migration updates the view to include both successful and failed requests
-- so we can calculate meaningful success rates.

-- Drop the existing view
DROP VIEW IF EXISTS public.llm_usage_analytics CASCADE;

-- Create the updated LLM usage analytics view with success rate calculation
CREATE VIEW public.llm_usage_analytics AS
SELECT 
    DATE(started_at) as date,  -- Changed from date_day to date to match frontend expectation
    provider_name,
    model_name,
    caller_type,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_requests,
    COUNT(*) FILTER (WHERE status = 'failed' OR status = 'error') as failed_requests,
    SUM(input_tokens) FILTER (WHERE status = 'completed') as total_input_tokens,
    SUM(output_tokens) FILTER (WHERE status = 'completed') as total_output_tokens,
    SUM(input_cost + output_cost) FILTER (WHERE status = 'completed') as total_cost,
    AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration_ms,
    
    -- Sanitization metrics (only for completed requests)
    COUNT(*) FILTER (WHERE status = 'completed' AND data_sanitization_applied = true) as sanitized_requests,
    COUNT(*) FILTER (WHERE status = 'completed' AND pii_detected = true) as pii_detected_requests,
    COUNT(*) FILTER (WHERE status = 'completed' AND source_blinding_applied = true) as source_blinded_requests,
    SUM(pseudonyms_used) FILTER (WHERE status = 'completed') as total_pseudonyms_used,
    SUM(redactions_applied) FILTER (WHERE status = 'completed') as total_redactions_applied,
    SUM(headers_stripped) FILTER (WHERE status = 'completed') as total_headers_stripped,
    AVG(sanitization_time_ms) FILTER (WHERE status = 'completed' AND sanitization_time_ms > 0) as avg_sanitization_time_ms,
    
    -- Compliance metrics (only for completed requests)
    COUNT(*) FILTER (WHERE status = 'completed' AND compliance_flags->>'gdprCompliant' = 'true') as gdpr_compliant_requests,
    COUNT(*) FILTER (WHERE status = 'completed' AND compliance_flags->>'hipaaCompliant' = 'true') as hipaa_compliant_requests,
    COUNT(*) FILTER (WHERE status = 'completed' AND compliance_flags->>'pciCompliant' = 'true') as pci_compliant_requests,
    
    -- Add unique users count
    COUNT(DISTINCT user_id) as unique_users
    
FROM public.llm_usage
WHERE started_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 
    DATE(started_at),
    provider_name,
    model_name,
    caller_type
ORDER BY date DESC, total_requests DESC;

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully updated llm_usage_analytics view:';
    RAISE NOTICE '   - Changed date_day to date column name';
    RAISE NOTICE '   - Added successful_requests and failed_requests columns';
    RAISE NOTICE '   - Includes both completed and failed requests for accurate success rate calculation';
    RAISE NOTICE '   - Added unique_users column';
    RAISE NOTICE '   - Sanitization and compliance metrics only count completed requests';
END $$;
