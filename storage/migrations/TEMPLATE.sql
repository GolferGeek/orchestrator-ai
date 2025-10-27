-- Migration: [Brief description - e.g., "Add user preferences table"]
-- Author: [Your name]
-- Date: [YYYY-MM-DD]
-- Description: [Detailed description of what this changes and why]
--
-- Related: [Link to issue/ticket/discussion if applicable]
-- Dependencies: [Any prerequisites or required data]

-- ============================================
-- Migration Code Below
-- ============================================

-- Example: Create a new table
-- CREATE TABLE public.example_table (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Example: Add a column
-- ALTER TABLE public.existing_table
--   ADD COLUMN new_column TEXT;

-- Example: Create an index
-- CREATE INDEX idx_example_table_name ON public.example_table(name);

-- Example: Add a foreign key
-- ALTER TABLE public.child_table
--   ADD CONSTRAINT fk_child_parent
--   FOREIGN KEY (parent_id) REFERENCES public.parent_table(id);


-- ============================================
-- Rollback Instructions
-- ============================================
-- To rollback this migration, run:
--
-- DROP TABLE IF EXISTS public.example_table CASCADE;
-- ALTER TABLE public.existing_table DROP COLUMN IF EXISTS new_column;
-- DROP INDEX IF EXISTS idx_example_table_name;
