-- Fix LLM Usage Analytics View
-- The original migration 20250903000002 failed to create the view properly
-- because it referenced a non-existent 'total_cost' column.
-- This migration fixes the view creation with correct column references.

-- Drop the view if it exists (it may not exist due to the original migration failure)
DROP VIEW IF EXISTS public.llm_usage_analytics CASCADE;

-- Create the corrected LLM usage analytics view
CREATE VIEW public.llm_usage_analytics AS
SELECT 
    DATE(started_at) as date_day,
    provider_name,
    model_name,
    caller_type,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(input_cost + output_cost) as total_cost,  -- Fixed: use input_cost + output_cost instead of total_cost
    AVG(duration_ms) as avg_duration_ms,
    
    -- Sanitization metrics
    COUNT(*) FILTER (WHERE data_sanitization_applied = true) as sanitized_requests,
    COUNT(*) FILTER (WHERE pii_detected = true) as pii_detected_requests,
    COUNT(*) FILTER (WHERE source_blinding_applied = true) as source_blinded_requests,
    SUM(pseudonyms_used) as total_pseudonyms_used,
    SUM(redactions_applied) as total_redactions_applied,
    SUM(headers_stripped) as total_headers_stripped,
    AVG(sanitization_time_ms) FILTER (WHERE sanitization_time_ms > 0) as avg_sanitization_time_ms,
    
    -- Compliance metrics
    COUNT(*) FILTER (WHERE compliance_flags->>'gdprCompliant' = 'true') as gdpr_compliant_requests,
    COUNT(*) FILTER (WHERE compliance_flags->>'hipaaCompliant' = 'true') as hipaa_compliant_requests,
    COUNT(*) FILTER (WHERE compliance_flags->>'pciCompliant' = 'true') as pci_compliant_requests
    
FROM public.llm_usage
WHERE status = 'completed'
    AND started_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 
    DATE(started_at),
    provider_name,
    model_name,
    caller_type
ORDER BY date_day DESC, total_requests DESC;

-- Also create the privacy summary view that was in the original migration
DROP VIEW IF EXISTS public.llm_usage_privacy_summary CASCADE;

CREATE VIEW public.llm_usage_privacy_summary AS
SELECT 
    DATE(started_at) as date_day,
    COUNT(*) as total_requests,
    
    -- Sanitization summary
    COUNT(*) FILTER (WHERE data_sanitization_applied = true) as sanitized_requests,
    ROUND(
        (COUNT(*) FILTER (WHERE data_sanitization_applied = true) * 100.0 / COUNT(*)), 2
    ) as sanitization_rate_percent,
    
    -- PII detection summary
    COUNT(*) FILTER (WHERE pii_detected = true) as pii_requests,
    ROUND(
        (COUNT(*) FILTER (WHERE pii_detected = true) * 100.0 / COUNT(*)), 2
    ) as pii_detection_rate_percent,
    
    -- Source blinding summary
    COUNT(*) FILTER (WHERE source_blinding_applied = true) as source_blinded_requests,
    ROUND(
        (COUNT(*) FILTER (WHERE source_blinding_applied = true) * 100.0 / COUNT(*)), 2
    ) as source_blinding_rate_percent,
    
    -- Sanitization level distribution
    COUNT(*) FILTER (WHERE sanitization_level = 'none') as sanitization_none,
    COUNT(*) FILTER (WHERE sanitization_level = 'basic') as sanitization_basic,
    COUNT(*) FILTER (WHERE sanitization_level = 'standard') as sanitization_standard,
    COUNT(*) FILTER (WHERE sanitization_level = 'strict') as sanitization_strict,
    
    -- Compliance summary
    ROUND(
        (COUNT(*) FILTER (WHERE compliance_flags->>'gdprCompliant' = 'true') * 100.0 / COUNT(*)), 2
    ) as gdpr_compliance_rate_percent,
    ROUND(
        (COUNT(*) FILTER (WHERE compliance_flags->>'hipaaCompliant' = 'true') * 100.0 / COUNT(*)), 2
    ) as hipaa_compliance_rate_percent
    
FROM public.llm_usage
WHERE status = 'completed'
    AND started_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(started_at)
ORDER BY date_day DESC;
