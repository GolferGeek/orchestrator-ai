-- ============================================================================
-- Complete Database Seed Data (DML)
-- ============================================================================
-- This file inserts all data into the database structures.
-- 
-- Prerequisites:
-- 1. Run the corresponding *_complete_schema.sql file first
-- 2. Ensure all tables exist before running this file
--
-- Includes data from:
-- - public schema (all tables)
-- - n8n schema (all tables)  
-- - company schema (all tables)
-- - auth.users table
--
-- Data is inserted in dependency order to avoid foreign key violations.
-- ============================================================================

BEGIN;

-- Temporarily disable triggers for faster bulk insert
SET session_replication_role = replica;

-- Insert data
-- ============================================================================

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES
	('00000000-0000-0000-0000-000000000000', 'c4d5e6f7-8901-2345-6789-abcdef012345', 'authenticated', 'authenticated', 'golfergeek@orchestratorai.io', '$2a$06$NB.M8iX6siiAjTcCGdqevOqO6Xj1eicVIZ/I1cgwlGWDMUqTMxMNm', '2025-10-09 19:28:38.352108+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, NULL, NULL, NULL, '2025-10-09 19:28:38.352108+00', '2025-10-09 19:28:38.352108+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b29a590e-b07f-49df-a25b-574c956b5035', 'authenticated', 'authenticated', 'demo.user@orchestratorai.io', '$2a$06$KWFal7djFAv2drTJR1a3COiCpnRuC1fG/delGybibrECm.gETu8Cy', '2025-10-09 19:18:09.981049+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-10-10 13:38:15.145697+00', NULL, NULL, NULL, '2025-10-09 19:18:09.981049+00', '2025-10-10 13:38:15.147052+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'authenticated', 'authenticated', 'admin@orchestratorai.io', '$2a$06$M40tadYZqPNpdspfzoJef.VXKwZn2919vkslDzYGS3k8RqZSNmLoC', '2025-10-09 19:28:38.352108+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-10-13 18:08:52.540281+00', NULL, NULL, NULL, '2025-10-09 19:28:38.352108+00', '2025-10-13 19:59:33.483214+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- PostgreSQL database dump complete
--


-- ============================================================================
-- Post-Insert Tasks
-- ============================================================================

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Update sequences to prevent ID conflicts
-- This ensures auto-incrementing IDs start after existing data
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    -- Find all sequences and update them
    FOR seq_record IN 
        SELECT 
            schemaname || '.' || sequencename AS full_sequence,
            schemaname,
            sequencename
        FROM pg_sequences
        WHERE schemaname IN ('public', 'n8n', 'company')
    LOOP
        BEGIN
            -- Try to update the sequence
            EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 1), true)',
                seq_record.full_sequence,
                replace(seq_record.sequencename, '_id_seq', '') || '_id',
                seq_record.schemaname,
                replace(seq_record.sequencename, '_id_seq', '')
            );
        EXCEPTION
            WHEN OTHERS THEN
                -- Sequence might not correspond to a table column, skip it
                RAISE NOTICE 'Could not update sequence %', seq_record.full_sequence;
        END;
    END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- 
-- Verify the data was loaded correctly:
-- 
-- SELECT schemaname, tablename, n_live_tup as row_count 
-- FROM pg_stat_user_tables 
-- WHERE schemaname IN ('public', 'n8n', 'company')
-- ORDER BY schemaname, tablename;
--
-- ============================================================================

