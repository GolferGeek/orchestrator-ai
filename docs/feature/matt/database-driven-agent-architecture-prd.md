# Database-Driven Agent Architecture PRD

## Project Overview

**Project Name:** Database-Driven Agent Architecture with Orchestrator Enhancement  
**Version:** 1.0  
**Date:** January 2025  
**Author:** Matt Weber  

## Executive Summary

Transform the existing file-based agent system into a database-driven architecture that enables dynamic agent creation, management, and orchestration. This enhancement will simplify the current implementation while adding powerful orchestrator capabilities and human-in-the-loop workflows. The system will maintain backward compatibility during the transition while providing a foundation for sophisticated project planning and execution.

## Problem Statement

The current file-based agent system has several limitations:

### **Current System Issues**
- **Static Configuration**: Agents are hardcoded in files, requiring code changes for modifications
- **Limited Scalability**: Adding new agents requires file system changes and deployments
- **No Dynamic Management**: Cannot create, modify, or manage agents at runtime
- **Orchestrator Limitations**: Current orchestrator lacks sophisticated project planning capabilities
- **Human Integration Gaps**: Limited human-in-the-loop workflows and approval processes
- **Code Complexity**: A2A base services need stabilization and simplification
- **Agent Discovery**: No centralized agent registry or capability discovery

### **Business Impact**
- **Slow Agent Development**: Creating new agents requires development cycles
- **Limited User Empowerment**: Users cannot create or modify agents independently
- **Orchestrator Constraints**: Cannot handle complex project planning and execution
- **Human Workflow Friction**: Limited human approval and intervention capabilities

## Goals & Objectives

### **Primary Goals**
1. **Database-Driven Agents**: Move from file-based to database-driven agent management
2. **Orchestrator Enhancement**: Enable sophisticated project planning and execution
3. **Human-in-the-Loop**: Integrate seamless human approval and intervention workflows
4. **System Simplification**: Clean up and stabilize the A2A base services
5. **Dynamic Agent Management**: Enable runtime agent creation, modification, and management

### **Secondary Goals**
1. **Agent Builder Interface**: Provide form-based agent creation and management
2. **Agent Marketplace**: Enable agent sharing across different contexts (demo, my-org, saas)
3. **Performance Optimization**: Improve agent loading and execution performance
4. **Backward Compatibility**: Maintain existing functionality during transition
5. **Enhanced Monitoring**: Better agent performance and usage tracking

## Target Users

### **Primary Users**
- **System Administrators**: Need to manage and configure agents
- **Business Users**: Want to create custom agents for their workflows
- **Developers**: Need simplified agent development and deployment
- **Project Managers**: Require sophisticated project planning and execution

### **Secondary Users**
- **End Users**: Benefit from more powerful and flexible agent capabilities
- **IT Operations**: Need better monitoring and management of agent systems

## Core Features

### **1. Database-Driven Agent Architecture**

#### **Agent Database Schema**
```sql
-- Core agents table
CREATE TABLE database_agents (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  snake_case_name VARCHAR UNIQUE NOT NULL,
  description TEXT,
  agent_type VARCHAR NOT NULL, -- context, tool, api, external, orchestrator
  location VARCHAR NOT NULL, -- demo, my-org, saas
  
  -- Agent configuration
  config JSONB NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Agent capabilities
CREATE TABLE database_agent_capabilities (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES database_agents(id),
  capability_type VARCHAR NOT NULL,
  config JSONB,
  is_enabled BOOLEAN DEFAULT TRUE
);
```

#### **Agent Loading System**
- **Pre-Loaded Agents**: Load all agents at API startup (same pattern as file-based)
- **Agent Registry**: Centralized registry of all available agents
- **A2A Endpoints**: Automatic endpoint registration for each agent
- **Backward Compatibility**: Support both file-based and database-based agents

### **2. Enhanced Orchestrator Capabilities**

#### **Project Planning Engine**
- **Natural Language Processing**: Convert requirements into structured projects
- **Project Hierarchy**: Create projects with sub-projects, steps, and conversations
- **Agent Assignment**: Automatically assign appropriate agents to project steps
- **Dependency Management**: Handle complex project dependencies and sequencing

#### **Workflow Orchestration**
- **Step Sequencing**: Manage sequential and parallel step execution
- **Agent Coordination**: Coordinate between different agent types
- **Data Flow Management**: Ensure proper data passing between steps
- **Error Handling**: Robust error handling and retry logic

