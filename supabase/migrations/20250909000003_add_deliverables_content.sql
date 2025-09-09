
-- Add missing columns to deliverables table
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS format VARCHAR(50) DEFAULT 'markdown';
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS file_attachments JSONB DEFAULT '[]'::jsonb;

