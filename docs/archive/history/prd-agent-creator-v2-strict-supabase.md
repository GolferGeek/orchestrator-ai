# PRD: Agent Creator v2 - Strict Information Gathering + Supabase Storage

**Version:** 2.0  
**Status:** Ready for Implementation  
**Dependencies:** Agent Creator v1, Supabase Integration  
**Estimated Timeline:** 1-2 weeks  

## 1. Executive Summary

### Problem Statement
The current Agent Creator v1 has two critical limitations:
1. **Inference Problem**: The AI infers business logic and capabilities instead of gathering complete requirements from users
2. **Storage Problem**: Agent configurations are stored as physical files in the codebase instead of the database

### Solution Overview
Agent Creator v2 implements:
- **Strict Information Gathering**: AI MUST ask users for every required piece of information, no inference allowed
- **Supabase Storage**: Agent configurations stored in database tables instead of filesystem
- **Conversation-Driven Workflow**: Multi-step conversation flow that validates completeness before creation

### Business Value
- **Quality Assurance**: Agents built from complete user specifications, not AI assumptions
- **Scalability**: Database storage enables dynamic loading, versioning, and management
- **Reliability**: Version-controlled migrations with rollback capabilities
- **User Control**: Users provide all business logic and requirements explicitly

## 2. Core Requirements

### 2.1 Strict Information Gathering Rules

**ABSOLUTE REQUIREMENTS:**
- AI NEVER infers business logic, capabilities, or domain knowledge
- AI MUST ask specific questions for each required field
- AI CANNOT proceed with creation until ALL required information is provided
- AI MUST validate completeness before generating any files

**REQUIRED User Input (NO EXCEPTIONS):**
1. **Agent Identity**
   - Agent Type (context/function)
   - Agent ID (snake_case, user specified)
   - Display Name (exact user specification)
   - Department (user chooses from fixed list)

2. **Business Logic**
   - Primary Purpose (user explains what problem it solves)
   - Specific Capabilities (user lists what it should do)
   - Skills & Examples (user provides concrete examples)
   - Expertise Areas (user specifies domains/topics)

3. **Operational Details**
   - Key Responsibilities (user defines duties)
   - Core Identity (user describes how agent presents itself)
   - Limitations (user specifies what it cannot do)
   - Communication Style (user preference)

**CONVERSATION FLOW ENFORCEMENT:**
- Step 1: Understand user's vision/problem
- Step 2: Ask specific questions for each missing requirement
- Step 3: Validate all requirements are complete
- Step 4: Confirm specifications with user
- Step 5: Generate and store agent configuration

### 2.2 Supabase Storage Architecture

**Database-First Approach:**
- All agent configurations stored in Supabase tables
- No physical files created in codebase
- Dynamic loading from database at runtime
- Version control and audit trails in database

**Storage Benefits:**
- Scalable agent management
- Easy updates and versioning
- Better security and access control
- Backup and disaster recovery
- Multi-environment support

## 3. Database Schema Design

### 3.1 Core Tables

```sql
-- Store agent configurations
CREATE TABLE agent_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(100) UNIQUE NOT NULL, -- snake_case identifier
    display_name VARCHAR(200) NOT NULL,
    agent_type VARCHAR(50) NOT NULL, -- 'context' or 'function'
    department VARCHAR(100) NOT NULL,
    reports_to VARCHAR(100), -- manager orchestrator
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, archived
    
    -- Core specifications
    primary_purpose TEXT NOT NULL,
    capabilities JSONB NOT NULL, -- array of capabilities
    expertise_areas JSONB NOT NULL, -- array of expertise domains
    responsibilities JSONB NOT NULL, -- array of responsibilities
    limitations JSONB NOT NULL, -- array of limitations
    communication_style VARCHAR(100),
    
    -- Generated content
    yaml_config TEXT NOT NULL, -- generated YAML configuration
    context_content TEXT NOT NULL, -- generated context.md content
    service_content TEXT NOT NULL, -- generated service.ts content
    
    -- Metadata
    metadata JSONB DEFAULT '{}' -- additional configuration options
);

-- Store agent skills with examples
CREATE TABLE agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_configuration_id UUID REFERENCES agent_configurations(id) ON DELETE CASCADE,
    skill_id VARCHAR(100) NOT NULL,
    skill_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    examples JSONB NOT NULL, -- array of example queries
    tags JSONB DEFAULT '[]', -- array of tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store agent creation audit trail
CREATE TABLE agent_creation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_configuration_id UUID REFERENCES agent_configurations(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- created, updated, activated, deactivated
    performed_by UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store conversation history for agent creation
CREATE TABLE agent_creation_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    agent_configuration_id UUID REFERENCES agent_configurations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    conversation_data JSONB NOT NULL, -- full conversation history
    requirements_gathered JSONB DEFAULT '{}', -- tracked requirements
    completion_status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, abandoned
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Indexes and Constraints

```sql
-- Performance indexes
CREATE INDEX idx_agent_configurations_agent_id ON agent_configurations(agent_id);
CREATE INDEX idx_agent_configurations_department ON agent_configurations(department);
CREATE INDEX idx_agent_configurations_status ON agent_configurations(status);
CREATE INDEX idx_agent_configurations_created_by ON agent_configurations(created_by);
CREATE INDEX idx_agent_skills_agent_config ON agent_skills(agent_configuration_id);
CREATE INDEX idx_creation_logs_agent_config ON agent_creation_logs(agent_configuration_id);
CREATE INDEX idx_conversations_session ON agent_creation_conversations(session_id);