### **3. Human-in-the-Loop Integration**

#### **Approval Workflows**
- **Human Checkpoints**: Define where human approval is needed
- **Bidirectional Navigation**: Allow humans to move between project steps
- **Deliverable Review**: Present project outputs for human evaluation
- **Decision Points**: Enable human decision-making at critical junctures

#### **Human Dashboard**
- **Project Status**: Visual project status and progress tracking
- **Pending Approvals**: List of items requiring human attention
- **Step Management**: View and modify individual project steps
- **History Tracking**: Complete audit trail of human interactions

### **4. Agent Builder Interface**

#### **Form-Based Agent Creation**
- **Agent Type Selection**: Choose from context, tool, api, external, orchestrator
- **Configuration Forms**: Type-specific configuration interfaces
- **Validation**: Real-time validation of agent configurations
- **Preview**: Test agents before deployment

#### **Agent Management**
- **Agent Library**: Browse and manage all available agents
- **Version Control**: Track agent changes and rollbacks
- **Sharing**: Share agents across different contexts
- **Performance Monitoring**: Track agent usage and performance

### **5. Universal Orchestrator Capability (LangGraph-like)**

#### **All Agents as Orchestrators**
Every agent must have orchestrator capabilities, requiring:
- **Memory Management**: Persistent state storage and retrieval
- **Database Storage**: Structured data persistence across conversations
- **State Management**: Complex state graphs and transitions
- **Message Passing**: Real-time communication between agents
- **WebSocket Support**: Real-time and polling communication modes

#### **Enhanced A2A Protocol**
```typescript
abstract class DatabaseAgent2AgentBaseService {
  // Core A2A protocol methods
  abstract converse(input: ConverseInput): Promise<ConverseOutput>;
  abstract plan(input: PlanInput): Promise<PlanOutput>;
  abstract createDeliverable(input: DeliverableInput): Promise<DeliverableOutput>;
  abstract humanInteraction(input: HumanInteractionInput): Promise<HumanInteractionOutput>;
  
  // Universal orchestrator capabilities
  abstract executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResult>;
  abstract manageState(state: AgentState): Promise<AgentState>;
  abstract coordinateAgents(agents: AgentReference[]): Promise<CoordinationResult>;
  
  // Memory and storage
  protected async saveMemory(key: string, data: any): Promise<void>;
  protected async getMemory(key: string): Promise<any>;
  protected async saveToDatabase(table: string, data: any): Promise<void>;
  protected async queryDatabase(query: string, params: any[]): Promise<any[]>;
  
  // Real-time communication
  protected async sendWebSocketMessage(agentId: string, message: any): Promise<void>;
  protected async pollForMessages(): Promise<Message[]>;
  protected async subscribeToEvents(eventTypes: string[]): Promise<void>;
}
```

#### **LangGraph-like State Management**
```typescript
interface AgentState {
  // Core state
  currentStep: string;
  completedSteps: string[];
  pendingSteps: string[];
  
  // Memory and context
  conversationHistory: ConversationEntry[];
  workingMemory: Map<string, any>;
  persistentMemory: Map<string, any>;
  
  // Database storage
  structuredData: Map<string, any>;
  relationships: Map<string, string[]>;
  
  // Workflow state
  activeWorkflows: WorkflowInstance[];
  workflowHistory: WorkflowExecution[];
  
  // Real-time communication
  activeConnections: WebSocketConnection[];
  messageQueue: Message[];
  eventSubscriptions: EventSubscription[];
}
```

#### **Agent Type Implementations (All Orchestrator-Capable)**
- **Context Agents**: Markdown-based knowledge + orchestrator capabilities
- **Tool Agents**: MCP tool wrapping + orchestrator capabilities  
- **API Agents**: External API integration + orchestrator capabilities
- **External Agents**: External A2A agent proxying + orchestrator capabilities
- **Pure Orchestrator Agents**: Project planning and execution specialists

## LangGraph-like Capabilities Analysis

### **Core LangGraph Features to Implement**

#### **1. State Management**
- **State Graphs**: Complex state transitions and dependencies
- **State Persistence**: Persistent state across agent restarts
- **State Validation**: Ensure state consistency and integrity
- **State Branching**: Handle conditional state transitions

#### **2. Memory Management**
- **Working Memory**: Short-term memory for current conversation
- **Persistent Memory**: Long-term memory across conversations
- **Memory Retrieval**: Efficient memory search and retrieval
- **Memory Compression**: Optimize memory usage and performance

