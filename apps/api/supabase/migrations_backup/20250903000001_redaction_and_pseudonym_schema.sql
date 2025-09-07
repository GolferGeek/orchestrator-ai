-- Redaction and Pseudonym Management Schema
-- Contains tables for secret redaction patterns, pseudonym mappings, and audit trails
-- All tables in public schema for accessibility

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================
-- REDACTION PATTERNS MANAGEMENT
-- =====================================

-- Custom redaction patterns - extends the built-in patterns in SecretRedactionService
CREATE TABLE public.redaction_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    pattern_regex TEXT NOT NULL,
    replacement VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'custom',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast pattern lookup
CREATE INDEX idx_redaction_patterns_active ON public.redaction_patterns (is_active, priority);
CREATE INDEX idx_redaction_patterns_category ON public.redaction_patterns (category);

-- =====================================
-- PSEUDONYM MAPPINGS
-- =====================================

-- Data types that can be pseudonymized
CREATE TYPE public.pii_data_type AS ENUM (
    'email',
    'phone',
    'name',
    'address',
    'ip_address',
    'username',
    'credit_card',
    'ssn',
    'custom'
);

-- Main pseudonym mappings table
CREATE TABLE public.pseudonym_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of original value
    pseudonym VARCHAR(500) NOT NULL,
    data_type public.pii_data_type NOT NULL,
    context VARCHAR(255), -- Optional context (e.g., 'user_registration', 'support_ticket')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration for temporary pseudonyms
    is_reversible BOOLEAN DEFAULT false, -- Whether original can be retrieved (for authorized users)
    created_by_system VARCHAR(100) DEFAULT 'secret_redaction_service'
);

-- Indexes for fast lookups
CREATE INDEX idx_pseudonym_mappings_hash ON public.pseudonym_mappings (original_hash);
CREATE INDEX idx_pseudonym_mappings_type ON public.pseudonym_mappings (data_type);
CREATE INDEX idx_pseudonym_mappings_context ON public.pseudonym_mappings (context);
CREATE INDEX idx_pseudonym_mappings_expires ON public.pseudonym_mappings (expires_at) WHERE expires_at IS NOT NULL;

-- =====================================
-- REDACTION AUDIT TRAIL
-- =====================================

-- Audit trail for redaction operations
CREATE TABLE public.redaction_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255), -- Links to LLM request/session
    run_id UUID, -- Links to run metadata if available
    operation_type VARCHAR(50) NOT NULL, -- 'redact', 'pseudonymize', 'pattern_match'
    data_type public.pii_data_type,
    pattern_name VARCHAR(255), -- Which pattern was matched
    original_length INTEGER,
    redacted_length INTEGER,
    pseudonym_count INTEGER DEFAULT 0,
    redaction_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    service_name VARCHAR(100) DEFAULT 'secret_redaction_service',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for audit queries
CREATE INDEX idx_redaction_audit_session ON public.redaction_audit_log (session_id);
CREATE INDEX idx_redaction_audit_run ON public.redaction_audit_log (run_id);
CREATE INDEX idx_redaction_audit_user ON public.redaction_audit_log (user_id);
CREATE INDEX idx_redaction_audit_created ON public.redaction_audit_log (created_at);
CREATE INDEX idx_redaction_audit_operation ON public.redaction_audit_log (operation_type);

-- =====================================
-- PSEUDONYM DICTIONARIES
-- =====================================

-- Dictionary of fake names, addresses, etc. for consistent pseudonym generation
CREATE TABLE public.pseudonym_dictionaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type public.pii_data_type NOT NULL,
    category VARCHAR(100), -- e.g., 'first_names', 'last_names', 'street_names'
    value VARCHAR(500) NOT NULL,
    locale VARCHAR(10) DEFAULT 'en-US',
    frequency_weight INTEGER DEFAULT 1, -- For weighted random selection
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for dictionary lookups
CREATE INDEX idx_pseudonym_dict_type ON public.pseudonym_dictionaries (data_type, is_active);
CREATE INDEX idx_pseudonym_dict_category ON public.pseudonym_dictionaries (category, is_active);
CREATE INDEX idx_pseudonym_dict_locale ON public.pseudonym_dictionaries (locale);

-- =====================================
-- SENSITIVE DATA VAULT (Optional - for reversible pseudonyms)
-- =====================================

-- Encrypted storage for original values (only if reversible pseudonyms are enabled)
-- This table should have strict access controls
CREATE TABLE public.sensitive_data_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pseudonym_mapping_id UUID REFERENCES public.pseudonym_mappings(id) ON DELETE CASCADE,
    encrypted_original TEXT, -- AES encrypted original value
    encryption_key_id VARCHAR(100), -- Reference to key management system
    access_level VARCHAR(50) DEFAULT 'admin_only', -- 'admin_only', 'authorized_users'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    retention_until TIMESTAMP WITH TIME ZONE -- Data retention policy
);