-- Data constraints
ALTER TABLE agent_configurations ADD CONSTRAINT check_agent_type 
    CHECK (agent_type IN ('context', 'function'));
ALTER TABLE agent_configurations ADD CONSTRAINT check_status 
    CHECK (status IN ('active', 'inactive', 'archived', 'draft'));
ALTER TABLE agent_configurations ADD CONSTRAINT check_department 
    CHECK (department IN ('marketing', 'engineering', 'operations', 'finance', 'hr', 'sales', 'research', 'product', 'specialists'));
```

## 4. Migration Versioning Strategy

### 4.1 File Organization Structure

```
/apps/api/supabase/migrations/agent-creator-v2/
├── README.md                                    # Overview of all migrations
├── v1_initial_schema/
│   ├── 001_agent_configurations_table.sql      # Initial table creation
│   ├── 002_agent_skills_table.sql              # Skills table
│   ├── 003_audit_tables.sql                    # Audit and logging tables
│   └── NOTES.md                                # Why these files exist
├── v2_performance_fixes/
│   ├── 004_add_indexes.sql                     # Performance indexes
│   ├── 005_fix_constraints.sql                 # Fixed constraint issues
│   └── NOTES.md                                # What was wrong with v1
├── v3_conversation_tracking/
│   ├── 006_conversation_tables.sql             # Added conversation tracking
│   ├── 007_update_triggers.sql                 # Auto-update triggers
│   └── NOTES.md                                # Why conversation tracking was needed
└── rollback/
    ├── rollback_v3_to_v2.sql                   # Rollback script
    ├── rollback_v2_to_v1.sql                   # Rollback script
    └── NOTES.md                                # Rollback procedures
```

### 4.2 Migration File Naming Convention

```
Format: {version}_{description}_{timestamp}.sql
Examples:
- 001_agent_configurations_table_20250117_1400.sql
- 002_fix_department_constraint_20250117_1530.sql
- 003_add_conversation_tracking_20250118_0900.sql
```

### 4.3 NOTES.md Template

```markdown
# Migration Notes

## Version: v{X}
## Date: YYYY-MM-DD
## Files in this version:
- file1.sql - Description
- file2.sql - Description

## Why this version was needed:
- Problem 1: Description of issue
- Problem 2: Description of issue

## What changed from previous version:
- Change 1: Specific modification
- Change 2: Specific modification

## Known issues (if any):
- Issue 1: Description and workaround
- Issue 2: Description and workaround

## Testing performed:
- Test 1: Description and result
- Test 2: Description and result

## Rollback procedure:
See rollback/rollback_v{X}_to_v{X-1}.sql
```

## 5. v1 to v2 Migration Analysis

### 5.1 What to Keep from v1

**Service Architecture (`agent-service.ts:16-50`)**
- ✅ **KEEP**: Basic service structure and error handling wrapper
- ✅ **KEEP**: Response structure and metadata format
- ✅ **KEEP**: Integration with ContextAgentBaseService

**Agent Discovery Integration (`agent-service.ts:178-195`)**  
- ✅ **KEEP**: Agent discovery refresh mechanism
- ✅ **KEEP**: HTTP service integration for discovery updates

**Conversation Flow Structure (`context.md:79-120`)**
- ✅ **KEEP**: Concept of gathering user requirements before creation
- ✅ **KEEP**: Focus on user-provided information vs AI inference

### 5.2 What to Remove Entirely from v1

**❌ REMOVE: File System Operations (`agent-service.ts:138-175`)**
```typescript
// DELETE ENTIRELY: Direct filesystem writes
const AGENTS_BASE_DIR = '/path/to/agents/actual';
await fs.mkdir(agentDir, { recursive: true });
await fs.writeFile(yamlPath, yamlContent);
await fs.writeFile(mdPath, mdContent);  
await fs.writeFile(tsPath, tsContent);
```
**Reason:** v2 stores in Supabase database, not filesystem

**❌ REMOVE: File Content Extraction (`agent-service.ts:69-107`)**
```typescript  
// DELETE ENTIRELY: Code block extraction logic
const yamlMatch = message.match(/```yaml\n([\s\S]*?)\n```/);
const mdMatch = message.match(/```markdown\n([\s\S]*?)\n```/);
const tsMatch = message.match(/```typescript\n([\s\S]*?)\n```/);
```
**Reason:** v2 uses structured data collection, not file block parsing

**❌ REMOVE: Template Generation (`context.md:148-280`)**
```markdown
# DELETE ENTIRELY: Template file generation instructions
1. **Create the agent.yaml file:**
2. **Create the context.md file:**  
3. **Create the agent-service.ts file:**
```
**Reason:** v2 generates files after collecting structured data

**❌ REMOVE: Self-Audit System (`context.md:282-329`)**
```markdown
# DELETE ENTIRELY: 4-layer identity self-audit system
### **LAYER 1: Identity Audit**
### **LAYER 2: Capability Audit**
### **LAYER 3: Programming Audit**  
### **LAYER 4: User Fulfillment Audit**
```
**Reason:** v2 uses structured validation, not subjective self-audit

### 5.3 What to Modify from v1

**🔄 MODIFY: Information Gathering Strategy**

**v1 (PROBLEMATIC):**
```markdown
**CORE PRINCIPLE: Get ALL essential information FROM users - NO fallbacks for business logic**
# Listed requirements but no enforcement
```

**v2 (STRUCTURED):**
```markdown
**CORE PRINCIPLE: 12-question structured sequence with hard validation**
# Phase-based progression with requirement gates
```

**🔄 MODIFY: Conversation Trigger Logic**

**v1 (FILE-BASED):**
```typescript
private shouldTriggerAgentCreation(response: any): boolean {
  // Check for YAML, markdown, and TypeScript code blocks
  return hasYaml && hasMarkdown && hasTypescript;
}
```

**v2 (REQUIREMENT-BASED):**
```typescript
private shouldTriggerAgentCreation(requirements: any): boolean {
  // Check for complete structured requirements
  return this.validateRequirementsCompleteness(requirements).isComplete;
}
```

**🔄 MODIFY: Core Identity (`context.md:1-28`)**

**v1 (FILE-FOCUSED):**
```markdown
You are the Agent Creator - a specialized agent factory that CREATES ACTUAL WORKING AGENTS by generating real files in the codebase.
```

**v2 (DATABASE-FOCUSED):**
```markdown
You are the Agent Creator - a specialized agent factory that CREATES ACTUAL WORKING AGENTS by collecting complete user requirements and storing agent configurations in the database.
```

## 6. Implementation Architecture

### 6.1 Enhanced Agent Discovery Service

**Current Discovery:** Only scans filesystem (`/src/agents/actual/`)  
**Required Change:** Hybrid discovery from both filesystem AND Supabase

```typescript
// Enhanced Agent Discovery Service  
@Injectable()
export class AgentDiscoveryServiceV2 extends AgentDiscoveryService {
  