#### **3. Workflow Execution**
- **Workflow Definition**: Define complex multi-step workflows
- **Workflow Execution**: Execute workflows with error handling
- **Workflow Monitoring**: Track workflow progress and status
- **Workflow Recovery**: Handle failures and resume workflows

#### **4. Agent Coordination**
- **Agent Discovery**: Find and connect to other agents
- **Agent Communication**: Send messages and data between agents
- **Agent Synchronization**: Coordinate agent execution timing
- **Agent Failure Handling**: Handle agent failures gracefully

#### **5. Real-time Communication**
- **WebSocket Support**: Real-time bidirectional communication
- **Message Queuing**: Reliable message delivery and ordering
- **Event Broadcasting**: Broadcast events to multiple agents
- **Connection Management**: Manage WebSocket connections

### **Database Schema for LangGraph-like Features**

```sql
-- Agent state management
CREATE TABLE agent_states (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES database_agents(id),
  state_key VARCHAR NOT NULL,
  state_data JSONB NOT NULL,
  state_type VARCHAR NOT NULL, -- working, persistent, structured
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent memory
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES database_agents(id),
  memory_key VARCHAR NOT NULL,
  memory_data JSONB NOT NULL,
  memory_type VARCHAR NOT NULL, -- conversation, working, persistent
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow definitions
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workflow executions
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflow_definitions(id),
  agent_id UUID REFERENCES database_agents(id),
  status VARCHAR NOT NULL, -- running, completed, failed, paused
  current_step VARCHAR,
  execution_data JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Agent communications
CREATE TABLE agent_communications (
  id UUID PRIMARY KEY,
  from_agent_id UUID REFERENCES database_agents(id),
  to_agent_id UUID REFERENCES database_agents(id),
  message_type VARCHAR NOT NULL,
  message_data JSONB NOT NULL,
  status VARCHAR DEFAULT 'pending', -- pending, delivered, failed
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP
);

-- WebSocket connections
CREATE TABLE websocket_connections (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES database_agents(id),
  connection_id VARCHAR UNIQUE NOT NULL,
  connection_type VARCHAR NOT NULL, -- real-time, polling
  status VARCHAR DEFAULT 'active', -- active, inactive, closed
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);
```

## Technical Architecture

### **1. Database Agent Loading System**

```typescript
class DatabaseAgentLoader {
  async loadAgents(): Promise<DatabaseAgent[]> {
    const agentRows = await this.getAgentRows();
    
    const agents = await Promise.all(
      agentRows.map(async (row) => {
        const config = this.loadAgentConfigFromRow(row);
        return this.createAgentByType(row.agent_type, config);
      })
    );
    
    return agents;
  }
  
  private createAgentByType(type: string, config: DatabaseAgentConfig): DatabaseAgent {
    switch (type) {
      case 'context':
        return new DatabaseContextAgent(config);
      case 'tool':
        return new DatabaseToolAgent(config);
      case 'api':
        return new DatabaseApiAgent(config);
      case 'external':
        return new DatabaseExternalAgent(config);
      case 'orchestrator':
        return new DatabaseOrchestratorAgent(config);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }
}
```

### **2. Enhanced Orchestrator Agent**

```typescript
class DatabaseOrchestratorAgent extends DatabaseAgent2AgentBaseService {
  async plan(input: PlanInput): Promise<PlanOutput> {
    // Create project from requirements
    const project = await this.createProject(input.requirements);
    
    // Plan project steps with agent assignments
    const plan = await this.planProject(project);
    
    // Define human checkpoints
    const humanCheckpoints = await this.identifyHumanCheckpoints(plan);
    
    return {
      project,
      plan,
      humanCheckpoints
    };
  }
  
  async executeProject(projectId: string): Promise<ProjectExecution> {
    // Execute project steps
    // Handle human interactions
    // Manage data flow between agents
    // Handle errors and retries
  }
}
```

### **3. Real-time Communication System**

