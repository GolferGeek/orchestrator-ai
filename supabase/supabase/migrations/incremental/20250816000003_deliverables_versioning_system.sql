-- Implement new deliverables versioning system
-- One conversation -> One deliverable -> Multiple versions

-- Start transaction
BEGIN;

-- =====================================
-- MODIFY EXISTING DELIVERABLES TABLE
-- =====================================

-- Drop columns we no longer need (they move to versions table)
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS content CASCADE;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS format CASCADE;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS version CASCADE;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS metadata CASCADE;
ALTER TABLE public.deliverables DROP COLUMN IF EXISTS file_attachments CASCADE;

-- Add optional project step linking
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS project_step_id UUID REFERENCES public.project_steps(id) ON DELETE SET NULL;

-- Add unique constraint on conversation_id (one deliverable per conversation)
ALTER TABLE public.deliverables ADD CONSTRAINT unique_deliverable_per_conversation 
    UNIQUE (conversation_id);

-- =====================================
-- CREATE DELIVERABLE VERSIONS TABLE
-- =====================================

CREATE TABLE public.deliverable_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT,
    format VARCHAR(100),
    is_current_version BOOLEAN DEFAULT false,
    
    -- Track how this version was created
    created_by_type VARCHAR(50) DEFAULT 'ai_response' CHECK (
        created_by_type IN ('ai_response', 'manual_edit', 'ai_enhancement', 'user_request')
    ),
    
    -- Optional task linking for versions created by specific tasks
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    
    -- Flexible metadata for version-specific info
    metadata JSONB DEFAULT '{}',
    file_attachments JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique version numbers per deliverable
    CONSTRAINT unique_version_number_per_deliverable 
        UNIQUE (deliverable_id, version_number),
    
    -- Ensure only one current version per deliverable
    CONSTRAINT unique_current_version_per_deliverable 
        EXCLUDE (deliverable_id WITH =) WHERE (is_current_version = true)
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Deliverables indexes (updated) - use IF NOT EXISTS to avoid conflicts
CREATE INDEX IF NOT EXISTS idx_deliverables_conversation_id ON public.deliverables(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_project_step_id ON public.deliverables(project_step_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_type ON public.deliverables(type);

-- Versions indexes  
CREATE INDEX idx_deliverable_versions_deliverable_id ON public.deliverable_versions(deliverable_id);
CREATE INDEX idx_deliverable_versions_current ON public.deliverable_versions(deliverable_id, is_current_version);
CREATE INDEX idx_deliverable_versions_task_id ON public.deliverable_versions(task_id);
CREATE INDEX idx_deliverable_versions_created_by_type ON public.deliverable_versions(created_by_type);
CREATE INDEX idx_deliverable_versions_version_number ON public.deliverable_versions(deliverable_id, version_number);

-- =====================================
-- TRIGGERS
-- =====================================

-- Add trigger for deliverable_versions updated_at
CREATE TRIGGER update_deliverable_versions_updated_at BEFORE UPDATE ON public.deliverable_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================
-- ROW LEVEL SECURITY
-- =====================================

-- Enable RLS on new table
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;

-- Deliverable versions are visible to deliverable owners
CREATE POLICY "Users can view own deliverable versions" ON public.deliverable_versions
    FOR ALL USING (
        auth.uid() = (
            SELECT d.user_id 
            FROM public.deliverables d 
            WHERE d.id = deliverable_id
        )
    );

-- =====================================
-- GRANTS
-- =====================================

GRANT ALL ON public.deliverable_versions TO authenticated;
GRANT SELECT ON public.deliverable_versions TO anon;

-- =====================================
-- HELPER FUNCTIONS
-- =====================================

-- Drop existing functions if they exist (from previous migration attempts)
-- Try multiple possible signatures to clean up any previous attempts
DROP FUNCTION IF EXISTS public.get_current_deliverable_version(UUID);
DROP FUNCTION IF EXISTS public.get_current_deliverable_version CASCADE;

DROP FUNCTION IF EXISTS public.create_deliverable_version(UUID, TEXT, VARCHAR(100), VARCHAR(50), UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_deliverable_version(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_deliverable_version(UUID, TEXT, VARCHAR(100));
DROP FUNCTION IF EXISTS public.create_deliverable_version(UUID, TEXT, VARCHAR(100), VARCHAR(50));
DROP FUNCTION IF EXISTS public.create_deliverable_version(UUID, TEXT, VARCHAR(100), VARCHAR(50), UUID);
DROP FUNCTION IF EXISTS public.create_deliverable_version CASCADE;

-- Function to get current version of a deliverable
CREATE OR REPLACE FUNCTION public.get_current_deliverable_version(deliverable_uuid UUID)
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    content TEXT,
    format VARCHAR(100),
    created_by_type VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dv.id,
        dv.version_number,
        dv.content,
        dv.format,
        dv.created_by_type,
        dv.metadata,
        dv.created_at
    FROM public.deliverable_versions dv
    WHERE dv.deliverable_id = deliverable_uuid
      AND dv.is_current_version = true;
END;
$$;

-- Function to create new version (handles version numbering and current flag)
CREATE OR REPLACE FUNCTION public.create_deliverable_version(
    deliverable_uuid UUID,
    version_content TEXT,
    version_format VARCHAR(100) DEFAULT NULL,
    creation_type VARCHAR(50) DEFAULT 'ai_response',
    version_task_id UUID DEFAULT NULL,
    version_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_version_number INTEGER;
    new_version_id UUID;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version_number
    FROM public.deliverable_versions
    WHERE deliverable_id = deliverable_uuid;
    
    -- Unset current version flag on existing versions
    UPDATE public.deliverable_versions 
    SET is_current_version = false
    WHERE deliverable_id = deliverable_uuid 
      AND is_current_version = true;
    
    -- Create new version
    INSERT INTO public.deliverable_versions (
        deliverable_id,
        version_number,
        content,
        format,
        created_by_type,
        task_id,
        metadata,
        is_current_version
    ) VALUES (
        deliverable_uuid,
        next_version_number,
        version_content,
        version_format,
        creation_type,
        version_task_id,
        version_metadata,
        true
    ) RETURNING id INTO new_version_id;
    
    RETURN new_version_id;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_current_deliverable_version(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_deliverable_version(UUID, TEXT, VARCHAR(100), VARCHAR(50), UUID, JSONB) TO authenticated;

-- =====================================
-- COMMENTS
-- =====================================

COMMENT ON TABLE public.deliverable_versions IS 'Version history for deliverables - each deliverable can have multiple versions tracking edits and enhancements';
COMMENT ON COLUMN public.deliverable_versions.created_by_type IS 'How this version was created: ai_response, manual_edit, ai_enhancement, user_request';
COMMENT ON COLUMN public.deliverable_versions.is_current_version IS 'Only one version per deliverable can be current (enforced by unique constraint)';
COMMENT ON FUNCTION public.create_deliverable_version IS 'Helper function to create new deliverable version with proper version numbering and current flag management';

COMMIT;