  async discoverAgents(): Promise<DiscoveredAgent[]> {
    this.logger.log('🔍 Starting hybrid agent discovery...');
    
    // Step 1: Discover filesystem agents (existing v1 agents)
    const filesystemAgents = await this.discoverFilesystemAgents();
    
    // Step 2: Discover Supabase agents (new v2 agents)  
    const supabaseAgents = await this.discoverSupabaseAgents();
    
    // Step 3: Merge and deduplicate
    const allAgents = this.mergeAgentSources(filesystemAgents, supabaseAgents);
    
    // Step 4: Build hierarchy from combined sources
    this.buildAgentHierarchy(allAgents);
    
    return allAgents;
  }
  
  private async discoverSupabaseAgents(): Promise<DiscoveredAgent[]> {
    const { data: dbAgents, error } = await this.supabase
      .from('agent_configurations')
      .select(`
        *,
        agent_skills (*)
      `)
      .eq('status', 'active');
      
    if (error) {
      this.logger.error('Failed to discover Supabase agents:', error);
      return [];
    }
    
    return dbAgents.map(dbAgent => this.transformDbAgentToDiscovered(dbAgent));
  }
  
  private transformDbAgentToDiscovered(dbAgent: any): DiscoveredAgent {
    return {
      name: dbAgent.agent_id,
      type: dbAgent.department,
      path: `${dbAgent.department}/${dbAgent.agent_id}`,
      servicePath: 'virtual://supabase', // Virtual path for DB agents
      reportsTo: dbAgent.reports_to,
      metadata: {
        displayName: dbAgent.display_name,
        description: dbAgent.primary_purpose,
        category: dbAgent.agent_type,
        version: dbAgent.version.toString(),
        source: 'supabase' // Mark as DB-sourced
      }
    };
  }
}
```

### 6.2 Dynamic Agent Loading System

**New Requirement:** Load agent configurations from database at runtime

```typescript
// New service for dynamic agent loading
@Injectable() 
export class DynamicAgentLoaderService {
  
  async loadAgent(agentId: string): Promise<AgentInstance> {
    // Check if agent exists in Supabase
    const config = await this.agentConfigService.getAgentConfiguration(agentId);
    
    if (config) {
      // Create virtual agent instance from DB config
      return this.createVirtualAgentInstance(config);
    }
    
    // Fallback to filesystem agent
    return this.loadFilesystemAgent(agentId);
  }
  
  private createVirtualAgentInstance(config: AgentConfiguration): AgentInstance {
    // Create agent instance with:
    // - YAML config from database
    // - Context content from database  
    // - Generated service class from database
    
    return new VirtualAgentInstance({
      name: config.agent_id,
      config: JSON.parse(config.yaml_config),
      context: config.context_content,
      serviceCode: config.service_content
    });
  }
}
```

### 6.3 Complete Information Requirements Analysis

Based on analysis of existing agent.yaml files and hierarchy structure, the AI must gather these 12 critical fields:

**Phase 1: Agent Identity (4 questions)**
1. **Agent Type**: context/api/function (user chooses from fixed options)
2. **Agent ID**: snake_case unique identifier (user provides, system validates uniqueness)
3. **Display Name**: human-readable title (user provides exactly)
4. **Department**: from fixed list of 11 departments (user selects, AI explains options)

**Phase 2: Hierarchy Validation (1 question)**  
5. **Reports To**: auto-generated from department + user confirmation
   - Rule: `${department}_manager_orchestrator`
   - Validation: Manager must exist in current agent hierarchy

**Phase 3: Business Purpose (3 questions)**
6. **Primary Purpose**: 1-2 sentences of core problem solving (user explains business need)
7. **Capabilities**: specific abilities list (user provides business-specific capabilities)
8. **Expertise Areas**: knowledge domains (user specifies industry/domain expertise)

**Phase 4: Skills & Operations (3 questions)**
9. **Skills**: structured skills with examples (user provides concrete domain examples)
   ```
   For EACH skill: name, description, 2-3 real user queries from their business
   ```
10. **Responsibilities**: key duties in user's business context (user defines operational duties)
11. **Limitations**: boundaries and restrictions (user defines business rules/compliance)

**Phase 5: Personality & Configuration (1 question)**
12. **Core Identity + Communication Style**: personality, tone, and technical configuration

**Validation Rules:**
- **Zero AI Inference**: Cannot proceed without explicit user input for ANY field
- **Business Logic**: User must provide all domain knowledge and business processes  
- **Examples**: User must provide concrete examples from their actual use cases
- **Completeness Gates**: Hard validation before proceeding to next phase

### 6.4 Updated Agent Creator Service

```typescript
// Enhanced service with strict requirements and Supabase storage
export class AgentCreatorServiceV2 extends ContextAgentBaseService {
  
