-- Migration: Add hierarchical project support
-- Enables parent-child relationships between projects for subproject functionality

-- Add parent project reference to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS parent_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add hierarchy level for efficient queries (0 = root project, 1 = first level subproject, etc.)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;

-- Add subproject metadata fields
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS subproject_count INTEGER DEFAULT 0;

-- Create index for efficient hierarchical queries
CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON public.projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_hierarchy_level ON public.projects(hierarchy_level);

-- Create function to update subproject count when projects are added/removed
CREATE OR REPLACE FUNCTION update_subproject_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE to parent_project_id
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.parent_project_id IS DISTINCT FROM NEW.parent_project_id) THEN
        -- Increment count for new parent
        IF NEW.parent_project_id IS NOT NULL THEN
            UPDATE projects 
            SET subproject_count = subproject_count + 1 
            WHERE id = NEW.parent_project_id;
        END IF;
        
        -- Decrement count for old parent (UPDATE case)
        IF TG_OP = 'UPDATE' AND OLD.parent_project_id IS NOT NULL THEN
            UPDATE projects 
            SET subproject_count = GREATEST(0, subproject_count - 1)
            WHERE id = OLD.parent_project_id;
        END IF;
    END IF;
    
    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        IF OLD.parent_project_id IS NOT NULL THEN
            UPDATE projects 
            SET subproject_count = GREATEST(0, subproject_count - 1)
            WHERE id = OLD.parent_project_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining subproject counts
DROP TRIGGER IF EXISTS maintain_subproject_count ON public.projects;
CREATE TRIGGER maintain_subproject_count
    AFTER INSERT OR UPDATE OR DELETE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_subproject_count();

-- Function to get project hierarchy path (for breadcrumbs)
CREATE OR REPLACE FUNCTION get_project_hierarchy_path(project_uuid UUID)
RETURNS TABLE(id UUID, name TEXT, hierarchy_level INTEGER) AS $$
WITH RECURSIVE project_path AS (
    -- Base case: start with the given project
    SELECT p.id, p.name, p.hierarchy_level, p.parent_project_id
    FROM projects p
    WHERE p.id = project_uuid
    
    UNION ALL
    
    -- Recursive case: get parent projects
    SELECT p.id, p.name, p.hierarchy_level, p.parent_project_id
    FROM projects p
    INNER JOIN project_path pp ON p.id = pp.parent_project_id
)
SELECT pp.id, pp.name, pp.hierarchy_level
FROM project_path pp
ORDER BY pp.hierarchy_level ASC;
$$ LANGUAGE sql;

-- Grant permissions
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.projects TO anon;

-- Verification
SELECT 'Project hierarchy support added' as status;