```typescript
class RealTimeCommunicationService {
  // WebSocket management
  async establishConnection(agentId: string, connectionType: 'real-time' | 'polling'): Promise<WebSocketConnection> {
    // Create WebSocket connection
    // Register connection in database
    // Set up message routing
  }
  
  async sendMessage(fromAgentId: string, toAgentId: string, message: any): Promise<void> {
    // Send real-time message via WebSocket
    // Fallback to polling if WebSocket unavailable
    // Store message in database for reliability
  }
  
  async broadcastMessage(fromAgentId: string, message: any, targetAgents?: string[]): Promise<void> {
    // Broadcast message to multiple agents
    // Use WebSocket for real-time delivery
    // Store in database for offline agents
  }
  
  async pollForMessages(agentId: string): Promise<Message[]> {
    // Poll for messages (fallback mode)
    // Return undelivered messages
    // Mark messages as delivered
  }
}

class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  
  async connect(agentId: string): Promise<WebSocket> {
    // Establish WebSocket connection
    // Handle connection events
    // Manage connection lifecycle
  }
  
  async disconnect(agentId: string): Promise<void> {
    // Close WebSocket connection
    // Clean up resources
    // Update connection status
  }
  
  async send(agentId: string, message: any): Promise<void> {
    // Send message via WebSocket
    // Handle connection errors
    // Fallback to polling if needed
  }
}
```

### **4. Human-in-the-Loop System**

```typescript
class HumanInteractionService {
  async pauseForHuman(stepId: string, reason: string): Promise<void> {
    // Pause project execution
    // Notify human dashboard via WebSocket
    // Store pending approval
  }
  
  async handleHumanApproval(approvalId: string, decision: HumanDecision): Promise<void> {
    // Process human decision
    // Resume or modify project execution
    // Update project state
    // Notify agents via WebSocket
  }
  
  async getPendingApprovals(userId: string): Promise<PendingApproval[]> {
    // Get all pending approvals for user
    // Include project context and deliverables
  }
}
```

### **4. Agent Builder Service**

```typescript
class AgentBuilderService {
  async createContextAgent(config: ContextAgentConfig): Promise<DatabaseAgent> {
    // Validate context configuration
    // Create agent in database
    // Register A2A endpoints
    // Return agent instance
  }
  
  async createToolAgent(config: ToolAgentConfig): Promise<DatabaseAgent> {
    // Validate MCP tool configuration
    // Create agent in database
    // Register A2A endpoints
    // Return agent instance
  }
  
  async validateAgent(agent: DatabaseAgent): Promise<ValidationResult> {
    // Validate agent configuration
    // Test agent functionality
    // Return validation results
  }
}
```

## Success Metrics

### **Primary Metrics**
- **Agent Creation Success Rate**: % of successfully created agents
- **Orchestrator Planning Accuracy**: % of successfully planned projects
- **Human Approval Efficiency**: Time from checkpoint to approval
- **System Performance**: Agent loading and execution times
- **User Adoption**: Number of users creating and managing agents

### **Secondary Metrics**
- **Agent Reuse Rate**: Frequency of agent sharing and reuse
- **Project Completion Rate**: % of projects completed successfully
- **Human Intervention Frequency**: Number of human checkpoints per project
- **System Stability**: Error rates and system uptime
- **Developer Productivity**: Time to create and deploy new agents

## Implementation Phases

### **Phase 1: Database Infrastructure (6-8 weeks)**
- Create database schema for agents and LangGraph-like features
- Implement DatabaseAgentService
- Create DatabaseAgentLoader (same pattern as file-based)
- Implement basic agent factory
- **Deliverable**: Database-driven agent loading system

### **Phase 2: A2A Base Stabilization (4-6 weeks)**
- Clean up and stabilize A2A base services
- Implement core A2A protocol methods
- Create agent type implementations
- Add comprehensive error handling
- **Deliverable**: Stable, simplified A2A base services

### **Phase 3: LangGraph-like Capabilities (8-10 weeks)**
- Implement state management system
- Add memory management (working, persistent, structured)
- Create workflow execution engine
- Implement agent coordination protocols
- **Deliverable**: Full LangGraph-like capabilities

### **Phase 4: Real-time Communication (6-8 weeks)**
- Implement WebSocket management
- Add real-time message passing
- Create polling fallback system
- Implement connection management
- **Deliverable**: Complete real-time communication system

### **Phase 5: Universal Orchestrator Capability (6-8 weeks)**
- Add orchestrator capabilities to all agent types
- Implement project creation engine
- Add intelligent planning system
- Create workflow orchestration
- **Deliverable**: All agents as orchestrators

### **Phase 6: Human-in-the-Loop (4-6 weeks)**
- Implement approval workflows
- Create human dashboard integration
- Add bidirectional step navigation
- Implement deliverable review system
- **Deliverable**: Complete human-in-the-loop system