  async processTask(taskRequest: any): Promise<any> {
    // Step 1: Parse conversation for requirements
    const requirements = await this.parseRequirements(taskRequest);
    
    // Step 2: Check completeness (STRICT)
    const completenessCheck = this.validateRequirementsCompleteness(requirements);
    
    if (!completenessCheck.isComplete) {
      // Return specific questions for missing requirements
      return this.askForMissingRequirements(completenessCheck.missing);
    }
    
    // Step 3: Generate agent files
    const generatedFiles = await this.generateAgentFiles(requirements);
    
    // Step 4: Store in Supabase (NOT filesystem)
    const agentConfig = await this.storeAgentInDatabase(requirements, generatedFiles);
    
    // Step 5: Return success with database reference
    return this.returnSuccessResponse(agentConfig);
  }
  
  private validateRequirementsCompleteness(requirements: any): {
    isComplete: boolean;
    missing: string[];
    suggestions: string[];
  } {
    const required = [
      'agent_type', 'agent_id', 'display_name', 'department',
      'primary_purpose', 'capabilities', 'skills', 'expertise_areas',
      'responsibilities', 'core_identity'
    ];
    
    const missing = required.filter(field => !requirements[field]);
    
    return {
      isComplete: missing.length === 0,
      missing,
      suggestions: this.generateSpecificQuestions(missing)
    };
  }
  
  private askForMissingRequirements(missing: string[]): any {
    // Generate specific questions for each missing requirement
    const questions = missing.map(field => this.getQuestionForField(field));
    
    return {
      message: this.formatQuestionMessage(questions),
      metadata: {
        agentName: 'Agent Creator',
        requirementsStatus: 'incomplete',
        missingFields: missing
      }
    };
  }
  
  private async storeAgentInDatabase(requirements: any, files: any): Promise<any> {
    // Store in Supabase instead of filesystem
    const { data, error } = await this.supabase
      .from('agent_configurations')
      .insert({
        agent_id: requirements.agent_id,
        display_name: requirements.display_name,
        agent_type: requirements.agent_type,
        department: requirements.department,
        primary_purpose: requirements.primary_purpose,
        capabilities: requirements.capabilities,
        expertise_areas: requirements.expertise_areas,
        responsibilities: requirements.responsibilities,
        yaml_config: files.yamlContent,
        context_content: files.mdContent,
        service_content: files.tsContent,
        created_by: requirements.user_id
      })
      .select()
      .single();
      
    if (error) throw new Error(`Database storage failed: ${error.message}`);
    
    // Also store skills
    if (requirements.skills) {
      await this.storeAgentSkills(data.id, requirements.skills);
    }
    
    return data;
  }
}
```

### 5.2 Database Service Layer

```typescript
// New service for database operations
@Injectable()
export class AgentConfigurationService {
  constructor(private readonly supabase: SupabaseClient) {}
  
  async createAgentConfiguration(config: CreateAgentConfigDto): Promise<AgentConfiguration> {
    // Validate all required fields are present
    this.validateRequiredFields(config);
    
    // Store main configuration
    const { data: agentConfig, error } = await this.supabase
      .from('agent_configurations')
      .insert(config)
      .select()
      .single();
      
    if (error) throw new DatabaseError(`Failed to create agent: ${error.message}`);
    
    // Store related data (skills, audit log)
    await this.createRelatedData(agentConfig.id, config);
    
    return agentConfig;
  }
  
  async getAgentConfiguration(agentId: string): Promise<AgentConfiguration | null> {
    const { data, error } = await this.supabase
      .from('agent_configurations')
      .select(`
        *,
        agent_skills (*)
      `)
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(`Failed to fetch agent: ${error.message}`);
    }
    
    return data;
  }
  
  async listAgentsByDepartment(department: string): Promise<AgentConfiguration[]> {
    const { data, error } = await this.supabase
      .from('agent_configurations')
      .select('*')
      .eq('department', department)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
      
    if (error) throw new DatabaseError(`Failed to list agents: ${error.message}`);
    
    return data || [];
  }
  
  private validateRequiredFields(config: any): void {
    const required = [
      'agent_id', 'display_name', 'agent_type', 'department',
      'primary_purpose', 'capabilities', 'expertise_areas'
    ];
    
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}
```

## 6. Updated Conversation Flow

### 6.1 Strict Question Sequence

```markdown
**Phase 1: Agent Identity**
1. What type of agent? (context-driven or function-based)
2. What should the agent ID be? (snake_case, like 'content_writer')  
3. What should the display name be? (like 'Content Writing Specialist')
4. Which department? (marketing, engineering, operations, etc.)

**Phase 2: Business Purpose**
5. What primary problem should this agent solve? (user explains)
6. What specific capabilities should it have? (user lists)
7. What skills should it demonstrate? (user provides with examples)
8. What areas of expertise? (user specifies domains)

**Phase 3: Operational Details**  
9. What are its key responsibilities? (user defines)
10. How should it present itself? (user describes personality/style)
11. What should it NOT do? (user specifies limitations)
12. What communication style? (professional, casual, technical, etc.)