-- Strict indexes for vault access
CREATE INDEX idx_sensitive_vault_mapping ON public.sensitive_data_vault (pseudonym_mapping_id);
CREATE INDEX idx_sensitive_vault_retention ON public.sensitive_data_vault (retention_until);

-- =====================================
-- ROW LEVEL SECURITY
-- =====================================

-- Enable RLS on sensitive tables
ALTER TABLE public.sensitive_data_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redaction_audit_log ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be extended based on requirements)
CREATE POLICY "vault_access_admin_only" ON public.sensitive_data_vault
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                roles @> '["admin"]'::jsonb
                OR (roles::text LIKE '%admin%')
            )
        )
    );

CREATE POLICY "audit_log_read_own_or_admin" ON public.redaction_audit_log
    FOR SELECT USING (
        user_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND (
                roles @> '["admin"]'::jsonb
                OR (roles::text LIKE '%admin%')
            )
        )
    );

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_redaction_patterns_updated_at
    BEFORE UPDATE ON public.redaction_patterns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment usage counters
CREATE OR REPLACE FUNCTION public.increment_usage_counter()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count and last used timestamp
    NEW.usage_count = COALESCE(OLD.usage_count, 0) + 1;
    NEW.last_used_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================
-- INITIAL DATA
-- =====================================

-- Insert common pseudonym dictionary data
INSERT INTO public.pseudonym_dictionaries (data_type, category, value, frequency_weight) VALUES
-- First names
('name', 'first_names', 'John', 10),
('name', 'first_names', 'Jane', 10),
('name', 'first_names', 'Michael', 8),
('name', 'first_names', 'Sarah', 8),
('name', 'first_names', 'David', 7),
('name', 'first_names', 'Lisa', 7),
('name', 'first_names', 'Chris', 6),
('name', 'first_names', 'Anna', 6),

-- Last names
('name', 'last_names', 'Smith', 10),
('name', 'last_names', 'Johnson', 9),
('name', 'last_names', 'Williams', 8),
('name', 'last_names', 'Brown', 8),
('name', 'last_names', 'Jones', 7),
('name', 'last_names', 'Garcia', 6),
('name', 'last_names', 'Miller', 6),
('name', 'last_names', 'Davis', 5),

-- Email domains for pseudonym generation
('email', 'domains', 'example.com', 10),
('email', 'domains', 'test.org', 8),
('email', 'domains', 'sample.net', 6),
('email', 'domains', 'demo.co', 4),

-- Street names for addresses
('address', 'street_names', 'Main', 10),
('address', 'street_names', 'First', 8),
('address', 'street_names', 'Second', 7),
('address', 'street_names', 'Park', 6),
('address', 'street_names', 'Oak', 5),
('address', 'street_names', 'Pine', 4);

-- Insert default redaction patterns (extending built-in ones)
INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority) VALUES
('custom_employee_id', '\b[A-Z]{2}\d{4,6}\b', '[EMP_ID_REDACTED]', 'Employee ID patterns', 'corporate', 50),
('custom_invoice_number', '\bINV-\d{4,8}\b', '[INVOICE_REDACTED]', 'Invoice number patterns', 'financial', 60),
('custom_ticket_id', '\b(?:TICKET|TKT)-\d{4,8}\b', '[TICKET_REDACTED]', 'Support ticket IDs', 'support', 70),
('custom_account_number', '\b\d{10,12}\b', '[ACCOUNT_REDACTED]', 'Account number patterns', 'financial', 80),
('mac_address', '\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b', '[MAC_ADDRESS_REDACTED]', 'MAC addresses', 'network', 90);

-- =====================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================

COMMENT ON TABLE public.redaction_patterns IS 'Custom redaction patterns extending built-in SecretRedactionService patterns';
COMMENT ON TABLE public.pseudonym_mappings IS 'Mapping table from original PII hashes to consistent pseudonyms';
COMMENT ON TABLE public.redaction_audit_log IS 'Audit trail for all redaction and pseudonymization operations';
COMMENT ON TABLE public.pseudonym_dictionaries IS 'Dictionary data for generating realistic pseudonyms';
COMMENT ON TABLE public.sensitive_data_vault IS 'Encrypted storage for reversible pseudonyms (admin access only)';

COMMENT ON COLUMN public.pseudonym_mappings.original_hash IS 'SHA-256 hash of original PII value for consistent lookup';
COMMENT ON COLUMN public.pseudonym_mappings.is_reversible IS 'Whether original value is stored in vault for authorized reversal';
COMMENT ON COLUMN public.sensitive_data_vault.encrypted_original IS 'AES encrypted original PII value';