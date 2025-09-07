-- Migration: Move company tables from company schema to public schema
-- Date: 2025-09-07
-- Description: Fix schema organization - company tables should be in public schema

-- ============================================================================
-- STEP 1: Move tables from company schema to public schema
-- ============================================================================

-- Move companies table
ALTER TABLE company.companies SET SCHEMA public;

-- Move departments table  
ALTER TABLE company.departments SET SCHEMA public;

-- Move any other company schema tables to public
DO $$
DECLARE
    table_record RECORD;
BEGIN
    -- Get all tables in company schema
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'company' 
        AND table_type = 'BASE TABLE'
    LOOP
        -- Move each table to public schema
        EXECUTE format('ALTER TABLE company.%I SET SCHEMA public', table_record.table_name);
        RAISE NOTICE 'Moved table % from company schema to public schema', table_record.table_name;
    END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Drop the empty company schema
-- ============================================================================

DROP SCHEMA IF EXISTS company CASCADE;

-- ============================================================================
-- STEP 3: Update any references or constraints if needed
-- ============================================================================

-- Add comments to indicate the tables are now in public schema
COMMENT ON TABLE public.companies IS 'Company information - moved from company schema to public schema';
COMMENT ON TABLE public.departments IS 'Department information - moved from company schema to public schema';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify companies table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        RAISE NOTICE '✅ companies table successfully moved to public schema';
    ELSE
        RAISE EXCEPTION '❌ companies table not found in public schema';
    END IF;
    
    -- Verify departments table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
        RAISE NOTICE '✅ departments table successfully moved to public schema';
    ELSE
        RAISE EXCEPTION '❌ departments table not found in public schema';
    END IF;
    
    -- Verify company schema is gone
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'company') THEN
        RAISE NOTICE '✅ company schema successfully removed';
    ELSE
        RAISE NOTICE '⚠️ company schema still exists (may contain other objects)';
    END IF;
END $$;