**Phase 4: Validation & Creation**
13. Confirm all specifications are correct
14. Generate and store agent configuration
15. Return success with database reference
```

### 6.2 Question Templates

```typescript
const QUESTION_TEMPLATES = {
  agent_type: "What type of agent should this be?\n- context-driven (powered by detailed instructions)\n- function-based (with custom code functions)\n\nWhich type fits your needs?",
  
  agent_id: "What should the agent ID be? This should be in snake_case format like 'social_media_writer' or 'invoice_processor'. What ID would you like?",
  
  display_name: "What should the display name be? This is what users will see, like 'Social Media Writer' or 'Invoice Processing Assistant'. What name would you like?",
  
  department: "Which department should this agent belong to?\nOptions: marketing, engineering, operations, finance, hr, sales, research, product, specialists\n\nWhich department?",
  
  primary_purpose: "What is the main problem this agent should solve? Please describe the primary purpose in 1-2 sentences.",
  
  capabilities: "What specific capabilities should this agent have? Please list the things it should be able to do. For example:\n- Create social media posts\n- Analyze engagement metrics\n- Schedule content\n\nWhat capabilities do you need?",
  
  skills: "What skills should this agent demonstrate? For each skill, please provide:\n- Skill name\n- Description of what it does\n- 2-3 example requests users might make\n\nWhat skills should it have?",
  
  expertise_areas: "What areas should this agent be an expert in? List the topics, domains, or fields it should know well.",
  
  responsibilities: "What are the key responsibilities of this agent? What duties should it handle?",
  
  core_identity: "How should this agent present itself? Describe its personality, tone, and how it should interact with users.",
  
  limitations: "What should this agent NOT do? What are its limitations or boundaries?",
  
  communication_style: "What communication style should it use?\nOptions: professional, casual, technical, conversational, formal, creative\n\nWhat style fits best?"
};
```

## 7. User Entry Points & Experience

### 7.1 How Users Access Agent Creator

**Multiple Entry Points:**
```
1. Direct Command: "/create-agent" to any orchestrator
2. Orchestrator Delegation: CEO/Manager orchestrators route creation requests
3. Web UI: "Create New Agent" button (future enhancement)
4. Agent Creator Direct: Direct conversation with Agent Creator agent
```

**Entry Point Workflow:**
```
User: "I want to create a new marketing agent"
CEO Orchestrator: "I'll connect you with our Agent Creator to build that for you."
→ Delegates to Agent Creator
Agent Creator: "I'll help you create a marketing agent. Let's start with the basics..."
```

### 7.2 Conversation State Management

**Progress Persistence:**
```sql
-- Automatically save progress during conversation
INSERT INTO agent_creation_conversations (
  session_id, user_id, conversation_data, 
  requirements_gathered, completion_status
) VALUES (...);

-- Resume interrupted conversations
SELECT * FROM agent_creation_conversations 
WHERE user_id = ? AND completion_status = 'in_progress';
```

**User Experience:**
```
Scenario: User closes browser during question 7
Next Session: "I see you were creating a marketing agent. We left off at defining capabilities. Would you like to continue or start over?"
```

### 7.3 Error Handling & Recovery

**Database Transaction Safety:**
```typescript
async createAgent(requirements: CompleteRequirements): Promise<AgentResult> {
  const transaction = await this.supabase.rpc('begin_transaction');
  
  try {
    // 1. Generate agent files
    const generatedContent = await this.generateAgentContent(requirements);
    
    // 2. Store in database
    const agent = await this.storeAgentConfiguration(generatedContent);
    
    // 3. Update discovery cache
    await this.refreshAgentDiscovery();
    
    // 4. Commit transaction
    await this.supabase.rpc('commit_transaction', { transaction_id: transaction.id });
    
    return { success: true, agent };
  } catch (error) {
    // Rollback on any failure
    await this.supabase.rpc('rollback_transaction', { transaction_id: transaction.id });
    return { success: false, error: error.message };
  }
}
```

**User-Facing Error Messages:**
```
Database Error: "I couldn't save your agent due to a technical issue. Please try again, and I'll remember your progress."
Validation Error: "The agent ID 'marketing_agent' already exists. Please choose a different ID."
Discovery Error: "Your agent was created but may take a moment to appear in the system. Try again in 30 seconds."
```

### 7.4 Success Confirmation & Next Steps

**Rich Success Feedback:**
```
Agent Creator Response:
"🎉 **Agent Created Successfully!**

Your **Social Media Content Creator** is now live and ready to use!

**Details:**
- Agent ID: social_media_writer
- Department: Marketing  
- Reports to: marketing_manager_orchestrator

**Next Steps:**
1. **Test your agent**: Say 'Create a LinkedIn post about AI trends'
2. **Find your agent**: Look for 'Social Media Content Creator' in the agent list
3. **Get help**: Ask me if you need to modify anything

Your agent is immediately available for conversations!"
```

## 8. File Generation Process

### 8.1 Template Generation Logic

**Generation Workflow:**
```typescript
private async generateAgentContent(requirements: CompleteRequirements): Promise<GeneratedContent> {
  // Templates live in service code, not AI context
  const yamlContent = this.generateYamlFromTemplate(requirements);
  const contextContent = this.generateContextFromTemplate(requirements);  
  const serviceContent = this.generateServiceFromTemplate(requirements);
  
  return { yamlContent, contextContent, serviceContent };
}

