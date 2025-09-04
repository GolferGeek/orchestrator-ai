-- VIP List & Custom Pseudonym Pattern Examples
-- Add these to your Supabase database

-- =====================================
-- VIP NAMES - High Priority Detection
-- =====================================

-- VIP Executive Names (will be detected and pseudonymized)
INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority) VALUES
('vip_ceo_names', '\b(?:John Smith|Sarah Johnson|Michael Davis|Jennifer Wilson|David Brown)\b', '[VIP_NAME]', 'VIP Executive Names', 'pii_custom', 5),
('vip_company_names', '\b(?:Acme Corp|Globodyne Inc|Initech|Wayne Enterprises|Stark Industries)\b', '[VIP_COMPANY]', 'VIP Company Names', 'pii_custom', 10),
('vip_project_codenames', '\b(?:Project Alpha|Operation Beta|Initiative Gamma|Mission Delta)\b', '[VIP_PROJECT]', 'VIP Project Codenames', 'pii_custom', 15);

-- =====================================
-- CUSTOM ENTITY PATTERNS
-- =====================================

-- Custom Employee IDs
INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority) VALUES
('custom_employee_id_format', '\b[A-Z]{2}[0-9]{4,6}\b', '[EMPLOYEE_ID]', 'Custom Employee ID Format (XX1234)', 'pii_custom', 20),
('custom_customer_id', '\bCUST-[0-9]{6,8}\b', '[CUSTOMER_ID]', 'Customer ID Format (CUST-123456)', 'pii_custom', 25),
('custom_internal_email_domain', '\b[a-zA-Z0-9._%+-]+@(?:internal\.company\.com|corp\.acme\.org)\b', '[INTERNAL_EMAIL]', 'Internal Company Email Domains', 'pii_custom', 30);

-- =====================================
-- ENHANCED PSEUDONYM DICTIONARIES
-- =====================================

-- VIP-Style First Names for Pseudonyms
INSERT INTO public.pseudonym_dictionaries (data_type, category, value, frequency_weight) VALUES
-- Executive-sounding first names
('name', 'first_names_executive', 'Alexander', 9),
('name', 'first_names_executive', 'Victoria', 9),
('name', 'first_names_executive', 'Jonathan', 8),
('name', 'first_names_executive', 'Catherine', 8),
('name', 'first_names_executive', 'Theodore', 7),
('name', 'first_names_executive', 'Elizabeth', 7),

-- Executive-sounding last names
('name', 'last_names_executive', 'Sterling', 9),
('name', 'last_names_executive', 'Whitman', 8),
('name', 'last_names_executive', 'Harrison', 8),
('name', 'last_names_executive', 'Montgomery', 7),
('name', 'last_names_executive', 'Blackwell', 7),
('name', 'last_names_executive', 'Thornton', 6),

-- Professional email domains for pseudonyms
('email', 'domains_professional', 'executive-group.com', 8),
('email', 'domains_professional', 'leadership-corp.org', 7),
('email', 'domains_professional', 'strategic-solutions.net', 6),
('email', 'domains_professional', 'premier-consulting.co', 5);

-- =====================================
-- VERIFICATION QUERIES
-- =====================================

-- Check what patterns are active
-- SELECT name, pattern_regex, category, priority FROM public.redaction_patterns WHERE category = 'pii_custom' ORDER BY priority;

-- Check pseudonym dictionaries
-- SELECT data_type, category, value, frequency_weight FROM public.pseudonym_dictionaries ORDER BY data_type, category, frequency_weight DESC;
