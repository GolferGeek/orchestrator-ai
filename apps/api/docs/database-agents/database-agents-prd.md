# Database Agents System - Product Requirements Document

## Executive Summary

The Database Agents System introduces a new paradigm for agent creation and management within Orchestrator AI. This system allows agents to be defined, stored, and managed directly in the database while maintaining backward compatibility with the existing file-based agent system. The goal is to provide a more flexible, scalable, and user-friendly approach to agent creation through a guided UI interface.

## Problem Statement

### Current Limitations
- **File-based agents are static**: Agents are defined in files that require developer intervention to modify
- **No self-service agent creation**: Users cannot create or modify agents without technical knowledge
- **Limited scalability**: Adding new agents requires code changes and deployments
- **Complex agent management**: Agent configuration is spread across multiple files (agent.yaml, context.md)
- **No runtime agent modification**: Agents cannot be updated without system restart

### Business Impact
- Slower time-to-market for new agent capabilities
- High development overhead for simple agent modifications
- Limited user empowerment and self-service capabilities
- Difficulty in A/B testing different agent configurations

## Solution Overview

The Database Agents System will:
1. **Store agent definitions in the database** alongside existing file-based agents
2. **Provide a guided UI** for agent creation and management
3. **Maintain dual compatibility** with file-based and database-based agents
4. **Enable runtime agent updates** without system restarts
5. **Support future expansion** to TypeScript functions and external API agents

## Technical Architecture

### Database Schema

#### `agents` Table
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    snake_case_name VARCHAR(255) NOT NULL UNIQUE,
    context TEXT NOT NULL, -- Markdown content (replaces context.md)
    yaml_config TEXT NOT NULL, -- YAML configuration (replaces agent.yaml)
    agent_type VARCHAR(50) DEFAULT 'context_agent', -- context_agent, typescript_agent, api_agent
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, draft
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_agents_snake_case_name ON agents(snake_case_name);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_agent_type ON agents(agent_type);
```

### Agent Discovery System

#### Enhanced Agent Discovery Flow
1. **File-based Discovery** (existing): Scan `apps/api/src/agents/demo/` directory
2. **Database Discovery** (new): Query `agents` table for active agents
3. **Unified Agent Registry**: Combine both sources into a single registry
4. **Dynamic Loading**: Load agent configurations from appropriate source

#### Base Class Architecture
```typescript
abstract class BaseAgent {
  protected loadContext(): string {
    if (this.isDatabaseAgent()) {
      return this.loadContextFromDatabase();
    } else {
      return this.loadContextFromFile();
    }
  }
  
