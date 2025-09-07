-- Enhanced LLM Usage Tracking Migration
-- Adds comprehensive data sanitization and privacy metrics tracking to existing LLM usage table
-- This migration extends the existing llm_usage table with enhanced fields

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- ENHANCE EXISTING LLM USAGE TABLE
-- =====================================

-- Add enhanced data sanitization and privacy tracking fields to existing llm_usage table
-- Note: Using IF NOT EXISTS to safely add columns in case they already exist

-- Enhanced data sanitization tracking
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS data_sanitization_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS sanitization_level VARCHAR(20) DEFAULT 'none' 
CHECK (sanitization_level IN ('none', 'basic', 'standard', 'strict'));

-- PII detection and handling
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS pii_types JSONB DEFAULT '[]'::jsonb; -- e.g., ["email", "ssn", "phone", "credit_card"]

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS pseudonyms_used INTEGER DEFAULT 0;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS pseudonym_types JSONB DEFAULT '[]'::jsonb; -- e.g., ["person_name", "organization", "location"]

-- Redaction tracking
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS redactions_applied INTEGER DEFAULT 0;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS redaction_types JSONB DEFAULT '[]'::jsonb; -- e.g., ["secret_key", "password", "api_key"]

-- Source blinding metrics
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS source_blinding_applied BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS headers_stripped INTEGER DEFAULT 0;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS custom_user_agent_used BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS proxy_used BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS no_train_header_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS no_retain_header_sent BOOLEAN DEFAULT FALSE;

-- Sanitization performance metrics
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS sanitization_time_ms INTEGER DEFAULT 0;

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS reversal_context_size INTEGER DEFAULT 0; -- Size of context needed for pseudonym reversal

-- Data classification and policy
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS policy_profile VARCHAR(100); -- e.g., 'healthcare', 'finance', 'standard'

ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS sovereign_mode BOOLEAN DEFAULT FALSE;

-- Compliance tracking
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS compliance_flags JSONB DEFAULT '{}'::jsonb; -- e.g., {"gdprCompliant": true, "hipaaCompliant": false, "pciCompliant": true}

-- Additional metadata fields if they don't exist
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS langsmith_run_id UUID;

