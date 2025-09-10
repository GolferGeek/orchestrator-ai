-- Realistic Sample Data Migration for Frontend Components
-- This migration seeds the database with realistic sample data for all refactored components
-- Supports: LLMUsageAnalytics, PrivacyMetricsDashboard, SanitizationInspector, AdminSettingsPage, PseudonymMappingViewer

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- ADD METADATA COLUMN IF NOT EXISTS
-- =====================================

-- Add metadata column to llm_usage table if it doesn't exist
ALTER TABLE public.llm_usage 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- =====================================
-- CLEAR EXISTING SAMPLE DATA (Optional - for clean slate)
-- =====================================

-- Clean up existing sample data to avoid duplicates
DELETE FROM public.llm_usage WHERE metadata->>'is_sample_data' = 'true';
DELETE FROM public.redaction_audit_log WHERE metadata->>'is_sample_data' = 'true';
DELETE FROM public.pseudonym_mappings WHERE created_by_system = 'sample_data_migration';
DELETE FROM public.redaction_patterns WHERE description LIKE '%sample data%';

-- =====================================
-- SAMPLE LLM USAGE DATA
-- =====================================

-- Insert realistic LLM usage records for the past 30 days
-- This supports LLMUsageAnalytics component with proper metrics and trends

WITH sample_dates AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as date_day
),
sample_models AS (
    SELECT * FROM (VALUES
        ('openai', 'gpt-4o', 0.0025, 0.01, 'chat'),
        ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 'chat'),
        ('anthropic', 'claude-3-5-sonnet-20241022', 0.003, 0.015, 'chat'),
        ('anthropic', 'claude-3-5-haiku-20241022', 0.0008, 0.004, 'chat'),
        ('openrouter', 'meta-llama/llama-3.1-405b-instruct', 0.0027, 0.0027, 'chat'),
        ('openrouter', 'google/gemini-pro-1.5', 0.00125, 0.005, 'chat'),
        ('perplexity', 'llama-3.1-sonar-large-128k-online', 0.001, 0.001, 'search')
    ) AS t(provider_name, model_name, input_cost_per_token, output_cost_per_token, model_type)
),
sample_users AS (
    SELECT id, email FROM public.users LIMIT 10
)

