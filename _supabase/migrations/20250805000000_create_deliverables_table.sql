-- Migration: Create deliverables table with versioning support
-- Date: 2025-08-05
-- Description: Creates the deliverables table to persist agent-generated deliverables
--              with version management and user organization capabilities

-- Create deliverables table
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    
    -- Core deliverable data
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    deliverable_type TEXT NOT NULL CHECK (deliverable_type IN (
        'document', 'analysis', 'report', 'plan', 'requirements'
    )),
    format TEXT NOT NULL CHECK (format IN (
        'markdown', 'text', 'json', 'html'
    )),
    
    -- Versioning support
    version INTEGER NOT NULL DEFAULT 1,
    parent_deliverable_id UUID REFERENCES public.deliverables(id) ON DELETE SET NULL,
    is_latest_version BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata and organization
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Agent context
    created_by_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_deliverables_user_id ON public.deliverables(user_id);
CREATE INDEX idx_deliverables_conversation_id ON public.deliverables(conversation_id);
CREATE INDEX idx_deliverables_parent_id ON public.deliverables(parent_deliverable_id);
CREATE INDEX idx_deliverables_latest_version ON public.deliverables(user_id, is_latest_version) WHERE is_latest_version = true;
CREATE INDEX idx_deliverables_type ON public.deliverables(deliverable_type);
CREATE INDEX idx_deliverables_created_at ON public.deliverables(created_at DESC);
CREATE INDEX idx_deliverables_tags ON public.deliverables USING gin(tags);

-- Enable Row Level Security
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see and manage their own deliverables
CREATE POLICY "Users can manage their own deliverables"
ON public.deliverables
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Update trigger for updated_at timestamp
CREATE TRIGGER handle_deliverables_updated_at
    BEFORE UPDATE ON public.deliverables
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create new version of deliverable
CREATE OR REPLACE FUNCTION public.create_deliverable_version(
    parent_id UUID,
    new_title TEXT,
    new_content TEXT,
    new_metadata JSONB DEFAULT '{}',
    created_by_agent_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    parent_record public.deliverables%ROWTYPE;
    new_version_num INTEGER;
    new_deliverable_id UUID;
    root_parent_id UUID;
BEGIN
    -- Get parent record
    SELECT * INTO parent_record FROM public.deliverables WHERE id = parent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent deliverable not found';
    END IF;
    
    -- Ensure user owns the parent deliverable
    IF parent_record.user_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Cannot create version of deliverable owned by another user';
    END IF;
    
    -- Determine root parent (for version trees)
    root_parent_id := COALESCE(parent_record.parent_deliverable_id, parent_id);
    
    -- Calculate new version number (max version in the entire tree + 1)
    SELECT COALESCE(MAX(version), 0) + 1 INTO new_version_num
    FROM public.deliverables 
    WHERE parent_deliverable_id = root_parent_id OR id = root_parent_id;
    
    -- Mark all versions in this tree as not latest
    UPDATE public.deliverables 
    SET is_latest_version = false 
    WHERE (parent_deliverable_id = root_parent_id OR id = root_parent_id);
    
    -- Create new version
    INSERT INTO public.deliverables (
        user_id, conversation_id, message_id,
        title, content, deliverable_type, format,
        version, parent_deliverable_id, is_latest_version,
        metadata, tags, created_by_agent
    ) VALUES (
        parent_record.user_id, 
        parent_record.conversation_id, 
        parent_record.message_id,
        new_title, 
        new_content, 
        parent_record.deliverable_type, 
        parent_record.format,
        new_version_num, 
        root_parent_id, 
        true,
        new_metadata, 
        parent_record.tags,
        created_by_agent_name
    ) RETURNING id INTO new_deliverable_id;
    
    RETURN new_deliverable_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get version history for a deliverable
CREATE OR REPLACE FUNCTION public.get_deliverable_versions(deliverable_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    version INTEGER,
    is_latest_version BOOLEAN,
    created_at TIMESTAMPTZ,
    created_by_agent TEXT,
    content_preview TEXT
) AS $$
DECLARE
    root_id UUID;
BEGIN
    -- Find the root deliverable ID
    SELECT COALESCE(parent_deliverable_id, deliverable_id) INTO root_id
    FROM public.deliverables 
    WHERE public.deliverables.id = deliverable_id
    AND user_id = auth.uid();
    
    IF root_id IS NULL THEN
        RAISE EXCEPTION 'Deliverable not found or access denied';
    END IF;
    
    -- Return all versions in the tree
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.version,
        d.is_latest_version,
        d.created_at,
        d.created_by_agent,
        LEFT(d.content, 200) || CASE WHEN LENGTH(d.content) > 200 THEN '...' ELSE '' END as content_preview
    FROM public.deliverables d
    WHERE (d.id = root_id OR d.parent_deliverable_id = root_id)
    AND d.user_id = auth.uid()
    ORDER BY d.version DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search deliverables
CREATE OR REPLACE FUNCTION public.search_deliverables(
    search_term TEXT DEFAULT NULL,
    filter_type TEXT DEFAULT NULL,
    filter_format TEXT DEFAULT NULL,
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    deliverable_type TEXT,
    format TEXT,
    version INTEGER,
    is_latest_version BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    created_by_agent TEXT,
    content_preview TEXT,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.deliverable_type,
        d.format,
        d.version,
        d.is_latest_version,
        d.created_at,
        d.updated_at,
        d.created_by_agent,
        LEFT(d.content, 200) || CASE WHEN LENGTH(d.content) > 200 THEN '...' ELSE '' END as content_preview,
        d.tags
    FROM public.deliverables d
    WHERE d.user_id = auth.uid()
    AND (search_term IS NULL OR (
        d.title ILIKE '%' || search_term || '%' 
        OR d.content ILIKE '%' || search_term || '%'
        OR EXISTS (SELECT 1 FROM unnest(d.tags) tag WHERE tag ILIKE '%' || search_term || '%')
    ))
    AND (filter_type IS NULL OR d.deliverable_type = filter_type)
    AND (filter_format IS NULL OR d.format = filter_format)
    ORDER BY d.updated_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.create_deliverable_version(UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deliverable_versions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_deliverables(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;