private generateYamlFromTemplate(req: CompleteRequirements): string {
  return `# ${req.display_name} Agent Configuration
metadata:
  name: "${req.display_name}"
  type: "specialist"
  category: "${req.agent_type}"
  version: "1.0.0"
  description: "${req.primary_purpose}"

hierarchy:
  level: specialist
  reportsTo: ${req.reports_to}
  department: ${req.department}

type: "${req.agent_type}"

capabilities:
${req.capabilities.map(cap => `  - ${cap}`).join('\n')}

skills:
${req.skills.map(skill => `  - id: "${skill.id}"
    name: "${skill.name}"
    description: "${skill.description}"
    examples:
${skill.examples.map(ex => `      - "${ex}"`).join('\n')}`).join('\n\n')}`;
}
```

**Database Storage:**
```sql
-- All generated content stored as text fields
INSERT INTO agent_configurations (
  agent_id, display_name, department,
  yaml_config,     -- Generated YAML content  
  context_content, -- Generated context.md content
  service_content, -- Generated service.ts content
  primary_purpose, capabilities, ...
) VALUES (...);
```

## 9. Implementation Plan

### Phase 1: Database Foundation (Week 1)
1. Create migration files with versioning structure
2. Implement core database schema
3. Add indexes and constraints
4. Create database service layer
5. Test database operations

### Phase 2: Service Updates (Week 1-2)  
1. Update Agent Creator service with strict requirements
2. Implement conversation flow validation
3. Replace filesystem storage with database storage
4. Add requirement completeness checking
5. Test end-to-end agent creation

### Phase 3: Testing & Validation (Week 2)
1. Test strict information gathering flow
2. Validate database storage operations  
3. Test rollback procedures
4. Performance testing
5. Security validation

## 8. Success Criteria

### 8.1 Functional Requirements
- [ ] AI asks specific questions for ALL required fields
- [ ] AI NEVER infers business logic or capabilities
- [ ] Agent configurations stored in Supabase database
- [ ] No physical files created in codebase
- [ ] Migration versioning system implemented
- [ ] Rollback capabilities tested and working

### 8.2 Quality Requirements
- [ ] 100% of required fields gathered from user before creation
- [ ] 0% inference of business logic by AI
- [ ] Database operations complete within 5 seconds
- [ ] Migration files properly versioned and documented
- [ ] All edge cases captured in separate migration files

### 8.3 User Experience Requirements
- [ ] Clear, specific questions for each requirement
- [ ] Progress indication showing completion status
- [ ] Validation messages explain exactly what's missing
- [ ] Success confirmation shows database reference
- [ ] No confusion about what information is needed

## 9. Risk Mitigation

### 9.1 Database Risks
- **Risk**: Migration failures breaking system
- **Mitigation**: Versioned migrations with rollback scripts

### 9.2 Information Gathering Risks  
- **Risk**: AI still inferring despite strict rules
- **Mitigation**: Hard validation checks prevent creation without complete info

### 9.3 Storage Transition Risks
- **Risk**: Breaking existing filesystem-based agents
- **Mitigation**: Gradual migration with backward compatibility

## 10. Complete Information Requirements Analysis

Based on analysis of existing agent.yaml files and hierarchy structure, here's EVERYTHING the AI must gather:

### 10.1 CRITICAL: Agent Identity & Classification

**Agent Type Selection:**
```
REQUIRED: What type of agent should this be?
OPTIONS: 
- context: Powered by Context.md system prompt (most common)
- api: Delegates to external APIs/services  
- function: Has custom TypeScript/Python functions
USER MUST CHOOSE: Cannot be inferred
```

**Agent ID (Technical Identifier):**
```
REQUIRED: What should the agent ID be?
FORMAT: snake_case (e.g., 'social_media_writer', 'invoice_processor')
RULES:
- Must be unique across ALL agents (filesystem + database)
- Must start with letter, only lowercase letters, numbers, underscores
- Will be used for routing and database primary key
USER MUST PROVIDE: Cannot be auto-generated
```

**Display Name (Human-Readable):**
```
REQUIRED: What should the display name be?
FORMAT: Proper title case (e.g., 'Social Media Writer', 'Invoice Processing Assistant')
USAGE: Shown in UI, conversation headers, reports
USER MUST PROVIDE: Cannot be inferred from ID
```

### 10.2 CRITICAL: Organizational Hierarchy

**Department Selection:**
```
REQUIRED: Which department should this agent belong to?
FIXED OPTIONS (from existing structure):
- engineering: Development, technical support, code review
- finance: Budgeting, analysis, reporting, invoicing  
- hr: Recruitment, onboarding, employee support
- legal: Compliance, contracts, policy guidance
- marketing: Content, campaigns, social media, SEO
- operations: Process management, logistics, coordination
- product: Development, planning, user experience
- productivity: Task management, workflow optimization
- research: Data analysis, market research, documentation
- sales: Lead generation, customer outreach, deals
- specialists: Unique or cross-functional expertise

USER MUST CHOOSE: Cannot infer business needs
AI MUST EXPLAIN: Why each department fits different agent types
```

**Manager Assignment (Reports To):**
```
REQUIRED: Which manager should this agent report to?
AVAILABLE MANAGERS (from existing hierarchy):
- engineering_manager_orchestrator
- finance_manager_orchestrator  
- hr_manager_orchestrator
- legal_manager_orchestrator
- marketing_manager_orchestrator
- operations_manager_orchestrator
- product_manager_orchestrator
- productivity_manager_orchestrator
- research_manager_orchestrator
- sales_manager_orchestrator
- specialists_manager_orchestrator

