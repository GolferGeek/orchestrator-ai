# Orchestrator AI - Core Platform Schema

## Database: Supabase PostgreSQL (Core Platform)
**Schema:** public  
**Domain:** Core Platform Operations  
**Purpose:** User management, task orchestration, agent coordination, conversations

---

## Core Tables

### public.users
**Purpose:** User profile and application data (distinct from auth.users)
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  phone VARCHAR(20),
  phone_verified BOOLEAN DEFAULT false,
  company VARCHAR(255),
  role VARCHAR(100),
  department VARCHAR(255),
  location VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'UTC',
  locale VARCHAR(10) DEFAULT 'en-US',
  status VARCHAR(50) DEFAULT 'active',
  roles JSONB DEFAULT '["user"]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.conversations
**Purpose:** Chat conversations between users and agents
```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  title VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.messages
**Purpose:** Individual messages within conversations
```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  message_type VARCHAR(100) DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.tasks
**Purpose:** Task management and orchestration
```sql
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(100) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'medium',
  agent_name VARCHAR(255),
  agent_type VARCHAR(100),
  assigned_to UUID REFERENCES public.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.agents
**Purpose:** Agent registry and configuration
```sql
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  config JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',
  version VARCHAR(50) DEFAULT '1.0.0',
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.projects
**Purpose:** Multi-step project coordination
```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(100) DEFAULT 'active',
  progress_percentage INTEGER DEFAULT 0,
  orchestrator_agent VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### public.deliverables
**Purpose:** Project deliverables and artifacts
```sql
CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id),
  name VARCHAR(255) NOT NULL,
  content TEXT,
  deliverable_type VARCHAR(100) NOT NULL,
  file_path TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  status VARCHAR(100) DEFAULT 'draft',
  version_number INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Indexes and Performance

### Primary Indexes
- All tables have UUID primary keys with btree indexes
- Foreign key columns automatically indexed

### Additional Indexes
```sql
-- Conversations by user and recent activity
CREATE INDEX idx_conversations_user_recent ON public.conversations(user_id, last_message_at DESC);

-- Messages by conversation chronological
CREATE INDEX idx_messages_conversation_time ON public.messages(conversation_id, created_at);

-- Tasks by user and status
CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status, created_at DESC);

-- Active agents lookup
CREATE INDEX idx_agents_active ON public.agents(status) WHERE status = 'active';
```

---

## Common Query Patterns

### User's Recent Conversations
```sql
SELECT c.*, COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.user_id = $1 AND c.status = 'active'
GROUP BY c.id
ORDER BY c.last_message_at DESC
LIMIT 10;
```

### Active Tasks for User
```sql
SELECT t.*, c.title as conversation_title
FROM tasks t
LEFT JOIN conversations c ON t.conversation_id = c.id
WHERE t.user_id = $1 AND t.status IN ('pending', 'in_progress')
ORDER BY t.priority, t.created_at;
```

### Agent Activity Summary
```sql
SELECT agent_name, COUNT(*) as task_count, 
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM tasks 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY task_count DESC;
```

### Project Progress
```sql
SELECT p.*, 
       COUNT(t.id) as total_tasks,
       COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
       COUNT(d.id) as deliverable_count
FROM projects p
LEFT JOIN tasks t ON p.id = t.metadata->>'project_id'::UUID
LEFT JOIN deliverables d ON p.id = d.project_id
WHERE p.user_id = $1
GROUP BY p.id
ORDER BY p.created_at DESC;
```

---

## Data Relationships

### Core Relationships
- `users` → `conversations` (1:many)
- `conversations` → `messages` (1:many)
- `users` → `tasks` (1:many)
- `conversations` → `tasks` (1:many)
- `users` → `projects` (1:many)
- `projects` → `deliverables` (1:many)
- `tasks` → `deliverables` (1:many)

### Agent Coordination
- Tasks can be assigned to agents (via `agent_name`)
- Conversations track which agent is active
- Projects can specify orchestrator agents

---

## SQL Generation Guidelines

### Table Aliases
- `u` = users
- `c` = conversations  
- `m` = messages
- `t` = tasks
- `a` = agents
- `p` = projects
- `d` = deliverables

### Performance Notes
- Always use LIMIT clauses for large result sets
- Use appropriate indexes for WHERE clauses
- JOIN conversations and messages carefully (can be large tables)
- Filter by user_id early in queries for multi-tenant security

### Common WHERE Patterns
- User isolation: `WHERE user_id = $1`
- Active records: `WHERE status = 'active'`
- Recent activity: `WHERE created_at >= NOW() - INTERVAL '7 days'`
- Agent filtering: `WHERE agent_name = $1` or `WHERE agent_type = $1`