INSERT INTO public.llm_usage (
    id,
    user_id,
    conversation_id,
    run_id,
    provider_name,
    model_name,
    caller_type,
    caller_name,
    input_tokens,
    output_tokens,
    input_cost,
    output_cost,
    duration_ms,
    status,
    started_at,
    completed_at,
    
    -- Enhanced sanitization fields
    data_sanitization_applied,
    sanitization_level,
    pii_detected,
    pii_types,
    pseudonyms_used,
    pseudonym_types,
    redactions_applied,
    redaction_types,
    source_blinding_applied,
    headers_stripped,
    custom_user_agent_used,
    proxy_used,
    no_train_header_sent,
    no_retain_header_sent,
    sanitization_time_ms,
    reversal_context_size,
    policy_profile,
    sovereign_mode,
    compliance_flags,
    
    metadata
)
SELECT 
    uuid_generate_v4() as id,
    u.id as user_id,
    uuid_generate_v4() as conversation_id,
    uuid_generate_v4() as run_id,
    m.provider_name,
    m.model_name,
    CASE (random() * 3)::int 
        WHEN 0 THEN 'agent'
        WHEN 1 THEN 'user_chat'
        ELSE 'api_call'
    END as caller_type,
    CASE (random() * 4)::int
        WHEN 0 THEN 'privacy_agent'
        WHEN 1 THEN 'sanitization_service'
        WHEN 2 THEN 'chat_interface'
        ELSE 'data_processor'
    END as caller_name,
    
    -- Token usage (realistic ranges)
    (500 + random() * 3000)::int as input_tokens,
    (200 + random() * 1500)::int as output_tokens,
    
    -- Cost calculation based on model pricing
    ((500 + random() * 3000) * m.input_cost_per_token)::decimal(10,6) as input_cost,
    ((200 + random() * 1500) * m.output_cost_per_token)::decimal(10,6) as output_cost,
    
    -- Duration (100ms to 15s)
    (100 + random() * 14900)::int as duration_ms,
    
    CASE (random() * 10)::int
        WHEN 0 THEN 'failed'
        WHEN 1 THEN 'timeout'
        ELSE 'completed'
    END as status,
    
    -- Timestamps
    d.date_day + (random() * INTERVAL '24 hours') as started_at,
    d.date_day + (random() * INTERVAL '24 hours') + INTERVAL '2 seconds' as completed_at,
    
    -- Enhanced sanitization fields with realistic distributions
    (random() < 0.7) as data_sanitization_applied, -- 70% sanitized
    CASE (random() * 4)::int
        WHEN 0 THEN 'none'
        WHEN 1 THEN 'basic'
        WHEN 2 THEN 'standard'
        ELSE 'strict'
    END as sanitization_level,
    
    (random() < 0.4) as pii_detected, -- 40% contain PII
    
    -- PII types (realistic JSON arrays)
    CASE 
        WHEN random() < 0.4 THEN
            CASE (random() * 4)::int
                WHEN 0 THEN '["email"]'::jsonb
                WHEN 1 THEN '["phone", "name"]'::jsonb
                WHEN 2 THEN '["email", "address", "name"]'::jsonb
                ELSE '["ssn", "credit_card"]'::jsonb
            END
        ELSE '[]'::jsonb
    END as pii_types,
    
    -- Pseudonyms used (0-5)
    (random() * 5)::int as pseudonyms_used,
    
    -- Pseudonym types
    CASE 
        WHEN random() < 0.3 THEN '["person_name", "organization"]'::jsonb
        WHEN random() < 0.6 THEN '["location", "email"]'::jsonb
        ELSE '[]'::jsonb
    END as pseudonym_types,
    
    -- Redactions (0-8)
    (random() * 8)::int as redactions_applied,
    
    -- Redaction types
    CASE
        WHEN random() < 0.3 THEN '["secret_key", "password"]'::jsonb
        WHEN random() < 0.6 THEN '["api_key", "token"]'::jsonb
        ELSE '["credit_card", "ssn"]'::jsonb
    END as redaction_types,
    
    (random() < 0.6) as source_blinding_applied, -- 60% source blinded
    (random() * 10)::int as headers_stripped,
    (random() < 0.8) as custom_user_agent_used,
    (random() < 0.3) as proxy_used,
    (random() < 0.9) as no_train_header_sent,
    (random() < 0.9) as no_retain_header_sent,
    
    -- Sanitization performance (10-500ms)
    (10 + random() * 490)::int as sanitization_time_ms,
    (random() * 1000)::int as reversal_context_size,
    
    CASE (random() * 4)::int
        WHEN 0 THEN 'healthcare'
        WHEN 1 THEN 'finance' 
        WHEN 2 THEN 'standard'
        ELSE 'enterprise'
    END as policy_profile,
    
    (random() < 0.2) as sovereign_mode, -- 20% sovereign mode
    
    -- Compliance flags
    jsonb_build_object(
        'gdprCompliant', (random() < 0.8),
        'hipaaCompliant', (random() < 0.6),
        'pciCompliant', (random() < 0.7),
        'soxCompliant', (random() < 0.5)
    ) as compliance_flags,
    
    -- Metadata
    jsonb_build_object(
        'is_sample_data', true,
        'sample_batch', 'frontend_components_v1',
        'request_source', 'orchestrator_ai_demo',
        'data_classification', 
            CASE (random() * 3)::int
                WHEN 0 THEN 'public'
                WHEN 1 THEN 'internal'
                ELSE 'confidential'
            END
    ) as metadata

FROM sample_dates d
CROSS JOIN sample_models m
CROSS JOIN sample_users u
WHERE random() < 0.3 -- ~30% sampling to avoid too much data
LIMIT 500; -- Cap at 500 records