### **Phase 7: Agent Builder (6-8 weeks)**
- Build form-based agent creation interface
- Implement agent validation and testing
- Create agent management interface
- Add agent sharing and marketplace features
- **Deliverable**: Complete agent builder and management system

### **Phase 8: Migration & Optimization (4-6 weeks)**
- Migrate existing file-based agents to database
- Implement performance optimizations
- Add monitoring and analytics
- Clean up legacy code
- **Deliverable**: Fully migrated, optimized system

## Risks & Mitigation

### **Technical Risks**
- **Database Performance**: Risk of slow agent loading and execution
  - *Mitigation*: Implement caching, indexing, and performance monitoring
- **Migration Complexity**: Risk of breaking existing functionality
  - *Mitigation*: Maintain backward compatibility, gradual migration
- **A2A Protocol Changes**: Risk of breaking existing agent integrations
  - *Mitigation*: Maintain protocol compatibility, comprehensive testing

### **Business Risks**
- **User Adoption**: Risk of low adoption due to complexity
  - *Mitigation*: Focus on user experience, gradual feature introduction
- **Performance Impact**: Risk of system slowdown
  - *Mitigation*: Performance testing throughout development
- **Data Migration**: Risk of data loss during migration
  - *Mitigation*: Comprehensive backup and rollback procedures

## Dependencies

### **Internal Dependencies**
- Existing A2A base services and protocols
- Current agent loading and registration system
- Database infrastructure and schema
- Human dashboard interface
- MCP tool ecosystem

### **External Dependencies**
- Database performance and scalability
- LLM capabilities for natural language processing
- User interface framework for agent builder
- Monitoring and analytics infrastructure

## User-Directed Scenarios & Use Cases

### **Simple Multi-Agent Runs**

#### **1. Data Analysis Pipeline**
```
User Input: "Analyze our Q4 sales data and create a summary report"
Orchestrator Plan:
1. sales-data-analyst → Analyze Q4 sales data
2. supabase-db → Fetch customer records (action=query)
3. marketing-data-analyst → Segment customers by behavior
4. report-generator → Create executive summary
5. slack-notification-agent → Send report to leadership
```

#### **2. Content Creation Workflow**
```
User Input: "Create a blog post about our new product launch"
Orchestrator Plan:
1. product-researcher → Gather product information
2. competitor-analyst → Research competitive landscape
3. content-writer → Draft blog post
4. seo-optimizer → Optimize for search engines
5. social-media-agent → Create social media posts
```

#### **3. Customer Support Automation**
```
User Input: "Handle customer complaint about billing issue"
Orchestrator Plan:
1. customer-data-agent → Fetch customer information
2. billing-analyst → Analyze billing history
3. issue-resolver → Determine resolution steps
4. email-composer → Draft response email
5. follow-up-scheduler → Schedule follow-up
```

### **User-Directed Project Scenarios**

#### **4. Marketing Campaign Planning**
```
User Input: "Plan a comprehensive marketing campaign for our new SaaS product"
User Direction: "Focus on B2B leads, use LinkedIn and email, budget $50k"
Orchestrator Plan:
1. market-researcher → Analyze target market
2. competitor-analyst → Research competitors
3. budget-planner → Allocate budget across channels
4. content-strategist → Plan content calendar
5. campaign-designer → Design campaign assets
6. performance-tracker → Set up analytics
7. human-checkpoint → Review campaign strategy
8. execution-coordinator → Launch campaign
```

#### **5. Product Development Planning**
```
User Input: "Plan the development of a new mobile app feature"
User Direction: "Focus on user experience, integrate with existing API, 3-month timeline"
Orchestrator Plan:
1. user-researcher → Analyze user needs
2. api-integration-specialist → Plan API integration
3. ux-designer → Design user interface
4. technical-architect → Plan technical implementation
5. project-manager → Create development timeline
6. human-checkpoint → Review technical approach
7. development-coordinator → Coordinate development
8. testing-coordinator → Plan testing strategy
```

#### **6. Business Process Automation**
```
User Input: "Automate our employee onboarding process"
User Direction: "Include HR, IT, and manager notifications, track completion"
Orchestrator Plan:
1. process-analyzer → Map current onboarding process
2. automation-designer → Design automated workflow
3. notification-coordinator → Set up notification system
4. tracking-system → Implement completion tracking
5. human-checkpoint → Review automation design
6. implementation-coordinator → Deploy automation
7. monitoring-setup → Set up monitoring and alerts
```