RULE: Manager must match department
EXAMPLE: If department = 'marketing', then reportsTo = 'marketing_manager_orchestrator'
AI MUST: Validate manager exists and matches department
```

### 10.3 CRITICAL: Business Logic & Purpose

**Primary Purpose (Core Problem Solving):**
```
REQUIRED: What is the main problem this agent should solve?
FORMAT: 1-2 clear sentences describing the core business need
EXAMPLES:
- "Generate engaging social media content and manage posting schedules for e-commerce brands"
- "Process incoming invoices, extract data, and route for approval workflows"
- "Analyze customer support tickets and provide recommended responses"

USER MUST EXPLAIN: Cannot infer business domain expertise
AI CANNOT: Make assumptions about business processes
```

**Specific Capabilities List:**
```
REQUIRED: What specific capabilities should this agent have?
FORMAT: Array of specific actions/abilities
EXAMPLES:
- content_creation, social_media_management, analytics_reporting
- invoice_processing, data_extraction, approval_routing
- ticket_analysis, response_generation, escalation_detection

USER MUST LIST: Each capability they need
AI CANNOT: Infer what capabilities a business might need
VALIDATION: Must align with primary purpose
```

**Skills with Examples:**
```
REQUIRED: What skills should this agent demonstrate?
FORMAT: For EACH skill, user must provide:
- Skill ID (snake_case, e.g., 'content_writing')
- Skill Name (display name, e.g., 'Content Writing')
- Description (what this skill does)
- 2-3 Example Queries (actual things users would ask)

EXAMPLE SKILL:
{
  id: "social_post_creation",
  name: "Social Media Post Creation", 
  description: "Generate engaging posts for various social platforms",
  examples: [
    "Create a LinkedIn post about our new product launch",
    "Write an Instagram caption for this product photo",
    "Generate Twitter posts for our weekly newsletter"
  ]
}

USER MUST PROVIDE: Concrete examples from their domain
AI CANNOT: Generate generic examples without context
```

### 10.4 CRITICAL: Domain Expertise & Knowledge

**Expertise Areas:**
```
REQUIRED: What topics/domains should this agent be an expert in?
FORMAT: Specific knowledge domains relevant to capabilities
EXAMPLES:
- B2B SaaS marketing, technical product features, growth strategies
- Accounts payable processes, compliance requirements, vendor management  
- Customer service protocols, technical troubleshooting, escalation procedures

USER MUST SPECIFY: Their business domain expertise needs
AI CANNOT: Infer industry knowledge requirements
```

**Key Responsibilities:**
```
REQUIRED: What are the key duties this agent should handle?
FORMAT: Specific responsibilities in user's business context
EXAMPLES:
- "Maintain brand voice across all marketing channels"
- "Ensure invoice compliance with company approval policies"
- "Escalate technical issues that require human intervention"

USER MUST DEFINE: Based on their operational needs
AI CANNOT: Assume business responsibilities
```

### 10.5 OPERATIONAL: Agent Behavior & Boundaries

**Core Identity & Personality:**
```
REQUIRED: How should this agent present itself?
ASPECTS TO DEFINE:
- Professional tone (formal, casual, friendly, technical)
- Communication style (concise, detailed, conversational)
- Personality traits (helpful, analytical, creative, methodical)
- Brand alignment (how it represents the company)

USER MUST DESCRIBE: Their preferred agent persona
AI CANNOT: Assume company culture or communication preferences
```

**Limitations & Boundaries:**
```
REQUIRED: What should this agent NOT do?
FORMAT: Clear boundaries and restrictions
EXAMPLES:
- "Cannot approve invoices over $10,000 without human review"
- "Should not create content about competitors without approval"
- "Cannot access customer payment information"

USER MUST SPECIFY: Business rules and compliance requirements
AI CANNOT: Infer legal or policy constraints
```

**Communication Preferences:**
```
REQUIRED: What communication style should it use?
OPTIONS:
- professional: Formal business communication
- casual: Friendly, approachable tone
- technical: Precise, detailed technical language
- conversational: Natural, flowing dialogue
- formal: Official, structured responses
- creative: Engaging, imaginative expression

USER MUST CHOOSE: Based on their audience and context
AI CANNOT: Assume communication preferences
```

### 10.6 TECHNICAL: Configuration Details

**For API Agents (if agent_type = 'api'):**
```
REQUIRED: API configuration details
- Endpoint URL
- HTTP method (GET, POST, etc.)
- Authentication requirements
- Request/response format
- Timeout settings

USER MUST PROVIDE: Technical integration details
AI CANNOT: Guess API specifications
```

**For Function Agents (if agent_type = 'function'):**
```
REQUIRED: Function specifications
- Programming language (TypeScript/Python)
- Required dependencies/packages
- Input/output data structures
- External service integrations

