-- =====================================
-- Create Company Schema and Move Company-Related Tables
-- =====================================
-- This migration creates a dedicated 'company' schema and moves all
-- company-related tables from public schema to provide better organization
-- and prepare for multi-tenancy scenarios.

-- Create the company schema
CREATE SCHEMA IF NOT EXISTS company;

-- Move companies table to company schema
DO $$
BEGIN
  -- Check if table exists in public schema
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    -- Move the table
    ALTER TABLE public.companies SET SCHEMA company;
    
    -- Add comment to the table
    COMMENT ON TABLE company.companies IS 'Company information and metadata';
  END IF;
END $$;

-- Move departments table to company schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
    ALTER TABLE public.departments SET SCHEMA company;
    
    COMMENT ON TABLE company.departments IS 'Company departments and organizational structure';
  END IF;
END $$;

-- Move kpi_metrics table to company schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_metrics') THEN
    ALTER TABLE public.kpi_metrics SET SCHEMA company;
    
    COMMENT ON TABLE company.kpi_metrics IS 'KPI metric definitions and metadata';
  END IF;
END $$;

-- Move kpi_goals table to company schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_goals') THEN
    ALTER TABLE public.kpi_goals SET SCHEMA company;
    
    COMMENT ON TABLE company.kpi_goals IS 'Department KPI goals and targets';
  END IF;
END $$;

-- Move kpi_data table to company schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_data') THEN
    ALTER TABLE public.kpi_data SET SCHEMA company;
    
    COMMENT ON TABLE company.kpi_data IS 'Actual KPI data points and measurements';
  END IF;
END $$;

-- Update foreign key constraints to reference company schema
DO $$
BEGIN
  -- Update departments foreign key to reference company.companies
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'company' 
             AND constraint_name = 'departments_company_id_fkey') THEN
    ALTER TABLE company.departments DROP CONSTRAINT IF EXISTS departments_company_id_fkey;
    ALTER TABLE company.departments ADD CONSTRAINT departments_company_id_fkey 
      FOREIGN KEY (company_id) REFERENCES company.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  -- Update kpi_data foreign keys
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'company' 
             AND constraint_name = 'kpi_data_department_id_fkey') THEN
    ALTER TABLE company.kpi_data DROP CONSTRAINT IF EXISTS kpi_data_department_id_fkey;
    ALTER TABLE company.kpi_data ADD CONSTRAINT kpi_data_department_id_fkey 
      FOREIGN KEY (department_id) REFERENCES company.departments(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'company' 
             AND constraint_name = 'kpi_data_metric_id_fkey') THEN
    ALTER TABLE company.kpi_data DROP CONSTRAINT IF EXISTS kpi_data_metric_id_fkey;
    ALTER TABLE company.kpi_data ADD CONSTRAINT kpi_data_metric_id_fkey 
      FOREIGN KEY (metric_id) REFERENCES company.kpi_metrics(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  -- Update kpi_goals foreign keys
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'company' 
             AND constraint_name = 'kpi_goals_department_id_fkey') THEN
    ALTER TABLE company.kpi_goals DROP CONSTRAINT IF EXISTS kpi_goals_department_id_fkey;
    ALTER TABLE company.kpi_goals ADD CONSTRAINT kpi_goals_department_id_fkey 
      FOREIGN KEY (department_id) REFERENCES company.departments(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_schema = 'company' 
             AND constraint_name = 'kpi_goals_metric_id_fkey') THEN
    ALTER TABLE company.kpi_goals DROP CONSTRAINT IF EXISTS kpi_goals_metric_id_fkey;
    ALTER TABLE company.kpi_goals ADD CONSTRAINT kpi_goals_metric_id_fkey 
      FOREIGN KEY (metric_id) REFERENCES company.kpi_metrics(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Grant permissions on company schema tables
GRANT ALL ON SCHEMA company TO anon;
GRANT ALL ON SCHEMA company TO authenticated;
GRANT ALL ON SCHEMA company TO service_role;

-- Grant permissions on all company tables
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'company'
    LOOP
        EXECUTE format('GRANT ALL ON TABLE company.%I TO anon', table_name);
        EXECUTE format('GRANT ALL ON TABLE company.%I TO authenticated', table_name);
        EXECUTE format('GRANT ALL ON TABLE company.%I TO service_role', table_name);
    END LOOP;
END $$;

-- Add comments to the schema
COMMENT ON SCHEMA company IS 'Company-related data including organizations, departments, and KPI metrics';