-- =====================================
-- SAMPLE REDACTION AUDIT LOG DATA
-- =====================================

-- Insert audit log entries that correspond to sanitization operations
-- This supports SanitizationInspector component with processing history

INSERT INTO public.redaction_audit_log (
    id,
    session_id,
    run_id,
    operation_type,
    data_type,
    pattern_name,
    original_length,
    redacted_length,
    pseudonym_count,
    redaction_count,
    processing_time_ms,
    created_at,
    user_id,
    service_name,
    metadata
)
SELECT 
    uuid_generate_v4() as id,
    'session_' || (random() * 1000)::int as session_id,
    uuid_generate_v4() as run_id, -- Generate new UUID for audit log
    CASE (random() * 3)::int
        WHEN 0 THEN 'redact'
        WHEN 1 THEN 'pseudonymize'
        ELSE 'pattern_match'
    END as operation_type,
    
    CASE (random() * 8)::int
        WHEN 0 THEN 'email'
        WHEN 1 THEN 'phone'
        WHEN 2 THEN 'name'
        WHEN 3 THEN 'address'
        WHEN 4 THEN 'ip_address'
        WHEN 5 THEN 'username'
        WHEN 6 THEN 'credit_card'
        ELSE 'ssn'
    END::public.pii_data_type as data_type,
    
    CASE (random() * 5)::int
        WHEN 0 THEN 'email_pattern'
        WHEN 1 THEN 'phone_us'
        WHEN 2 THEN 'ssn_pattern'
        WHEN 3 THEN 'credit_card_visa'
        ELSE 'api_key_pattern'
    END as pattern_name,
    
    (50 + random() * 200)::int as original_length,
    (10 + random() * 50)::int as redacted_length,
    l.pseudonyms_used as pseudonym_count,
    l.redactions_applied as redaction_count,
    l.sanitization_time_ms as processing_time_ms,
    l.started_at as created_at,
    l.user_id,
    'secret_redaction_service' as service_name,
    
    jsonb_build_object(
        'is_sample_data', true,
        'sanitization_level', 
            CASE (random() * 3)::int
                WHEN 0 THEN 'basic'
                WHEN 1 THEN 'standard'
                ELSE 'strict'
            END,
        'confidence_score', (0.7 + random() * 0.3)::numeric(3,2),
        'pattern_matches', (1 + random() * 5)::int
    ) as metadata

FROM public.llm_usage l
WHERE l.metadata->>'is_sample_data' = 'true'
    AND l.data_sanitization_applied = true
    AND random() < 0.6 -- Create audit logs for 60% of sanitized requests
LIMIT 200;

-- =====================================
-- SAMPLE PSEUDONYM MAPPINGS DATA
-- =====================================

-- Insert realistic pseudonym mappings for reversibility demos
-- This supports PseudonymMappingViewer component

INSERT INTO public.pseudonym_mappings (
    id,
    original_hash,
    pseudonym,
    data_type,
    context,
    created_at,
    last_used_at,
    usage_count,
    expires_at,
    is_reversible,
    created_by_system
)
VALUES 
-- Email pseudonyms
(uuid_generate_v4(), encode(sha256('john.doe@company.com'::bytea), 'hex'), 'alex.smith@example.com', 'email', 'user_registration', CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 8, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('sarah.wilson@corp.net'::bytea), 'hex'), 'jane.jones@test.org', 'email', 'support_ticket', CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 12, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('admin@secretcorp.com'::bytea), 'hex'), 'user.demo@sample.net', 'email', 'admin_action', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP, 25, NULL, false, 'sample_data_migration'),

-- Phone number pseudonyms
(uuid_generate_v4(), encode(sha256('+1-555-0123'::bytea), 'hex'), '+1-555-9876', 'phone', 'contact_form', CURRENT_TIMESTAMP - INTERVAL '20 days', CURRENT_TIMESTAMP - INTERVAL '3 days', 5, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('(555) 555-1234'::bytea), 'hex'), '(555) 555-8765', 'phone', 'user_profile', CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '1 hour', 15, NULL, true, 'sample_data_migration'),

