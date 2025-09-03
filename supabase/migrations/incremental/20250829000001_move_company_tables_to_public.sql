-- Move company schema tables to public schema
-- This consolidates all tables into a single schema for simplicity

-- First, move the tables from company to public schema
-- We need to handle dependencies in the right order

-- 1. Move independent tables first
ALTER TABLE company.companies SET SCHEMA public;
ALTER TABLE company.kpi_metrics SET SCHEMA public;

-- 2. Move tables with dependencies
ALTER TABLE company.departments SET SCHEMA public;
ALTER TABLE company.kpi_goals SET SCHEMA public;
ALTER TABLE company.kpi_data SET SCHEMA public;

-- Update any sequences that might be associated with these tables
-- (PostgreSQL should handle this automatically, but let's be explicit)
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    -- Find and move any sequences from company schema to public
    FOR seq_record IN 
        SELECT schemaname, sequencename 
        FROM pg_sequences 
        WHERE schemaname = 'company'
    LOOP
        EXECUTE format('ALTER SEQUENCE company.%I SET SCHEMA public', seq_record.sequencename);
    END LOOP;
END $$;

-- Drop the company schema if it's now empty
-- (This will fail if there are any remaining objects, which is what we want)
DROP SCHEMA IF EXISTS company;

-- Add a comment to track this change
COMMENT ON TABLE public.companies IS 'Moved from company schema - contains company information for KPI tracking';
COMMENT ON TABLE public.departments IS 'Moved from company schema - contains department information';
COMMENT ON TABLE public.kpi_data IS 'Moved from company schema - contains actual KPI data points';
COMMENT ON TABLE public.kpi_goals IS 'Moved from company schema - contains KPI targets and goals';
COMMENT ON TABLE public.kpi_metrics IS 'Moved from company schema - contains KPI metric definitions';