  protected loadYamlConfig(): AgentConfig {
    if (this.isDatabaseAgent()) {
      return this.loadYamlFromDatabase();
    } else {
      return this.loadYamlFromFile();
    }
  }
}
```

### Agent Types

#### Phase 1: Context Agents
- **Definition**: Agents that use markdown context and YAML configuration
- **Base Class**: `DatabaseContextAgent`
- **UI Support**: Full creation and editing capabilities

#### Phase 2: TypeScript Function Agents (Future)
- **Definition**: Agents with custom TypeScript function implementations
- **Base Class**: `DatabaseTypeScriptAgent`
- **UI Support**: Code editor integration

#### Phase 3: External API Agents (Future)
- **Definition**: Agents that proxy to external APIs
- **Base Class**: `DatabaseAPIAgent`
- **UI Support**: API endpoint configuration

## User Interface Design

### Agent Creation Wizard

#### Step 1: Basic Information
- **Agent Name**: Human-readable name (e.g., "Blog Post Writer")
- **Snake Case Name**: System identifier (e.g., "blog_post_writer")
- **Agent Type**: Dropdown selection (Context Agent, TypeScript Agent, API Agent)
- **Description**: Brief description of agent purpose

#### Step 2: Context Configuration
- **Context Editor**: Rich text editor with markdown support
- **Template Selection**: Pre-built templates for common agent types
- **Context Validation**: Real-time validation of markdown syntax
- **Preview Mode**: Live preview of formatted context

#### Step 3: YAML Configuration
- **Guided Form**: Step-by-step form for YAML configuration
- **YAML Editor**: Advanced users can edit raw YAML
- **Validation**: Real-time YAML syntax validation
- **Template Suggestions**: Auto-suggestions based on agent type

#### Step 4: Review & Deploy
- **Configuration Summary**: Review all settings
- **Test Mode**: Test agent with sample input
- **Deploy**: Activate agent in the system

### Agent Management Dashboard

#### Agent List View
- **Table Display**: All agents (file-based and database-based)
- **Filtering**: By type, status, creation date
- **Search**: By name, description, or content
- **Bulk Actions**: Activate, deactivate, delete

#### Agent Detail View
- **Configuration Display**: Read-only view of agent settings
- **Edit Mode**: In-place editing of context and YAML
- **Usage Analytics**: Performance metrics and usage statistics
- **Version History**: Track changes over time

## Implementation Phases

### Phase 1: Database Foundation (Weeks 1-2)
- [ ] Create `agents` table with proper indexes
- [ ] Implement database migration scripts
- [ ] Create base classes for database agents
- [ ] Update agent discovery service
- [ ] Add database agent loading logic

### Phase 2: Basic UI (Weeks 3-4)
- [ ] Create agent creation wizard
- [ ] Implement context editor with markdown support
- [ ] Build YAML configuration form
- [ ] Add agent management dashboard
- [ ] Implement CRUD operations

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Add agent testing capabilities
- [ ] Implement version history
- [ ] Add usage analytics
- [ ] Create agent templates
- [ ] Add bulk operations

### Phase 4: Integration & Testing (Weeks 7-8)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security review
- [ ] Documentation completion
- [ ] User acceptance testing

## Technical Requirements

### Backend Requirements
- **Database**: PostgreSQL with UUID support
- **API Endpoints**: RESTful API for agent CRUD operations
- **Authentication**: JWT-based authentication
- **Validation**: Input validation and sanitization
- **Caching**: Redis for agent configuration caching

### Frontend Requirements
- **Framework**: Vue.js 3 with TypeScript
- **UI Library**: Tailwind CSS with custom components
- **Editor**: Monaco Editor for YAML editing
- **Markdown**: Marked.js for markdown rendering
- **State Management**: Pinia for application state

### Security Requirements
- **Input Sanitization**: Prevent XSS and injection attacks
- **Access Control**: Role-based permissions for agent management
- **Audit Logging**: Track all agent modifications
- **Rate Limiting**: Prevent abuse of agent creation endpoints

## Success Metrics

### Technical Metrics
- **Agent Creation Time**: < 5 minutes for simple agents
- **System Performance**: < 100ms response time for agent loading
- **Uptime**: 99.9% availability for agent services
- **Error Rate**: < 0.1% for agent operations

### User Experience Metrics
- **User Adoption**: 80% of new agents created via UI within 3 months
- **User Satisfaction**: > 4.5/5 rating for agent creation experience
- **Time to Value**: < 10 minutes from idea to working agent
- **Support Tickets**: 50% reduction in agent-related support requests

## Risk Assessment

### Technical Risks
- **Database Performance**: Large context fields may impact query performance
- **Migration Complexity**: Ensuring smooth transition from file-based to database-based
- **Backward Compatibility**: Maintaining support for existing file-based agents

### Mitigation Strategies
- **Performance**: Implement proper indexing and caching strategies
- **Migration**: Gradual rollout with feature flags
- **Compatibility**: Comprehensive testing of dual-mode operation

## Future Enhancements

### Short-term (3-6 months)
- **Agent Templates**: Pre-built templates for common use cases
- **Agent Marketplace**: Share and discover community-created agents
- **A/B Testing**: Test different agent configurations
- **Analytics Dashboard**: Detailed usage and performance metrics

### Long-term (6-12 months)
- **TypeScript Function Support**: Custom function implementations
- **External API Integration**: Proxy agents for external services
- **AI-Powered Agent Generation**: Use AI to generate agent configurations
- **Multi-tenant Support**: Agent isolation and sharing across organizations

## Conclusion

The Database Agents System represents a significant evolution in how Orchestrator AI manages and deploys agents. By moving from a file-based to a database-driven approach, we enable self-service agent creation, improve scalability, and provide a foundation for future enhancements. The phased implementation approach ensures minimal disruption to existing systems while delivering immediate value to users.

The success of this system will be measured not just by technical metrics, but by the empowerment it provides to users to create and customize their own AI agents without requiring developer intervention.

