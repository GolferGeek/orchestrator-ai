
-- Add missing type column to deliverables table
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS type VARCHAR(100);

