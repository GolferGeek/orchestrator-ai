# Database Agents Implementation Guide

## Quick Reference

### Database Schema
```sql
-- Core agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    snake_case_name VARCHAR(255) NOT NULL UNIQUE,
    context TEXT NOT NULL, -- Markdown content
    yaml_config TEXT NOT NULL, -- YAML configuration
    agent_type VARCHAR(50) DEFAULT 'context_agent',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);
```

### Key Implementation Points

#### 1. Agent Discovery Enhancement
- Modify `AgentDiscoveryService` to query database agents
- Maintain dual compatibility with file-based agents
- Update agent registry to include both sources

#### 2. Base Class Updates
- Create `DatabaseContextAgent` base class
- Implement dual loading logic (file vs database)
- Maintain existing `A2AAgentBaseService` compatibility

#### 3. API Endpoints
```typescript
// Agent CRUD operations
GET    /api/agents              // List all agents
POST   /api/agents              // Create new agent
GET    /api/agents/:id          // Get agent details
PUT    /api/agents/:id          // Update agent
DELETE /api/agents/:id          // Delete agent
POST   /api/agents/:id/test     // Test agent
```

#### 4. UI Components
- Agent Creation Wizard (4-step process)
- Context Editor (Markdown with preview)
- YAML Configuration Form
- Agent Management Dashboard

### Migration Strategy
1. **Phase 1**: Add database support alongside existing file system
2. **Phase 2**: Create UI for database agents
3. **Phase 3**: Gradually migrate file-based agents to database
4. **Phase 4**: Deprecate file-based system (future)

### File Structure
```
apps/api/src/
├── agents/
│   ├── actual/                 # Existing file-based agents
│   └── database/               # New database agent classes
├── database-agents/            # New module
│   ├── controllers/
│   ├── services/
│   ├── entities/
│   └── dto/
└── ui/                         # Agent management UI
    ├── components/
    ├── views/
    └── stores/
```

### Next Steps
1. Create database migration
2. Implement base classes
3. Update agent discovery
4. Build UI components
5. Add API endpoints
6. Test integration