-- Name pseudonyms
(uuid_generate_v4(), encode(sha256('John Michael Smith'::bytea), 'hex'), 'Alex Johnson Brown', 'name', 'document_processing', CURRENT_TIMESTAMP - INTERVAL '18 days', CURRENT_TIMESTAMP - INTERVAL '4 days', 7, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('Dr. Sarah Elizabeth Wilson'::bytea), 'hex'), 'Dr. Jane Marie Davis', 'name', 'medical_record', CURRENT_TIMESTAMP - INTERVAL '25 days', CURRENT_TIMESTAMP - INTERVAL '6 days', 3, NULL, false, 'sample_data_migration'),

-- Address pseudonyms
(uuid_generate_v4(), encode(sha256('123 Main Street, Anytown, CA 90210'::bytea), 'hex'), '456 Oak Avenue, Testville, NY 12345', 'address', 'shipping_info', CURRENT_TIMESTAMP - INTERVAL '14 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 4, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('789 Corporate Blvd, Suite 100'::bytea), 'hex'), '321 Business Park, Unit 200', 'address', 'business_registration', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '7 days', 2, NULL, false, 'sample_data_migration'),

-- IP Address pseudonyms
(uuid_generate_v4(), encode(sha256('192.168.1.100'::bytea), 'hex'), '10.0.0.50', 'ip_address', 'network_logs', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 45, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('203.0.113.42'::bytea), 'hex'), '198.51.100.25', 'ip_address', 'api_access', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP, 89, NULL, false, 'sample_data_migration'),

-- Username pseudonyms
(uuid_generate_v4(), encode(sha256('john_doe_admin'::bytea), 'hex'), 'user_demo_123', 'username', 'system_access', CURRENT_TIMESTAMP - INTERVAL '22 days', CURRENT_TIMESTAMP - INTERVAL '5 days', 18, NULL, true, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('sarah.wilson.dev'::bytea), 'hex'), 'dev.user.456', 'username', 'code_review', CURRENT_TIMESTAMP - INTERVAL '16 days', CURRENT_TIMESTAMP - INTERVAL '3 days', 11, NULL, true, 'sample_data_migration'),

-- Credit card pseudonyms (masked)
(uuid_generate_v4(), encode(sha256('4532-1234-5678-9012'::bytea), 'hex'), '****-****-****-5555', 'credit_card', 'payment_processing', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 1, CURRENT_TIMESTAMP + INTERVAL '90 days', false, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('5555-4444-3333-2222'::bytea), 'hex'), '****-****-****-1111', 'credit_card', 'subscription_payment', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '1 day', 2, CURRENT_TIMESTAMP + INTERVAL '90 days', false, 'sample_data_migration'),

-- SSN pseudonyms (masked)
(uuid_generate_v4(), encode(sha256('123-45-6789'::bytea), 'hex'), '***-**-9999', 'ssn', 'tax_document', CURRENT_TIMESTAMP - INTERVAL '35 days', CURRENT_TIMESTAMP - INTERVAL '10 days', 1, NULL, false, 'sample_data_migration'),
(uuid_generate_v4(), encode(sha256('987-65-4321'::bytea), 'hex'), '***-**-1234', 'ssn', 'employment_verification', CURRENT_TIMESTAMP - INTERVAL '28 days', CURRENT_TIMESTAMP - INTERVAL '8 days', 1, NULL, false, 'sample_data_migration')
ON CONFLICT (original_hash) DO NOTHING;

-- =====================================
-- ENHANCED REDACTION PATTERNS
-- =====================================

-- Add more realistic custom redaction patterns for testing
-- This supports PIIPatternEditor component with diverse pattern examples

INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority, created_by, usage_count, last_used_at) VALUES
('github_token', '\bgh[pousr]_[A-Za-z0-9]{36}\b', '[GITHUB_TOKEN_REDACTED]', 'GitHub personal access tokens (sample data)', 'api_keys', 10, (SELECT id FROM public.users LIMIT 1), 25, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('aws_access_key', '\bAKIA[0-9A-Z]{16}\b', '[AWS_ACCESS_KEY_REDACTED]', 'AWS access key IDs (sample data)', 'api_keys', 15, (SELECT id FROM public.users LIMIT 1), 18, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('slack_webhook', 'https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+', '[SLACK_WEBHOOK_REDACTED]', 'Slack webhook URLs (sample data)', 'webhooks', 20, (SELECT id FROM public.users LIMIT 1), 12, CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('database_connection', '\b(?:postgres|mysql|mongodb)://[^@]+:[^@]+@[^\s]+', '[DATABASE_CONNECTION_REDACTED]', 'Database connection strings (sample data)', 'database', 25, (SELECT id FROM public.users LIMIT 1), 8, CURRENT_TIMESTAMP - INTERVAL '5 days'),
('jwt_token', '\beyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\b', '[JWT_TOKEN_REDACTED]', 'JSON Web Tokens (sample data)', 'tokens', 30, (SELECT id FROM public.users LIMIT 1), 35, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
('docker_registry_token', '\bdckr_pat_[A-Za-z0-9_-]{36,}\b', '[DOCKER_TOKEN_REDACTED]', 'Docker registry tokens (sample data)', 'api_keys', 35, (SELECT id FROM public.users LIMIT 1), 6, CURRENT_TIMESTAMP - INTERVAL '1 week'),
('stripe_key', '\bsk_(?:test|live)_[A-Za-z0-9]{24,}\b', '[STRIPE_KEY_REDACTED]', 'Stripe API keys (sample data)', 'payment', 40, (SELECT id FROM public.users LIMIT 1), 14, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('openai_api_key', '\bsk-[A-Za-z0-9]{48,}\b', '[OPENAI_API_KEY_REDACTED]', 'OpenAI API keys (sample data)', 'ai_services', 45, (SELECT id FROM public.users LIMIT 1), 42, CURRENT_TIMESTAMP - INTERVAL '30 minutes');

-- =====================================
-- ADDITIONAL PSEUDONYM DICTIONARY ENTRIES
-- =====================================

-- Add more diverse dictionary entries for realistic pseudonym generation
INSERT INTO public.pseudonym_dictionaries (data_type, category, value, frequency_weight) VALUES
-- More first names
('name', 'first_names', 'Alexander', 9),
('name', 'first_names', 'Elizabeth', 9),
('name', 'first_names', 'Robert', 8),
('name', 'first_names', 'Jennifer', 8),
('name', 'first_names', 'William', 7),
('name', 'first_names', 'Linda', 7),
('name', 'first_names', 'James', 6),
('name', 'first_names', 'Patricia', 6),

-- More last names
('name', 'last_names', 'Anderson', 7),
('name', 'last_names', 'Taylor', 6),
('name', 'last_names', 'Thomas', 6),
('name', 'last_names', 'Jackson', 5),
('name', 'last_names', 'White', 5),
('name', 'last_names', 'Harris', 4),
('name', 'last_names', 'Martin', 4),
('name', 'last_names', 'Thompson', 3),

-- More email domains
('email', 'domains', 'testmail.com', 7),
('email', 'domains', 'demosite.org', 5),
('email', 'domains', 'samplebox.net', 4),
('email', 'domains', 'examplecorp.com', 3),

-- City names for addresses
('address', 'cities', 'Springfield', 8),
('address', 'cities', 'Riverside', 6),
('address', 'cities', 'Franklin', 5),
('address', 'cities', 'Georgetown', 4),
('address', 'cities', 'Clinton', 3),

-- More street names
('address', 'street_names', 'Washington', 8),
('address', 'street_names', 'Lincoln', 6),
('address', 'street_names', 'Jefferson', 5),
('address', 'street_names', 'Madison', 4),
('address', 'street_names', 'Adams', 3);

-- =====================================
-- SAMPLE SENSITIVE DATA VAULT ENTRIES
-- =====================================

-- Add some vault entries for reversible pseudonyms (encrypted placeholders)
-- This supports the reversibility demonstration in PseudonymMappingViewer

INSERT INTO public.sensitive_data_vault (
    id,
    pseudonym_mapping_id,
    encrypted_original,
    encryption_key_id,
    access_level,
    created_at,
    retention_until
)
SELECT 
    uuid_generate_v4() as id,
    pm.id as pseudonym_mapping_id,
    'ENCRYPTED_' || encode(sha256(pm.pseudonym::bytea), 'hex') as encrypted_original, -- Placeholder encrypted data
    'sample_key_' || (random() * 100)::int as encryption_key_id,
    CASE 
        WHEN pm.data_type IN ('credit_card', 'ssn') THEN 'admin_only'
        ELSE 'authorized_users'
    END as access_level,
    pm.created_at,
    CASE 
        WHEN pm.data_type IN ('credit_card', 'ssn') THEN CURRENT_TIMESTAMP + INTERVAL '7 years'
        ELSE CURRENT_TIMESTAMP + INTERVAL '2 years'
    END as retention_until
FROM public.pseudonym_mappings pm
WHERE pm.is_reversible = true
    AND pm.created_by_system = 'sample_data_migration';

-- =====================================
-- UPDATE STATISTICS AND REFRESH VIEWS
-- =====================================

-- Update usage statistics for patterns
UPDATE public.redaction_patterns 
SET last_used_at = CURRENT_TIMESTAMP - (random() * INTERVAL '7 days')
WHERE description LIKE '%sample data%';

-- Refresh materialized views if any exist
-- (None currently defined, but this is where they would be refreshed)

-- =====================================
-- VERIFICATION QUERIES (Comments)
-- =====================================

/*
-- Verify sample data was inserted correctly:

-- Check LLM usage data
SELECT 
    DATE(started_at) as date,
    COUNT(*) as requests,
    AVG(duration_ms) as avg_duration,
    SUM(CASE WHEN data_sanitization_applied THEN 1 ELSE 0 END) as sanitized_count
FROM public.llm_usage 
WHERE metadata->>'is_sample_data' = 'true'
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- Check redaction audit data
SELECT 
    operation_type,
    data_type,
    COUNT(*) as count,
    AVG(processing_time_ms) as avg_time
FROM public.redaction_audit_log
WHERE metadata->>'is_sample_data' = 'true'
GROUP BY operation_type, data_type;

-- Check pseudonym mappings
SELECT 
    data_type,
    COUNT(*) as count,
    AVG(usage_count) as avg_usage,
    COUNT(*) FILTER (WHERE is_reversible) as reversible_count
FROM public.pseudonym_mappings
WHERE created_by_system = 'sample_data_migration'
GROUP BY data_type;

-- Check redaction patterns
SELECT 
    category,
    COUNT(*) as count,
    SUM(usage_count) as total_usage
FROM public.redaction_patterns
WHERE description LIKE '%sample data%'
GROUP BY category;
*/

-- =====================================
-- FINAL NOTES
-- =====================================

-- This migration provides comprehensive sample data for:
-- 1. LLMUsageAnalytics: 500 realistic LLM usage records with sanitization metrics
-- 2. PrivacyMetricsDashboard: Aggregated privacy and compliance data
-- 3. SanitizationInspector: Audit logs showing processing phases and results
-- 4. AdminSettingsPage: System statistics and configuration data
-- 5. PseudonymMappingViewer: Realistic pseudonym mappings with usage history
-- 6. PIIPatternEditor: Diverse redaction patterns for testing

-- All sample data is marked with metadata flags for easy identification and cleanup
-- The data includes realistic distributions, trends, and relationships
-- Privacy-sensitive fields use appropriate placeholder or encrypted values
-- The migration is designed to be run multiple times safely (includes cleanup)

COMMENT ON SCHEMA public IS 'Schema updated with comprehensive sample data for frontend component testing - Migration 20250904205911';