### **Complex User-Directed Scenarios**

#### **7. Multi-Department Coordination**
```
User Input: "Coordinate a company-wide rebranding initiative"
User Direction: "Involve marketing, legal, IT, and operations, 6-month timeline"
Orchestrator Plan:
1. brand-strategist → Develop new brand strategy
2. legal-reviewer → Review trademark and legal requirements
3. marketing-coordinator → Plan marketing rollout
4. it-systems-updater → Update all IT systems
5. operations-coordinator → Update operational materials
6. human-checkpoint → Review brand strategy
7. implementation-phases → Execute in phases
8. quality-assurance → Ensure consistency across departments
```

#### **8. Crisis Management Response**
```
User Input: "Handle a data breach incident"
User Direction: "Follow compliance requirements, notify stakeholders, minimize damage"
Orchestrator Plan:
1. incident-analyzer → Assess breach scope and impact
2. compliance-coordinator → Ensure regulatory compliance
3. stakeholder-notifier → Notify affected parties
4. security-enhancer → Implement additional security measures
5. communication-manager → Manage public relations
6. human-checkpoint → Review response strategy
7. recovery-coordinator → Execute recovery plan
8. monitoring-enhancer → Enhance monitoring systems
```

#### **9. Strategic Planning Initiative**
```
User Input: "Develop a 3-year strategic plan for the company"
User Direction: "Include market analysis, competitive positioning, and growth strategies"
Orchestrator Plan:
1. market-analyst → Analyze market trends and opportunities
2. competitive-intelligence → Research competitive landscape
3. financial-planner → Develop financial projections
4. growth-strategist → Identify growth opportunities
5. risk-assessor → Assess potential risks
6. human-checkpoint → Review strategic direction
7. implementation-planner → Create implementation roadmap
8. performance-tracker → Set up KPI tracking
```

### **Interactive User-Directed Scenarios**

#### **10. Real-Time Decision Making**
```
User Input: "Help me decide on our next product feature"
User Direction: "Consider user feedback, development cost, and market demand"
Orchestrator Plan:
1. user-feedback-analyzer → Analyze user feedback data
2. cost-estimator → Estimate development costs
3. market-demand-analyzer → Assess market demand
4. decision-framework → Create decision matrix
5. human-checkpoint → Present options to user
6. user-decision → User makes final decision
7. implementation-planner → Plan feature development
```

#### **11. Iterative Project Refinement**
```
User Input: "Improve our customer onboarding process"
User Direction: "Start with current process analysis, then iterate based on findings"
Orchestrator Plan:
1. current-process-analyzer → Analyze existing process
2. bottleneck-identifier → Identify pain points
3. improvement-suggester → Suggest improvements
4. human-checkpoint → Review analysis and suggestions
5. user-feedback → User provides direction
6. refined-planner → Create refined improvement plan
7. implementation-coordinator → Implement improvements
8. success-measurer → Measure improvement success
```

### **Scenario Categories**

#### **Business Operations**
- **HR Processes**: Onboarding, performance reviews, training programs
- **Finance Operations**: Budget planning, expense analysis, financial reporting
- **Sales Operations**: Lead generation, pipeline management, customer acquisition
- **Marketing Operations**: Campaign planning, content creation, brand management

#### **Technical Operations**
- **Development Workflows**: Feature development, testing, deployment
- **Infrastructure Management**: System monitoring, capacity planning, security
- **Data Operations**: Data analysis, reporting, business intelligence
- **Integration Projects**: API integrations, system migrations, automation

#### **Strategic Initiatives**
- **Market Expansion**: New market entry, competitive analysis, growth strategies
- **Product Development**: New product planning, feature prioritization, roadmap creation
- **Organizational Change**: Process improvements, team restructuring, culture initiatives
- **Crisis Management**: Incident response, risk mitigation, recovery planning

#### **User Interaction Patterns**
- **Guided Workflows**: Step-by-step user guidance through complex processes
- **Decision Support**: Data-driven decision making with user input
- **Iterative Refinement**: Continuous improvement based on user feedback
- **Collaborative Planning**: Multi-stakeholder coordination and approval

### **Test Agent Development Strategy**

#### **Phase 1: Core Test Agents (my-org location)**
Start with a minimal set of agents to test scenarios:

```typescript
// Initial test agent set
const testAgents = [
  // Data & Analysis
  { name: "data-analyzer", type: "context", purpose: "Analyze data and generate insights" },
  { name: "report-generator", type: "context", purpose: "Create formatted reports" },
  
  // Database Operations (single multi-action tool agent)
  { name: "supabase-db", type: "tool", purpose: "Perform Supabase actions (query, insert, update, delete)" },
  
  // Communication
  { name: "email-sender", type: "api", purpose: "Send email notifications" },
  { name: "slack-notifier", type: "api", purpose: "Send Slack messages" },
  
  // Orchestration
  { name: "project-orchestrator", type: "orchestrator", purpose: "Plan and execute projects" }
];
```

#### **Phase 2: Scenario Growth with Limited Agents**
Build scenarios that reuse the same agents in different ways:

```typescript
// Simple scenarios with 2-3 agents
const simpleScenarios = [
  {
    name: "Data Analysis Report",
    agents: ["data-analyzer", "report-generator", "email-sender"],
    steps: 3
  },
  {
    name: "Customer Data Update",
    agents: ["supabase-db", "data-analyzer", "supabase-db"],
    steps: 3
  },
  {
    name: "Daily Report Automation",
    agents: ["supabase-db", "data-analyzer", "report-generator", "slack-notifier"],
    steps: 4
  }
];

// Moderate scenarios with 4-5 agents
const moderateScenarios = [
  {
    name: "Customer Onboarding Workflow",
    agents: ["supabase-db", "email-sender", "data-analyzer", "report-generator", "slack-notifier"],
    steps: 5
  },
  {
    name: "Sales Pipeline Update",
    agents: ["supabase-db", "data-analyzer", "supabase-db", "report-generator", "email-sender"],
    steps: 5
  }
];
```

#### **Phase 3: Agent Specialization**
As scenarios grow, specialize agents for specific purposes:

```typescript
// Specialized agents (still my-org)
const specializedAgents = [
  // Data specialists
  { name: "sales-data-analyzer", type: "context", purpose: "Analyze sales data specifically" },
  { name: "customer-data-analyzer", type: "context", purpose: "Analyze customer data specifically" },
  
  // Communication specialists
  { name: "executive-email-sender", type: "api", purpose: "Send executive-level emails" },
  { name: "team-slack-notifier", type: "api", purpose: "Send team notifications" },
  
  // Database specialists
  { name: "customer-db-manager", type: "tool", purpose: "Manage customer database operations" },
  { name: "sales-db-manager", type: "tool", purpose: "Manage sales database operations" }
];
```

### **Incremental Scenario Development**

#### **Start Simple, Grow Complex**
```typescript
// Week 1-2: Basic scenarios
const week1Scenarios = [
  "Simple data analysis",
  "Basic report generation", 
  "Email notification"
];

// Week 3-4: Multi-agent scenarios
const week3Scenarios = [
  "Data analysis + report + email",
  "Database query + analysis + update",
  "Customer data workflow"
];

// Week 5-6: Complex scenarios
const week5Scenarios = [
  "Multi-step customer onboarding",
  "Sales pipeline automation",
  "Cross-department coordination"
];
```

#### **Agent Reuse Patterns**
```typescript
// Same agents, different combinations
const agentCombinations = {
  "data-workflow": ["data-analyzer", "report-generator", "email-sender"],
  "database-workflow": ["supabase-db", "data-analyzer", "supabase-db"],
  "notification-workflow": ["data-analyzer", "slack-notifier", "email-sender"],
  "full-workflow": ["supabase-db", "data-analyzer", "report-generator", "email-sender", "slack-notifier"]
};
```

### **Test Scenario Examples (Limited Agents)**

#### **1. Simple Data Analysis (3 agents)**
```
User Input: "Analyze our sales data and send a summary"
Agents: data-analyzer → report-generator → email-sender
Steps: 3
Human Checkpoints: None (fully automated)
```

#### **2. Customer Data Update (3 agents)**
```
User Input: "Update customer records and notify the team"
Agents: supabase-db → data-analyzer → supabase-db → slack-notifier
Steps: 4
Human Checkpoints: Review data changes before update
```

#### **3. Daily Report Automation (4 agents)**
```
User Input: "Generate daily sales report and distribute"
Agents: supabase-db → data-analyzer → report-generator → email-sender
Steps: 4
Human Checkpoints: Review report before sending
```

