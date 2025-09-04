-- =====================================
-- VIP LIST SETUP GUIDE
-- =====================================

-- STEP 1: Add VIP Executive Names for Detection
INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority) VALUES
('vip_tech_ceos', '\b(?:Tim Cook|Elon Musk|Jeff Bezos|Satya Nadella|Mark Zuckerberg|Sundar Pichai)\b', '[VIP_CEO]', 'Tech CEO names for pseudonymization', 'pii_custom', 5),
('vip_finance_leaders', '\b(?:Jamie Dimon|Brian Moynihan|David Solomon|Jane Fraser)\b', '[VIP_FINANCE_LEADER]', 'Finance industry leaders', 'pii_custom', 6),
('vip_company_names', '\b(?:Apple|Microsoft|Google|Amazon|Tesla|Meta|Netflix|Salesforce)\b', '[VIP_COMPANY]', 'Major tech companies', 'pii_custom', 10);

-- STEP 2: Add Custom Entity Patterns
INSERT INTO public.redaction_patterns (name, pattern_regex, replacement, description, category, priority) VALUES
('custom_project_codenames', '\b(?:Project Titan|Project Loon|Project Glass|Project X)\b', '[PROJECT_CODENAME]', 'Confidential project names', 'pii_custom', 15),
('custom_internal_systems', '\b(?:HRMS-\d+|FIN-SYS-\d+|ERP-[A-Z0-9]+)\b', '[INTERNAL_SYSTEM]', 'Internal system identifiers', 'pii_custom', 20);

-- STEP 3: Add Executive-Style Pseudonym Dictionaries
INSERT INTO public.pseudonym_dictionaries (data_type, category, value, frequency_weight) VALUES
-- Executive first names
('name', 'first_names_executive', 'Alexander', 10),
('name', 'first_names_executive', 'Victoria', 10),
('name', 'first_names_executive', 'Jonathan', 9),
('name', 'first_names_executive', 'Catherine', 9),
('name', 'first_names_executive', 'Theodore', 8),
('name', 'first_names_executive', 'Elizabeth', 8),
('name', 'first_names_executive', 'Sebastian', 7),
('name', 'first_names_executive', 'Anastasia', 7),

-- Executive last names
('name', 'last_names_executive', 'Sterling', 10),
('name', 'last_names_executive', 'Whitman', 9),
('name', 'last_names_executive', 'Harrison', 9),
('name', 'last_names_executive', 'Montgomery', 8),
('name', 'last_names_executive', 'Blackwell', 8),
('name', 'last_names_executive', 'Thornton', 7),
('name', 'last_names_executive', 'Wellington', 7),

-- Professional email domains
('email', 'domains_executive', 'strategic-solutions.com', 8),
('email', 'domains_executive', 'executive-group.org', 7),
('email', 'domains_executive', 'leadership-corp.net', 6),
('email', 'domains_executive', 'premier-consulting.co', 5);

-- STEP 4: Verification Queries
-- Run these to check your setup:

-- View all custom PII patterns
-- SELECT name, pattern_regex, replacement, priority FROM public.redaction_patterns WHERE category = 'pii_custom' ORDER BY priority;

-- View pseudonym dictionaries
-- SELECT data_type, category, COUNT(*) as word_count FROM public.pseudonym_dictionaries GROUP BY data_type, category ORDER BY data_type;

-- Test pattern matching (example)
-- SELECT name, pattern_regex FROM public.redaction_patterns WHERE 'Tim Cook from Apple' ~ pattern_regex;