-- Note: total_cost column already exists as a generated column, so we skip adding it

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Core indexes for common queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_run_id ON public.llm_usage(run_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON public.llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_caller_type ON public.llm_usage(caller_type);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_model ON public.llm_usage(provider_name, model_name);
CREATE INDEX IF NOT EXISTS idx_llm_usage_conversation_id ON public.llm_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_status ON public.llm_usage(status);
CREATE INDEX IF NOT EXISTS idx_llm_usage_started_at ON public.llm_usage(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_completed_at ON public.llm_usage(completed_at DESC);

-- Privacy and compliance indexes
CREATE INDEX IF NOT EXISTS idx_llm_usage_data_sanitization ON public.llm_usage(data_sanitization_applied);
CREATE INDEX IF NOT EXISTS idx_llm_usage_sanitization_level ON public.llm_usage(sanitization_level);
CREATE INDEX IF NOT EXISTS idx_llm_usage_pii_detected ON public.llm_usage(pii_detected);
CREATE INDEX IF NOT EXISTS idx_llm_usage_source_blinding ON public.llm_usage(source_blinding_applied);
CREATE INDEX IF NOT EXISTS idx_llm_usage_policy_profile ON public.llm_usage(policy_profile);

-- Composite indexes for analytics
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date ON public.llm_usage(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider_date ON public.llm_usage(provider_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_compliance_date ON public.llm_usage(data_sanitization_applied, started_at DESC);

-- JSONB indexes for array fields
CREATE INDEX IF NOT EXISTS idx_llm_usage_pii_types_gin ON public.llm_usage USING GIN(pii_types);
CREATE INDEX IF NOT EXISTS idx_llm_usage_pseudonym_types_gin ON public.llm_usage USING GIN(pseudonym_types);
CREATE INDEX IF NOT EXISTS idx_llm_usage_redaction_types_gin ON public.llm_usage USING GIN(redaction_types);
CREATE INDEX IF NOT EXISTS idx_llm_usage_compliance_flags_gin ON public.llm_usage USING GIN(compliance_flags);

-- =====================================
-- ANALYTICS VIEWS
-- =====================================

-- Drop existing views to avoid column type conflicts
DROP VIEW IF EXISTS public.llm_usage_analytics CASCADE;
DROP VIEW IF EXISTS public.llm_usage_privacy_summary CASCADE;

-- Create a view for LLM usage analytics with sanitization metrics
CREATE VIEW public.llm_usage_analytics AS
SELECT 
    DATE(started_at) as date_day,
    provider_name,
    model_name,
    caller_type,
    COUNT(*) as total_requests,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_cost) as total_cost,
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

-- Create a view for privacy compliance summary
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

-- =====================================
-- UPDATE TRIGGERS
-- =====================================

-- Add update trigger to llm_usage table
CREATE TRIGGER update_orchestrator_llm_usage_updated_at BEFORE UPDATE ON public.llm_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- HELPER FUNCTIONS
-- =====================================

-- Function to calculate sanitization effectiveness score
CREATE OR REPLACE FUNCTION public.calculate_sanitization_score(
    p_pii_detected BOOLEAN,
    p_sanitization_level VARCHAR,
    p_redactions_applied INTEGER,
    p_pseudonyms_used INTEGER
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Points for sanitization level
    score := CASE p_sanitization_level
        WHEN 'strict' THEN score + 40
        WHEN 'standard' THEN score + 30
        WHEN 'basic' THEN score + 20
        WHEN 'none' THEN score + 0
        ELSE score
    END;
    
    -- Points for PII handling
    IF p_pii_detected THEN
        IF p_pseudonyms_used > 0 THEN
            score := score + 25;
        END IF;
        IF p_redactions_applied > 0 THEN
            score := score + 25;
        END IF;
    ELSE
        -- No PII detected gets full score
        score := score + 50;
    END IF;
    
    -- Bonus for comprehensive sanitization
    IF p_redactions_applied > 0 AND p_pseudonyms_used > 0 THEN
        score := score + 10;
    END IF;
    
    RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get compliance status for a request
CREATE OR REPLACE FUNCTION public.get_compliance_status(
    p_llm_usage_id UUID
) RETURNS JSONB AS $$
DECLARE
    usage_record RECORD;
    compliance_status JSONB := '{}'::jsonb;
BEGIN
    SELECT * FROM public.llm_usage WHERE id = p_llm_usage_id INTO usage_record;
    
    IF NOT FOUND THEN
        RETURN '{"error": "Usage record not found"}'::jsonb;
    END IF;
    
    -- GDPR compliance (requires data sanitization for PII)
    compliance_status := compliance_status || jsonb_build_object(
        'gdpr_compliant',
        CASE 
            WHEN usage_record.pii_detected = false THEN true
            WHEN usage_record.pii_detected = true AND usage_record.data_sanitization_applied = true THEN true
            ELSE false
        END
    );
    
    -- HIPAA compliance (requires strict sanitization)
    compliance_status := compliance_status || jsonb_build_object(
        'hipaa_compliant',
        CASE 
            WHEN usage_record.sanitization_level = 'strict' THEN true
            ELSE false
        END
    );
    
    -- PCI compliance (requires redaction of payment data)
    compliance_status := compliance_status || jsonb_build_object(
        'pci_compliant',
        CASE 
            WHEN usage_record.redaction_types ? 'credit_card' OR usage_record.redaction_types ? 'payment_info' THEN true
            WHEN NOT (usage_record.pii_types ? 'credit_card') THEN true
            ELSE false
        END
    );
    
    -- Overall sanitization score
    compliance_status := compliance_status || jsonb_build_object(
        'sanitization_score',
        public.calculate_sanitization_score(
            usage_record.pii_detected,
            usage_record.sanitization_level,
            usage_record.redactions_applied,
            usage_record.pseudonyms_used
        )
    );
    
    RETURN compliance_status;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================
-- SAMPLE DATA COMMENT
-- =====================================

-- This migration creates the enhanced LLM usage tracking table with comprehensive
-- data sanitization and privacy metrics. The table includes:
--
-- 1. Standard usage tracking (tokens, cost, duration)
-- 2. Data sanitization metrics (PII detection, pseudonymization, redaction)
-- 3. Source blinding metrics (header stripping, proxy usage)
-- 4. Compliance tracking (GDPR, HIPAA, PCI)
-- 5. Performance metrics for sanitization operations
--
-- The table is designed to be populated by the LLM service layer and provides
-- comprehensive analytics for privacy, security, and compliance monitoring.