USER MUST SPECIFY: Technical implementation needs
AI CANNOT: Infer coding requirements
```

## 11. Structured Conversation Flow Implementation

### 11.1 12-Question Conversation Sequence

```typescript
const INFORMATION_GATHERING_FLOW = {
  
  // Phase 1: Agent Classification (Questions 1-4)
  phase1_identity: [
    {
      field: 'agent_type',
      question: 'What type of agent should this be?\n• context: Powered by detailed instructions (most common)\n• api: Delegates to external services\n• function: Has custom code functions\n\nWhich type fits your needs?',
      validation: (answer) => ['context', 'api', 'function'].includes(answer),
      required: true
    },
    {
      field: 'agent_id', 
      question: 'What should the agent ID be? This should be in snake_case format like "social_media_writer" or "invoice_processor". What ID would you like?',
      validation: (answer) => /^[a-z][a-z0-9_]*$/.test(answer),
      asyncValidation: async (answer) => await this.checkAgentIdAvailability(answer),
      required: true
    },
    {
      field: 'display_name',
      question: 'What should the display name be? This is what users will see, like "Social Media Writer" or "Invoice Processing Assistant". What name would you like?',
      validation: (answer) => answer.length >= 3 && answer.length <= 100,
      required: true
    },
    {
      field: 'department',
      question: 'Which department should this agent belong to?\n\nOptions:\n• engineering: Development, technical support\n• finance: Budgeting, invoicing, reporting\n• hr: Recruitment, onboarding, employee support\n• legal: Compliance, contracts, policies\n• marketing: Content, campaigns, social media\n• operations: Process management, logistics\n• product: Development, planning, UX\n• productivity: Task management, workflows\n• research: Data analysis, market research\n• sales: Lead generation, customer outreach\n• specialists: Unique or cross-functional expertise\n\nWhich department?',
      validation: (answer) => this.isValidDepartment(answer),
      required: true
    }
  ],
  
  // Phase 2: Hierarchy & Management (Question 5)
  phase2_hierarchy: [
    {
      field: 'reports_to',
      question: (context) => `Perfect! Since this is a ${context.department} agent, it should report to the ${context.department}_manager_orchestrator. Is that correct?`,
      autoGenerate: (context) => `${context.department}_manager_orchestrator`,
      validation: (answer, context) => answer === `${context.department}_manager_orchestrator`,
      required: true
    }
  ],
  
  // Phase 3: Business Purpose (Questions 6-8)
  phase3_purpose: [
    {
      field: 'primary_purpose',
      question: 'What is the main problem this agent should solve? Please describe the primary purpose in 1-2 sentences.',
      validation: (answer) => answer.length >= 20 && answer.length <= 500,
      required: true
    },
    {
      field: 'capabilities',
      question: 'What specific capabilities should this agent have? Please list the things it should be able to do.\n\nFor example:\n• Create social media posts\n• Analyze engagement metrics\n• Schedule content\n\nWhat capabilities do you need? (Please list them)',
      validation: (answer) => Array.isArray(answer) && answer.length > 0,
      parseAnswer: (answer) => this.parseCapabilitiesList(answer),
      required: true
    },
    {
      field: 'expertise_areas',
      question: 'What areas should this agent be an expert in? List the topics, domains, or fields it should know well.',
      validation: (answer) => Array.isArray(answer) && answer.length > 0,
      parseAnswer: (answer) => this.parseExpertiseList(answer),
      required: true
    }
  ],
  
  // Phase 4: Skills & Examples (Questions 9-11)
  phase4_skills: [
    {
      field: 'skills',
      question: 'What skills should this agent demonstrate? For each skill, I need:\n\n1. Skill name\n2. Description of what it does\n3. 2-3 example requests users might make\n\nPlease describe the first skill:',
      multiStep: true,
      validation: (skills) => skills.length > 0 && skills.every(this.validateSkillStructure),
      required: true
    },
    {
      field: 'responsibilities',
      question: 'What are the key responsibilities of this agent? What duties should it handle in your business?',
      validation: (answer) => Array.isArray(answer) && answer.length > 0,
      parseAnswer: (answer) => this.parseResponsibilitiesList(answer),
      required: true
    },
    {
      field: 'limitations',
      question: 'What should this agent NOT do? What are its limitations or boundaries?',
      validation: (answer) => Array.isArray(answer) && answer.length > 0,
      parseAnswer: (answer) => this.parseLimitationsList(answer),
      required: true
    }
  ],
  
  // Phase 5: Personality & Style (Question 12)
  phase5_style: [
    {
      field: 'core_identity',
      question: 'How should this agent present itself? Describe its personality, tone, and how it should interact with users.',
      validation: (answer) => answer.length >= 20 && answer.length <= 300,
      required: true
    },
    {
      field: 'communication_style',
      question: 'What communication style should it use?\n\nOptions:\n• professional: Formal business communication\n• casual: Friendly, approachable tone\n• technical: Precise, detailed technical language\n• conversational: Natural, flowing dialogue\n• formal: Official, structured responses\n• creative: Engaging, imaginative expression\n\nWhat style fits best?',
      validation: (answer) => ['professional', 'casual', 'technical', 'conversational', 'formal', 'creative'].includes(answer),
      required: true
    }
  ],
  
  // Phase 6: Technical Configuration (Conditional)
  phase6_technical: [
    // Only for API agents
    {
      field: 'api_configuration',
      condition: (context) => context.agent_type === 'api',
      question: 'Since this is an API agent, I need the technical details:\n• API endpoint URL\n• HTTP method\n• Authentication details\n• Request/response format\n\nPlease provide these details:',
      validation: (config) => this.validateApiConfiguration(config),
      required: true
    },
    // Only for function agents  
    {
      field: 'function_configuration',
      condition: (context) => context.agent_type === 'function',
      question: 'Since this is a function agent, I need:\n• Programming language (TypeScript/Python)\n• Required dependencies\n• Function specifications\n\nPlease provide these details:',
      validation: (config) => this.validateFunctionConfiguration(config),
      required: true
    }
  ]
};
```

**Validation Strategy:**
- Each answer validated before proceeding
- Async validation for uniqueness checks
- Context-aware validation (manager must match department)
- Clear error messages with specific fixes needed

**Conversation State Management:**
- Track completion status for each phase
- Allow users to go back and modify earlier answers
- Save progress in database for multi-session conversations
- Validate entire requirement set before agent creation

**No Inference Rules:**
- AI cannot proceed without explicit user input for ANY required field
- AI cannot generate examples without user domain knowledge
- AI cannot assume business processes, rules, or constraints
- AI must ask follow-up questions if answers are unclear

This PRD ensures both strict information gathering and robust database storage with comprehensive version control for all migration files.