#### **4. Customer Onboarding (5 agents)**
```
User Input: "Process new customer onboarding"
Agents: supabase-db → email-sender → data-analyzer → report-generator → slack-notifier
Steps: 5
Human Checkpoints: Review customer data, approve welcome email
```

### **Agent Builder for Test Agents**

```typescript
class TestAgentBuilder {
  async createTestAgent(config: {
    name: string;
    type: 'context' | 'tool' | 'api' | 'orchestrator';
    purpose: string;
    location: 'my-org'; // Always my-org for testing
  }): Promise<DatabaseAgent> {
    
    // Create agent with my-org location
    const agent = await this.databaseAgentService.createAgent({
      ...config,
      location: 'my-org',
      isActive: true
    });
    
    // Register A2A endpoints
    this.registerAgentEndpoints(agent);
    
    return agent;
  }
  
  async createTestScenario(scenario: {
    name: string;
    description: string;
    agents: string[];
    steps: ScenarioStep[];
  }): Promise<ScenarioDefinition> {
    
    // Validate all agents exist in my-org
    const agents = await this.validateMyOrgAgents(scenario.agents);
    
    // Create scenario definition
    return {
      ...scenario,
      location: 'my-org',
      agents,
      status: 'draft'
    };
  }
}
```

### **Scenario Implementation Framework**

```typescript
interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  complexity: 'simple' | 'moderate' | 'complex';
  location: 'my-org'; // Test scenarios in my-org
  
  // User interaction
  userInputs: UserInputDefinition[];
  userDirections: UserDirectionDefinition[];
  humanCheckpoints: HumanCheckpointDefinition[];
  
  // Agent coordination (limited set)
  requiredAgents: string[]; // Only my-org agents
  agentSequence: AgentStepDefinition[];
  dataFlow: DataFlowDefinition[];
  
  // Execution
  executionMode: 'sequential' | 'parallel' | 'conditional';
  errorHandling: ErrorHandlingDefinition;
  successCriteria: SuccessCriteriaDefinition;
}

interface UserInputDefinition {
  type: 'text' | 'file' | 'data' | 'selection';
  prompt: string;
  validation: ValidationRule[];
  required: boolean;
}

interface UserDirectionDefinition {
  context: string;
  options: string[];
  defaultSelection?: string;
  allowCustom: boolean;
}
```

## Future Considerations

### **Potential Enhancements**
- **Multi-Project Coordination**: Coordinate across multiple simultaneous projects
- **Advanced Analytics**: Deep insights into agent performance and usage
- **AI-Powered Agent Creation**: Use AI to help create and optimize agents
- **Integration APIs**: Allow external systems to create and manage agents
- **Scenario Marketplace**: Share and discover user-created scenarios
- **Scenario Templates**: Pre-built scenarios for common business processes

### **Scalability Considerations**
- **Agent Volume**: Handle thousands of agents efficiently
- **Project Complexity**: Support very large and complex projects
- **User Concurrency**: Support multiple users managing agents simultaneously
- **Performance**: Maintain fast response times with large agent counts
- **Scenario Complexity**: Support scenarios with hundreds of steps and agents

## Conclusion

This database-driven agent architecture will transform the system from a static, file-based approach to a dynamic, database-driven platform that enables sophisticated project planning, human-in-the-loop workflows, and user-empowered agent creation. The phased approach ensures manageable development while delivering value incrementally.

The integration with existing systems and the focus on simplification and stabilization will provide a solid foundation for future enhancements while maintaining the flexibility and power of the current agent ecosystem.

## Appendix

### **Agent Type Specifications**

#### **Context Agents**
- **Purpose**: Process information using markdown context
- **Configuration**: Context markdown, YAML agent card
- **Capabilities**: Knowledge processing, content generation

#### **Tool Agents**
- **Purpose**: Wrap MCP tool calls
- **Configuration**: MCP tool configuration, parameter validation
- **Capabilities**: Tool execution, parameter validation

#### **API Agents**
- **Purpose**: Integrate with external APIs
- **Configuration**: API endpoints, authentication, headers
- **Capabilities**: API calls, data transformation

#### **External Agents**
- **Purpose**: Proxy to external A2A agents
- **Configuration**: External agent endpoints, protocols
- **Capabilities**: External agent communication

#### **Orchestrator Agents**
- **Purpose**: Plan and execute complex projects
- **Configuration**: Project templates, workflow patterns
- **Capabilities**: Project planning, agent coordination, human interaction
