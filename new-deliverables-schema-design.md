# New Deliverables Versioning System Design

## Architecture Overview

**One-to-Many Relationship:**
- **1 Conversation** → **1 Deliverable** → **N Versions**

## Schema Design

### Deliverables Table (Simplified)
```sql
CREATE TABLE public.deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL UNIQUE REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional project linking
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL
);
```

### New Deliverable Versions Table
```sql
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
    
    -- Ensure only one current version per deliverable
    CONSTRAINT unique_current_version_per_deliverable 
        EXCLUDE (deliverable_id WITH =) WHERE (is_current_version = true)
);
```

## Key Benefits

1. **Clean Data Model**: One deliverable per conversation
2. **Version History**: Full tracking of all changes
3. **Creation Context**: Know how each version was created
4. **Current Version**: Always know which version is active
5. **Flexible Metadata**: Version-specific information storage

## Indexes for Performance

```sql
-- Deliverables indexes
CREATE INDEX idx_deliverables_conversation_id ON public.deliverables(conversation_id);
CREATE INDEX idx_deliverables_project_id ON public.deliverables(project_id);
CREATE INDEX idx_deliverables_type ON public.deliverables(type);

-- Versions indexes  
CREATE INDEX idx_deliverable_versions_deliverable_id ON public.deliverable_versions(deliverable_id);
CREATE INDEX idx_deliverable_versions_current ON public.deliverable_versions(deliverable_id, is_current_version);
CREATE INDEX idx_deliverable_versions_task_id ON public.deliverable_versions(task_id);
CREATE INDEX idx_deliverable_versions_created_by_type ON public.deliverable_versions(created_by_type);
```

## Workflow Examples

### 1. New Conversation with AI Response
```sql
-- Create deliverable when conversation starts
INSERT INTO deliverables (conversation_id, title, type) 
VALUES ('conv-123', 'AI Analysis Report', 'document');

-- Create first version when AI responds
INSERT INTO deliverable_versions (deliverable_id, version_number, content, created_by_type, is_current_version)
VALUES ('deliv-456', 1, 'AI generated content...', 'ai_response', true);
```

### 2. User Edits Content
```sql
-- Unset current version
UPDATE deliverable_versions SET is_current_version = false 
WHERE deliverable_id = 'deliv-456' AND is_current_version = true;

-- Create new version with edited content
INSERT INTO deliverable_versions (deliverable_id, version_number, content, created_by_type, is_current_version)
VALUES ('deliv-456', 2, 'User edited content...', 'manual_edit', true);
```

### 3. AI Enhancement Request
```sql
-- Create new version from AI enhancement
INSERT INTO deliverable_versions (deliverable_id, version_number, content, created_by_type, is_current_version, task_id)
VALUES ('deliv-456', 3, 'Enhanced content...', 'ai_enhancement', true, 'task-789');
```

## Migration Strategy

1. **Clean existing data** (already created)
2. **Modify deliverables table** (remove version-related columns)
3. **Create deliverable_versions table**
4. **Add indexes and constraints**
5. **Update API endpoints**
6. **Update frontend components**