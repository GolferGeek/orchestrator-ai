# Phase 5: Agent Builder - PRD

## Overview

**Goal**: Build a comprehensive, user-friendly UI for creating, configuring, testing, and managing agents without writing code.

**Success Criteria**:
- Non-technical users can create working agents through UI
- All agent types supported: context, tool, orchestration
- Live testing environment with instant feedback
- Version control and deployment management
- Beautiful, intuitive UX that makes agent building delightful

## Phase Dependencies

**Depends On**:
- ✅ Phase 0: Aggressive Cleanup (clean workspace)
- ✅ Phase 1: Context Agents (conversation infrastructure)
- ✅ Phase 4: Tool Agents (MCP tool integration)

**Enables**:
- Phase 6: Orchestration Examples (easy creation of Finance Manager)
- Phase 7: Enhanced Orchestration (complex multi-agent workflows)
- All future phases (agents built through UI instead of config files)

## Background

Currently, agents are configured through TypeScript config files and require developer knowledge. The Agent Builder will democratize agent creation by providing:

1. **Visual Configuration**: Drag-and-drop, form-based agent setup
2. **Live Testing**: Test agents in real-time as you build them
3. **Template Library**: Pre-built agent templates for common use cases
4. **Version Control**: Track agent changes, rollback, A/B test
5. **Deployment Pipeline**: Promote agents from dev → staging → production
6. **🆕 n8n Agent Builder**: AI-powered n8n workflow + wrapper agent generation

## Agent Builder Architecture

### 1. Core Components

```
┌─────────────────────────────────────────────────────┐
│                 Agent Builder UI                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  Template  │  │   Config   │  │    Test    │    │
│  │  Selector  │  │   Editor   │  │   Studio   │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  Version   │  │  Deploy    │  │  Monitor   │    │
│  │  Control   │  │  Manager   │  │  Dashboard │    │
│  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│            Agent Builder API (NestJS)                │
│  ┌────────────────────────────────────────────┐    │
│  │  AgentBuilderService                        │    │
│  │  - createAgent()                            │    │
│  │  - updateAgent()                            │    │
│  │  - testAgent()                              │    │
│  │  - publishAgent()                           │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│                  Database Layer                      │
│  ┌──────────────┐  ┌──────────────┐                │
│  │agent_configs │  │agent_versions│                │
│  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐  ┌──────────────┐                │
│  │agent_templates│ │agent_deploys │                │
│  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

### 2. Agent Configuration Schema

```typescript
interface AgentConfig {
  // Identity
  id: string;
  name: string;              // e.g., 'finance-manager'
  namespace: string;         // e.g., 'user-123', 'system'
  displayName: string;       // e.g., 'Finance Manager'
  description: string;
  icon?: string;
  tags: string[];

  // Type & Behavior
  type: 'context' | 'tool' | 'orchestration';
  mode: 'plan' | 'build' | 'tool' | 'orchestrate' | 'converse';

  // LLM Configuration
  llmConfig: {
    provider: 'anthropic' | 'openai' | 'groq';
    model: string;           // e.g., 'claude-3-5-sonnet-20241022'
    temperature: number;     // 0-1
    maxTokens: number;
    systemPrompt: string;
    tools?: ToolDefinition[];
  };

  // Context Configuration (for context agents)
  contextConfig?: {
    sources: ContextSource[];
    maxContextTokens: number;
    reranking: boolean;
    retrievalStrategy: 'similarity' | 'hybrid' | 'keyword';
  };

  // Tool Configuration (for tool agents)
  toolConfig?: {
    mcpServer: string;       // e.g., 'supabase', 'obsidian'
    mcpTool: string;         // e.g., 'query', 'write_file'
    adapter: string;         // Class name of adapter
    inputSchema: JSONSchema;
    outputSchema: JSONSchema;
    timeout: number;
  };

  // Orchestration Configuration
  orchestrationConfig?: {
    workflow: WorkflowDefinition;
    subAgents: string[];     // Agent names to orchestrate
    parallelExecution: boolean;
    errorHandling: 'stop' | 'continue' | 'retry';
  };

  // Output Configuration
  deliverableConfig?: {
    generateDeliverable: boolean;
    deliverableType: string; // 'document', 'code', 'report'
    format: 'markdown' | 'html' | 'pdf' | 'json';
    template?: string;
  };

  // Version & Deployment
  version: string;
  status: 'draft' | 'testing' | 'published' | 'archived';
  environment: 'development' | 'staging' | 'production';

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
```

## Database Schema

### 1. Agent Configurations

```sql
-- Main agent configurations (replaces config files)
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  namespace VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL,

  -- Display
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  tags TEXT[],

  -- Configuration (stored as JSONB for flexibility)
  config JSONB NOT NULL,

  -- Version & Status
  current_version_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  environment VARCHAR(50) NOT NULL DEFAULT 'development',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  UNIQUE (name, namespace)
);

CREATE INDEX idx_agent_configs_user ON agent_configs(user_id);
CREATE INDEX idx_agent_configs_namespace ON agent_configs(namespace);
CREATE INDEX idx_agent_configs_status ON agent_configs(status);
CREATE INDEX idx_agent_configs_tags ON agent_configs USING GIN(tags);
```

### 2. Agent Versions

```sql
-- Version history for agent configurations
CREATE TABLE agent_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_config_id UUID NOT NULL,
  version_number VARCHAR(50) NOT NULL, -- e.g., '1.0.0', '1.0.1'

  -- Configuration snapshot
  config JSONB NOT NULL,
  changelog TEXT,

  -- Testing & Validation
  test_results JSONB,
  validation_status VARCHAR(50), -- 'passed', 'failed', 'pending'

  -- Metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (agent_config_id) REFERENCES agent_configs(id) ON DELETE CASCADE,
  UNIQUE (agent_config_id, version_number)
);

CREATE INDEX idx_agent_versions_config ON agent_versions(agent_config_id);
CREATE INDEX idx_agent_versions_created ON agent_versions(created_at DESC);
```

### 3. Agent Templates

```sql
-- Pre-built agent templates
CREATE TABLE agent_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL, -- 'context', 'tool', 'orchestration', 'productivity'

  -- Template configuration
  config JSONB NOT NULL,

  -- Customization points
  customizable_fields TEXT[], -- ['systemPrompt', 'tools', 'sources']
  required_config TEXT[],      -- ['mcpServer', 'namespace']

  -- Metadata
  icon VARCHAR(255),
  tags TEXT[],
  use_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_templates_category ON agent_templates(category);
CREATE INDEX idx_agent_templates_featured ON agent_templates(is_featured);
```

### 4. Agent Deployments

```sql
-- Track agent deployments across environments
CREATE TABLE agent_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_config_id UUID NOT NULL,
  agent_version_id UUID NOT NULL,

  environment VARCHAR(50) NOT NULL, -- 'development', 'staging', 'production'
  status VARCHAR(50) NOT NULL,      -- 'deploying', 'active', 'failed', 'rolled_back'

  -- Deployment config
  deployment_config JSONB,

  -- Health & Metrics
  health_check_url VARCHAR(500),
  last_health_check TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,

  -- Metadata
  deployed_by UUID NOT NULL,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,

  FOREIGN KEY (agent_config_id) REFERENCES agent_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_version_id) REFERENCES agent_versions(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_deployments_config ON agent_deployments(agent_config_id);
CREATE INDEX idx_agent_deployments_env ON agent_deployments(environment);
CREATE INDEX idx_agent_deployments_status ON agent_deployments(status);
```

## 🆕 n8n Agent Builder (AI-Powered Workflow Generation)

### Overview

The **n8n Agent Builder** is a revolutionary feature that takes agent creation to the next level by using **AI + n8n MCP** to automatically:
1. Generate the complete n8n workflow from a natural language prompt
2. Deploy the workflow to your local n8n instance
3. Create the wrapper API agent configuration
4. Set up webhook endpoints and callbacks
5. Test the entire flow end-to-end

**The Magic:** User describes what they want → AI builds it → Ready to use in minutes!

### User Experience Flow

```
User Input (Natural Language Prompt)
  ↓
"Create an agent that monitors Twitter mentions of our brand,
analyzes sentiment, and sends a daily summary email with
trending topics and recommended responses."
  ↓
n8n Agent Builder (AI + MCP)
  ↓
┌─────────────────────────────────────────┐
│ Step 1: AI Analyzes Requirements        │
│ - Identifies: Twitter API, sentiment    │
│   analysis, email sending, scheduling   │
│ - Determines workflow structure         │
│ - Plans node sequence                   │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 2: Generate n8n Workflow (MCP)     │
│ - Webhook trigger for manual invocation │
│ - Twitter search node                   │
│ - Loop through mentions                 │
│ - Sentiment analysis (LLM)              │
│ - Aggregate results                     │
│ - Format email with insights            │
│ - Send email node                       │
│ - Callback to orchestrator-AI           │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 3: Deploy to n8n                   │
│ - Import workflow via n8n API           │
│ - Activate workflow                     │
│ - Get webhook URL                       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 4: Create Wrapper Agent            │
│ - Agent name: twitter-monitor           │
│ - Agent type: api                       │
│ - Webhook URL: from n8n                 │
│ - System prompt: generated              │
│ - Save to database                      │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ Step 5: User Review & Configure         │
│ - Preview workflow in n8n UI            │
│ - Add Twitter API credentials           │
│ - Add email credentials (SendGrid)      │
│ - Test with sample data                 │
│ - Publish agent                         │
└─────────────────────────────────────────┘
  ↓
✅ Working Agent Ready!
```

### Architecture

```
┌─────────────────────────────────────────────────────┐
│         n8n Agent Builder UI (Frontend)              │
│                                                      │
│  1. Natural Language Prompt Input                   │
│     ┌──────────────────────────────────────────┐   │
│     │ "Create an agent that..."                 │   │
│     └──────────────────────────────────────────┘   │
│                                                      │
│  2. AI Configuration (Optional)                     │
│     - Select LLM models for workflow               │
│     - Choose n8n node types to prioritize          │
│     - Set timeout and retry policies               │
│                                                      │
│  3. Preview & Edit Generated Workflow               │
│     - Visual workflow diagram                       │
│     - Edit nodes inline                            │
│     - Add/remove steps                             │
│                                                      │
│  4. Credential Setup Wizard                         │
│     - Detect required credentials                   │
│     - Guide user through n8n credential setup       │
│     - Link to n8n credentials page                 │
│                                                      │
│  5. Test & Deploy                                   │
│     - Test with sample data                         │
│     - View execution results                        │
│     - Deploy to production                          │
└─────────────────────────────────────────────────────┘
          ↓                                    ↓
┌──────────────────────┐          ┌──────────────────────┐
│  AI Service          │          │  n8n API Service     │
│  (with n8n MCP)      │          │                      │
│                      │          │  - Import workflow   │
│  - Parse prompt      │          │  - Activate workflow │
│  - Generate workflow │ ────────→│  - Get webhook URL   │
│  - Create wrapper    │          │  - Test execution    │
│    agent config      │          │                      │
└──────────────────────┘          └──────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│         Agent Builder API (Backend)                  │
│                                                      │
│  N8nAgentBuilderService:                            │
│  - generateFromPrompt(prompt)                       │
│  - deployWorkflow(workflowJson)                     │
│  - createWrapperAgent(workflowId, webhookUrl)      │
│  - testAgent(agentId, sampleInput)                 │
└─────────────────────────────────────────────────────┘
```

### Backend Implementation

#### N8nAgentBuilderService

```typescript
// apps/api/src/agent-builder/services/n8n-agent-builder.service.ts
import { Injectable } from '@nestjs/common';
import { N8nMCPService } from './n8n-mcp.service';
import { N8nApiClient } from './n8n-api-client.service';
import { AgentBuilderService } from './agent-builder.service';

interface GenerateFromPromptResponse {
  workflow: N8nWorkflow;
  agentConfig: Partial<AgentConfig>;
  requiredCredentials: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

@Injectable()
export class N8nAgentBuilderService {
  constructor(
    private readonly n8nMCP: N8nMCPService,
    private readonly n8nApi: N8nApiClient,
    private readonly agentBuilder: AgentBuilderService,
  ) {}

  /**
   * Generate n8n workflow + wrapper agent from natural language prompt
   */
  async generateFromPrompt(prompt: string, options?: {
    userId: string;
    namespace: string;
    preferredModels?: string[];
  }): Promise<GenerateFromPromptResponse> {
    // 1. Use n8n MCP to generate workflow
    const workflowGeneration = await this.n8nMCP.generateWorkflow({
      description: prompt,
      preferences: {
        models: options?.preferredModels || ['claude-3-5-sonnet-20241022'],
        includeErrorHandling: true,
        includeProgressUpdates: true,
        includeLogging: true,
      },
    });

    // 2. Analyze workflow to extract metadata
    const analysis = this.analyzeWorkflow(workflowGeneration.workflow);

    // 3. Generate agent configuration
    const agentConfig: Partial<AgentConfig> = {
      name: this.slugify(analysis.suggestedName),
      displayName: analysis.suggestedName,
      description: analysis.description,
      type: 'api',
      namespace: options?.namespace || 'user-default',
      config: {
        api: {
          webhook_url: '', // Will be filled after deployment
          auth_type: 'bearer',
          auth_token: '${N8N_WEBHOOK_TOKEN}',
          timeout_ms: analysis.estimatedDuration * 1.5, // Add buffer
          supports_progress_updates: analysis.hasProgressUpdates,
        },
        systemPrompt: analysis.generatedSystemPrompt,
      },
      tags: analysis.suggestedTags,
    };

    return {
      workflow: workflowGeneration.workflow,
      agentConfig,
      requiredCredentials: analysis.requiredCredentials,
      estimatedComplexity: analysis.complexity,
    };
  }

  /**
   * Deploy workflow to n8n and create wrapper agent
   */
  async deployAndCreateAgent(
    workflow: N8nWorkflow,
    agentConfig: Partial<AgentConfig>,
    userId: string,
  ): Promise<{
    workflowId: string;
    webhookUrl: string;
    agentId: string;
  }> {
    // 1. Import workflow to n8n
    const importResult = await this.n8nApi.importWorkflow(workflow);

    // 2. Activate workflow
    await this.n8nApi.activateWorkflow(importResult.id);

    // 3. Get webhook URL from workflow
    const webhookUrl = this.extractWebhookUrl(workflow, importResult.id);

    // 4. Update agent config with webhook URL
    const completeAgentConfig = {
      ...agentConfig,
      config: {
        ...agentConfig.config,
        api: {
          ...agentConfig.config.api,
          webhook_url: webhookUrl,
        },
      },
    };

    // 5. Create agent in database
    const agent = await this.agentBuilder.createAgent({
      ...completeAgentConfig,
      userId,
      source: 'n8n_builder',
      metadata: {
        n8n_workflow_id: importResult.id,
        generated_from_prompt: true,
        generation_timestamp: new Date().toISOString(),
      },
    });

    // 6. Export workflow to migration (for version control)
    await this.exportToMigration(workflow, agent.id);

    return {
      workflowId: importResult.id,
      webhookUrl,
      agentId: agent.id,
    };
  }

  /**
   * Test the generated agent with sample input
   */
  async testAgent(agentId: string, sampleInput: string): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Create test conversation
      const conversation = await this.agentBuilder.createTestConversation(agentId);

      // Execute agent
      const result = await this.agentBuilder.testAgent(agentId, {
        message: sampleInput,
        conversationId: conversation.id,
      });

      return {
        success: true,
        result: result.output,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Analyze workflow to extract metadata
   */
  private analyzeWorkflow(workflow: N8nWorkflow): {
    suggestedName: string;
    description: string;
    estimatedDuration: number;
    requiredCredentials: string[];
    hasProgressUpdates: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    generatedSystemPrompt: string;
    suggestedTags: string[];
  } {
    // Analyze nodes to determine characteristics
    const nodeTypes = workflow.nodes.map(n => n.type);
    const hasLLM = nodeTypes.some(t => t.includes('anthropic') || t.includes('openai'));
    const hasHTTP = nodeTypes.some(t => t.includes('httpRequest'));
    const hasLoop = nodeTypes.some(t => t.includes('loop') || t.includes('splitInBatches'));

    // Extract credentials
    const requiredCredentials = [
      ...new Set(
        workflow.nodes
          .filter(n => n.credentials)
          .flatMap(n => Object.keys(n.credentials)),
      ),
    ];

    // Determine complexity
    const complexity =
      workflow.nodes.length > 15 || hasLoop
        ? 'complex'
        : workflow.nodes.length > 8
        ? 'moderate'
        : 'simple';

    // Estimate duration (rough heuristic)
    const estimatedDuration =
      workflow.nodes.length * 1000 + // 1s per node
      (hasLLM ? 10000 : 0) + // 10s for LLM calls
      (hasHTTP ? 5000 : 0) + // 5s for HTTP requests
      (hasLoop ? 15000 : 0); // 15s for loops

    // Check for progress updates
    const hasProgressUpdates = nodeTypes.some(t =>
      workflow.nodes.find(n =>
        n.type === 'n8n-nodes-base.httpRequest' &&
        JSON.stringify(n).includes('/api-progress/'),
      ),
    );

    // Generate system prompt based on workflow
    const generatedSystemPrompt = this.generateSystemPrompt(workflow);

    // Suggest tags
    const suggestedTags = this.generateTags(workflow);

    return {
      suggestedName: workflow.name || 'Generated Agent',
      description: `AI-generated agent: ${workflow.name}`,
      estimatedDuration,
      requiredCredentials,
      hasProgressUpdates,
      complexity,
      generatedSystemPrompt,
      suggestedTags,
    };
  }

  private generateSystemPrompt(workflow: N8nWorkflow): string {
    // Analyze workflow to create appropriate system prompt
    const purpose = `You coordinate a multi-step workflow via n8n.`;
    const capabilities = this.extractCapabilities(workflow);

    return `${purpose}\n\n${capabilities}\n\nAlways provide clear, actionable results.`;
  }

  private generateTags(workflow: N8nWorkflow): string[] {
    const tags = ['n8n', 'api', 'generated'];

    // Add tags based on nodes
    if (workflow.nodes.some(n => n.type.includes('anthropic'))) tags.push('ai', 'llm');
    if (workflow.nodes.some(n => n.type.includes('email'))) tags.push('email');
    if (workflow.nodes.some(n => n.type.includes('twitter'))) tags.push('social-media');
    if (workflow.nodes.some(n => n.type.includes('database'))) tags.push('database');

    return tags;
  }

  private extractWebhookUrl(workflow: N8nWorkflow, workflowId: string): string {
    const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
    if (!webhookNode) {
      throw new Error('Workflow must have a webhook trigger');
    }

    const path = webhookNode.parameters.path || workflowId;
    return `http://localhost:5678/webhook/${path}`;
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  private async exportToMigration(workflow: N8nWorkflow, agentId: string): Promise<void> {
    // Use existing n8n migration scripts to version control
    // This ensures the workflow is backed up in Git
    // (Implementation would call npm run n8n:create-migration)
  }
}
```

#### N8nMCPService (Interface to n8n MCP)

```typescript
// apps/api/src/agent-builder/services/n8n-mcp.service.ts
import { Injectable } from '@nestjs/common';
import { MCPClient } from '@/mcp/mcp-client';

interface WorkflowGenerationRequest {
  description: string;
  preferences?: {
    models?: string[];
    includeErrorHandling?: boolean;
    includeProgressUpdates?: boolean;
    includeLogging?: boolean;
  };
}

@Injectable()
export class N8nMCPService {
  constructor(private readonly mcpClient: MCPClient) {}

  /**
   * Generate n8n workflow using MCP
   */
  async generateWorkflow(request: WorkflowGenerationRequest): Promise<{
    workflow: N8nWorkflow;
    reasoning: string;
  }> {
    // Call n8n MCP service to generate workflow
    const prompt = this.buildPrompt(request);

    const response = await this.mcpClient.callTool('n8n', 'generate_workflow', {
      prompt,
      preferences: request.preferences,
    });

    return {
      workflow: response.workflow,
      reasoning: response.reasoning,
    };
  }

  private buildPrompt(request: WorkflowGenerationRequest): string {
    let prompt = `Create an n8n workflow for the following requirement:\n\n${request.description}\n\n`;

    if (request.preferences?.includeErrorHandling) {
      prompt += `- Include error handling nodes\n`;
    }

    if (request.preferences?.includeProgressUpdates) {
      prompt += `- Add HTTP nodes to send progress updates to http://localhost:7100/api/agent-to-agent/api-progress/:taskId at key milestones\n`;
    }

    if (request.preferences?.includeLogging) {
      prompt += `- Add logging for debugging\n`;
    }

    prompt += `\n- Start with a Webhook trigger node
- End with an HTTP Request node that calls back to http://localhost:7100/api/agent-to-agent/api-callback/:taskId
- Use efficient node arrangements
- Include all necessary nodes for the functionality described`;

    return prompt;
  }
}
```

### Frontend UI Flow

#### Step 1: n8n Agent Builder Wizard

```vue
<!-- apps/web/src/components/N8nAgentBuilder.vue -->
<template>
  <div class="n8n-agent-builder">
    <div class="wizard-steps">
      <Step :active="step === 1" :completed="step > 1">1. Describe</Step>
      <Step :active="step === 2" :completed="step > 2">2. Generate</Step>
      <Step :active="step === 3" :completed="step > 3">3. Configure</Step>
      <Step :active="step === 4" :completed="step > 4">4. Test</Step>
      <Step :active="step === 5">5. Deploy</Step>
    </div>

    <!-- Step 1: Describe Agent -->
    <div v-if="step === 1" class="step-describe">
      <h2>Describe Your Agent</h2>
      <p>Tell us what you want your agent to do in plain English.</p>

      <textarea
        v-model="prompt"
        placeholder="Example: Create an agent that monitors Twitter mentions of our brand, analyzes sentiment, and sends a daily summary email with trending topics..."
        rows="8"
        class="prompt-input"
      />

      <div class="examples">
        <h3>💡 Example Prompts:</h3>
        <button @click="useExample(1)" class="example-btn">
          📧 Email Automation Agent
        </button>
        <button @click="useExample(2)" class="example-btn">
          📊 Data Analysis & Reporting
        </button>
        <button @click="useExample(3)" class="example-btn">
          🔔 Notification & Alert System
        </button>
      </div>

      <div class="advanced-options">
        <details>
          <summary>Advanced Options</summary>
          <label>
            <input type="checkbox" v-model="options.includeProgressUpdates" checked />
            Include real-time progress updates
          </label>
          <label>
            <input type="checkbox" v-model="options.includeErrorHandling" checked />
            Add error handling
          </label>
        </details>
      </div>

      <button @click="generateWorkflow" class="btn-primary" :disabled="!prompt">
        🪄 Generate with AI →
      </button>
    </div>

    <!-- Step 2: Review Generated Workflow -->
    <div v-if="step === 2" class="step-generate">
      <h2>Generated Workflow</h2>

      <div v-if="generating" class="loading">
        <div class="spinner"></div>
        <p>AI is creating your n8n workflow...</p>
        <p class="sub">This may take 10-30 seconds</p>
      </div>

      <div v-else class="workflow-preview">
        <div class="workflow-diagram">
          <!-- Visual representation of workflow -->
          <WorkflowVisualizer :workflow="generatedWorkflow" />
        </div>

        <div class="workflow-details">
          <h3>{{ generatedWorkflow.name }}</h3>
          <p>{{ agentConfig.description }}</p>

          <div class="stats">
            <span>{{ generatedWorkflow.nodes.length }} nodes</span>
            <span>Complexity: {{ analysis.complexity }}</span>
            <span>Est. runtime: {{ analysis.estimatedDuration / 1000 }}s</span>
          </div>

          <div class="required-credentials">
            <h4>Required Credentials:</h4>
            <ul>
              <li v-for="cred in analysis.requiredCredentials" :key="cred">
                {{ cred }}
              </li>
            </ul>
            <p class="hint">You'll add these in n8n after deployment</p>
          </div>
        </div>

        <div class="actions">
          <button @click="step = 1" class="btn-secondary">← Edit Prompt</button>
          <button @click="step = 3" class="btn-primary">Looks Good →</button>
        </div>
      </div>
    </div>

    <!-- Step 3: Configure Agent -->
    <div v-if="step === 3" class="step-configure">
      <h2>Configure Agent Details</h2>

      <form>
        <label>
          Agent Name
          <input v-model="agentConfig.displayName" />
        </label>

        <label>
          Description
          <textarea v-model="agentConfig.description" rows="3" />
        </label>

        <label>
          Tags
          <TagInput v-model="agentConfig.tags" />
        </label>

        <label>
          Timeout (milliseconds)
          <input v-model.number="agentConfig.config.api.timeout_ms" type="number" />
        </label>
      </form>

      <div class="actions">
        <button @click="step = 2" class="btn-secondary">← Back</button>
        <button @click="deployWorkflow" class="btn-primary">
          🚀 Deploy to n8n →
        </button>
      </div>
    </div>

    <!-- Step 4: Credential Setup Guide -->
    <div v-if="step === 4" class="step-credentials">
      <h2>Set Up Credentials in n8n</h2>

      <div class="success-banner">
        ✅ Workflow deployed successfully!
        <a :href="`http://localhost:5678/workflow/${workflowId}`" target="_blank">
          Open in n8n →
        </a>
      </div>

      <div class="credential-guide">
        <p>Your workflow requires the following credentials. Please add them in n8n:</p>

        <div v-for="cred in analysis.requiredCredentials" :key="cred" class="credential-card">
          <h4>{{ cred }}</h4>
          <ol>
            <li>Open n8n in a new tab</li>
            <li>Go to <strong>Credentials</strong> → <strong>Add Credential</strong></li>
            <li>Select <strong>{{ cred }}</strong></li>
            <li>Fill in the required fields</li>
            <li>Click <strong>Save</strong></li>
          </ol>

          <button @click="markCredentialAdded(cred)" class="btn-small">
            ✓ I've added this credential
          </button>
        </div>

        <div class="hint-box">
          💡 <strong>Tip:</strong> You only need to add credentials once. They can be reused across multiple workflows.
        </div>
      </div>

      <div class="actions">
        <button @click="step = 5" :disabled="!allCredentialsAdded" class="btn-primary">
          Continue to Testing →
        </button>
      </div>
    </div>

    <!-- Step 5: Test Agent -->
    <div v-if="step === 5" class="step-test">
      <h2>Test Your Agent</h2>

      <div class="test-interface">
        <label>
          Test Input
          <textarea
            v-model="testInput"
            placeholder="Enter a sample request for your agent..."
            rows="4"
          />
        </label>

        <button @click="runTest" class="btn-primary" :disabled="testing">
          🧪 Run Test
        </button>

        <div v-if="testing" class="testing-status">
          <div class="spinner-small"></div>
          <p>Testing agent... (this may take up to {{ agentConfig.config.api.timeout_ms / 1000 }}s)</p>
        </div>

        <div v-if="testResult" class="test-result">
          <div v-if="testResult.success" class="success">
            <h3>✅ Test Passed!</h3>
            <p>Execution time: {{ testResult.executionTime / 1000 }}s</p>

            <details>
              <summary>View Result</summary>
              <pre>{{ JSON.stringify(testResult.result, null, 2) }}</pre>
            </details>
          </div>

          <div v-else class="error">
            <h3>❌ Test Failed</h3>
            <p>{{ testResult.error }}</p>
            <button @click="step = 4" class="btn-secondary">
              ← Check Credentials
            </button>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="publishAgent" class="btn-success" :disabled="!testResult?.success">
          ✨ Publish Agent
        </button>
      </div>
    </div>
  </div>
</template>
```

### Example Prompts & Generated Workflows

#### Example 1: Social Media Monitor

**User Prompt:**
```
Create an agent that monitors Twitter for mentions of "OpenAI",
analyzes the sentiment of each tweet, aggregates the results,
and sends me a summary email every evening at 6pm with:
- Total mentions count
- Sentiment breakdown (positive/negative/neutral)
- Top 5 most engaging tweets
- Recommended responses for negative mentions
```

**AI Generates:**
- Webhook trigger (for manual testing)
- Twitter search node (search for "OpenAI")
- Loop through tweets
- Sentiment analysis (LLM call per tweet)
- Aggregate results
- Format email with insights
- Send email (SendGrid)
- Progress updates at key milestones
- Callback to orchestrator-AI

**Required Credentials:**
- Twitter API
- SendGrid (or SMTP)
- OpenAI/Anthropic (for sentiment analysis)

#### Example 2: Customer Feedback Analyzer

**User Prompt:**
```
Build an agent that processes customer feedback forms,
extracts key themes using AI, categorizes issues,
identifies urgent problems, and creates support tickets
for high-priority issues while sending a summary report.
```

**AI Generates:**
- Webhook trigger (receives feedback data)
- Parse feedback fields
- LLM call: extract themes and sentiment
- Categorize by urgency (high/medium/low)
- Branch: If urgent → Create support ticket
- Aggregate all feedback
- Generate summary report
- Save report to database
- Callback with results

### Benefits of n8n Agent Builder

1. **🚀 Speed**: Minutes instead of hours/days
2. **🎯 Accuracy**: AI understands n8n node types and best practices
3. **📦 Complete**: Generates workflow + wrapper agent + credentials guide
4. **🧪 Tested**: Built-in testing before deployment
5. **📚 Documented**: AI includes comments and descriptions
6. **🔄 Version Controlled**: Automatic export to Git migrations
7. **♻️ Reusable**: Edit and refine generated workflows
8. **🎓 Educational**: Learn n8n by seeing generated workflows

### Future Enhancements

- **Workflow Templates**: Save generated workflows as reusable templates
- **Multi-Workflow Orchestrations**: Generate multiple connected workflows
- **Smart Credential Detection**: Auto-detect when credentials are added
- **Cost Estimation**: Predict LLM API costs before deployment
- **A/B Testing**: Generate multiple workflow variations
- **Optimization Suggestions**: AI recommends performance improvements

## UI Components

### 1. Template Selector

**Purpose**: Start agent creation from templates or blank slate

**Features**:
- Filterable template gallery (by category, tags)
- Template preview with example conversations
- "Start from scratch" option
- Clone existing agent option
- Import agent from JSON

**UI Flow**:
```
┌─────────────────────────────────────────┐
│         Choose Your Starting Point       │
│                                          │
│  [Featured Templates]                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │Blog      │ │Research  │ │Code      ││
│  │Writer    │ │Assistant │ │Reviewer  ││
│  │⭐⭐⭐⭐⭐  │ │⭐⭐⭐⭐    │ │⭐⭐⭐⭐⭐  ││
│  └──────────┘ └──────────┘ └──────────┘│
│                                          │
│  [By Category]                           │
│  📝 Context Agents (12)                  │
│  🔧 Tool Agents (8)                      │
│  🎭 Orchestration (5)                    │
│                                          │
│  [Other Options]                         │
│  • Start from scratch                    │
│  • Clone existing agent                  │
│  • Import from JSON                      │
└─────────────────────────────────────────┘
```

### 2. Config Editor

**Purpose**: Visual configuration of all agent parameters

**Features**:
- Tabbed interface (Identity, LLM, Context, Tools, Output)
- Real-time validation
- Smart defaults based on agent type
- Inline documentation and examples
- Preview pane showing generated config

**UI Flow**:
```
┌─────────────────────────────────────────────────────┐
│  [Identity] [LLM] [Context] [Tools] [Output]         │
│                                                      │
│  Agent Name:     [finance-manager            ]      │
│  Display Name:   [Finance Manager            ]      │
│  Namespace:      [user-123                   ]      │
│  Description:    [Analyzes financial data... ]      │
│                                                      │
│  Type:  ○ Context  ○ Tool  ⦿ Orchestration          │
│  Mode:  [orchestrate ▼]                             │
│                                                      │
│  Tags:  [finance] [metrics] [orchestration] [+]     │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ 💡 Tip: Orchestration agents coordinate      │   │
│  │    multiple sub-agents to complete complex   │   │
│  │    tasks. Choose sub-agents on the next tab. │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│              [Cancel]  [Next: LLM Config →]         │
└─────────────────────────────────────────────────────┘
```

### 3. Test Studio

**Purpose**: Interactive testing environment

**Features**:
- Split view: config on left, test chat on right
- Live reload on config changes
- Test conversation history
- Performance metrics (latency, token usage)
- Debug panel showing LLM calls, context retrieval, tool invocations

**UI Flow**:
```
┌───────────────────────────────────────────────────────┐
│  Test: Finance Manager v0.1.0           [⚙️ Settings] │
├──────────────────────┬───────────────────────────────┤
│  Config Preview      │  Test Conversation            │
│                      │                               │
│  Name: finance-mgr   │  💬 User                      │
│  Type: orchestration │  Show me Q1 revenue metrics   │
│  Model: claude-3.5   │                               │
│  Mode: orchestrate   │  🤖 Finance Manager           │
│                      │  I'll analyze Q1 revenue...   │
│  Sub-agents:         │  [Calling supabase-query...]  │
│  • supabase-query    │                               │
│  • chart-generator   │  📊 Q1 Revenue: $2.4M         │
│                      │  [Chart showing trend...]     │
│  ✅ Config Valid     │                               │
│                      │  💬 User                      │
│  [Edit Config]       │  Compare to Q4                │
│                      │                               │
│                      │  [Type your message...]       │
├──────────────────────┴───────────────────────────────┤
│  📊 Metrics: 2.3s response │ 1,245 tokens │ 2 tools  │
└───────────────────────────────────────────────────────┘
```

### 4. Version Control

**Purpose**: Manage agent versions, compare changes, rollback

**Features**:
- Visual diff between versions
- Semantic versioning (major.minor.patch)
- Changelog editor
- One-click rollback
- A/B testing support

**UI Flow**:
```
┌─────────────────────────────────────────────────────┐
│  Finance Manager - Version History                   │
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ v1.2.0 (current) - Production     2025-10-04   ││
│  │ ✅ Added chart-generator sub-agent             ││
│  │ [View] [Diff] [Rollback]                       ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ v1.1.0 - Production                2025-09-15   ││
│  │ 🔧 Improved error handling                      ││
│  │ [View] [Diff] [Promote]                        ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  ┌────────────────────────────────────────────────┐│
│  │ v1.0.0 - Production                2025-09-01   ││
│  │ 🎉 Initial release                              ││
│  │ [View] [Diff]                                  ││
│  └────────────────────────────────────────────────┘│
│                                                      │
│  [Create New Version]                               │
└─────────────────────────────────────────────────────┘
```

### 5. Deploy Manager

**Purpose**: Promote agents across environments

**Features**:
- Environment pipeline visualization (dev → staging → prod)
- Deployment approval workflow
- Automated testing gates
- Rollback on failure
- Health monitoring

**UI Flow**:
```
┌─────────────────────────────────────────────────────┐
│  Deploy: Finance Manager v1.2.0                      │
│                                                      │
│  Development        Staging         Production      │
│  ┌─────────┐       ┌─────────┐     ┌─────────┐     │
│  │ v1.2.0  │  ───→ │ v1.1.0  │ ──→ │ v1.1.0  │     │
│  │ ✅ Ready │       │ ✅ Live  │     │ ✅ Live  │     │
│  └─────────┘       └─────────┘     └─────────┘     │
│      ↓                  ↓               ↓           │
│  [Deploy to    ] [Deploy to    ] [Current Version] │
│   Staging]          Production]                     │
│                                                      │
│  Pre-Deploy Checks:                                 │
│  ✅ Config validation passed                        │
│  ✅ Test suite passed (12/12)                       │
│  ✅ Performance benchmarks met                      │
│  ⚠️  Approval required (1/2)                        │
│                                                      │
│  [Request Approval] [Deploy Now] [Cancel]           │
└─────────────────────────────────────────────────────┘
```

### 6. Monitor Dashboard

**Purpose**: Track agent performance and usage

**Features**:
- Real-time metrics (requests, errors, latency)
- Usage analytics (top users, peak times)
- Cost tracking (LLM token usage)
- Alert configuration
- Log viewer with filtering

**UI Flow**:
```
┌─────────────────────────────────────────────────────┐
│  Finance Manager - Analytics (Last 7 Days)           │
│                                                      │
│  📊 Requests: 1,234    ⏱️ Avg Latency: 2.1s         │
│  ❌ Errors: 12 (0.9%)   💰 Cost: $4.23              │
│                                                      │
│  [Request Volume Chart]                             │
│  │                              ╱╲                  │
│  │                      ╱╲     ╱  ╲                │
│  │         ╱╲          ╱  ╲   ╱    ╲               │
│  │        ╱  ╲        ╱    ╲ ╱      ╲              │
│  └────────────────────────────────────────          │
│   Mon Tue Wed Thu Fri Sat Sun                       │
│                                                      │
│  Top Sub-Agents:                                    │
│  1. supabase-query     (847 calls, 2.3s avg)        │
│  2. chart-generator    (234 calls, 1.1s avg)        │
│                                                      │
│  Recent Errors:                                     │
│  • Query timeout (5)                                │
│  • Invalid chart config (4)                         │
│  • Rate limit exceeded (3)                          │
│                                                      │
│  [View Logs] [Configure Alerts] [Export Data]       │
└─────────────────────────────────────────────────────┘
```

## Backend API

### AgentBuilderService

```typescript
@Injectable()
export class AgentBuilderService {
  constructor(
    private readonly configRepo: AgentConfigsRepository,
    private readonly versionsRepo: AgentVersionsRepository,
    private readonly templatesRepo: AgentTemplatesRepository,
    private readonly deploymentsRepo: AgentDeploymentsRepository,
    private readonly testService: AgentTestService
  ) {}

  // Agent CRUD
  async createAgent(dto: CreateAgentDto): Promise<AgentConfig> {
    const config = await this.configRepo.create({
      ...dto,
      status: 'draft',
      environment: 'development'
    });

    // Create initial version
    await this.versionsRepo.create({
      agentConfigId: config.id,
      versionNumber: '0.1.0',
      config: config.config,
      changelog: 'Initial creation'
    });

    return config;
  }

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<AgentConfig> {
    const config = await this.configRepo.findById(id);

    // Create new version on config change
    const currentVersion = await this.versionsRepo.findCurrent(id);
    const newVersionNumber = this.incrementVersion(
      currentVersion.versionNumber,
      dto.versionType // 'major', 'minor', 'patch'
    );

    await this.versionsRepo.create({
      agentConfigId: id,
      versionNumber: newVersionNumber,
      config: dto.config,
      changelog: dto.changelog
    });

    return this.configRepo.update(id, dto);
  }

  // Testing
  async testAgent(id: string, testInput: AgentTestInput): Promise<AgentTestResult> {
    const config = await this.configRepo.findById(id);

    return this.testService.execute({
      agentConfig: config.config,
      userMessage: testInput.message,
      conversationHistory: testInput.history || [],
      enableDebug: true
    });
  }

  // Deployment
  async deployAgent(
    id: string,
    versionId: string,
    environment: string
  ): Promise<AgentDeployment> {
    const config = await this.configRepo.findById(id);
    const version = await this.versionsRepo.findById(versionId);

    // Validation
    await this.validateDeployment(config, version, environment);

    // Create deployment record
    const deployment = await this.deploymentsRepo.create({
      agentConfigId: id,
      agentVersionId: versionId,
      environment,
      status: 'deploying',
      deployedBy: config.userId
    });

    // Deploy to runtime (background job)
    await this.deployToRuntime(config, version, environment);

    return deployment;
  }

  // Templates
  async createFromTemplate(templateId: string, customization: any): Promise<AgentConfig> {
    const template = await this.templatesRepo.findById(templateId);

    const config = {
      ...template.config,
      ...customization, // User overrides
      name: customization.name,
      namespace: customization.namespace
    };

    return this.createAgent({ config });
  }
}
```

### API Routes

```typescript
// POST /api/agent-builder/agents
// Create new agent
{
  name: 'finance-manager',
  namespace: 'user-123',
  displayName: 'Finance Manager',
  description: 'Analyzes financial data',
  type: 'orchestration',
  config: { /* AgentConfig */ }
}

// PUT /api/agent-builder/agents/:id
// Update agent (creates new version)
{
  config: { /* Updated config */ },
  changelog: 'Added chart generation',
  versionType: 'minor' // → v1.2.0
}

// POST /api/agent-builder/agents/:id/test
// Test agent in sandbox
{
  message: 'Show Q1 revenue',
  history: [ /* previous messages */ ]
}

// POST /api/agent-builder/agents/:id/deploy
// Deploy agent version to environment
{
  versionId: 'uuid',
  environment: 'production',
  approvals: ['user-456'] // For production deploys
}

// GET /api/agent-builder/templates
// List available templates

// POST /api/agent-builder/agents/from-template
// Create agent from template
{
  templateId: 'uuid',
  customization: {
    name: 'my-blog-writer',
    namespace: 'user-123',
    systemPrompt: 'Custom prompt...'
  }
}
```

## Pre-Built Templates

### 1. Blog Writer (Context Agent)

```typescript
{
  name: 'blog-writer-template',
  displayName: 'Blog Writer',
  category: 'context',
  description: 'Creates engaging blog posts from research and context',
  config: {
    type: 'context',
    mode: 'build',
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      systemPrompt: 'You are a skilled blog writer...'
    },
    contextConfig: {
      sources: [
        { type: 'conversation', weight: 1.0 },
        { type: 'documents', weight: 0.8 }
      ],
      maxContextTokens: 50000
    },
    deliverableConfig: {
      generateDeliverable: true,
      deliverableType: 'document',
      format: 'markdown'
    }
  },
  customizableFields: ['systemPrompt', 'temperature', 'sources'],
  requiredConfig: ['namespace']
}
```

### 2. Supabase Query Agent (Tool Agent)

```typescript
{
  name: 'supabase-query-template',
  displayName: 'Supabase Query Agent',
  category: 'tool',
  description: 'Executes database queries and returns structured results',
  config: {
    type: 'tool',
    mode: 'tool',
    toolConfig: {
      mcpServer: 'supabase',
      mcpTool: 'query',
      adapter: 'SupabaseMCPAdapter',
      timeout: 30000
    }
  },
  customizableFields: ['timeout', 'allowedTables'],
  requiredConfig: ['mcpServer', 'namespace']
}
```

### 3. Finance Manager (Orchestration)

```typescript
{
  name: 'finance-manager-template',
  displayName: 'Finance Manager',
  category: 'orchestration',
  description: 'Orchestrates financial analysis with metrics and reporting',
  config: {
    type: 'orchestration',
    mode: 'orchestrate',
    llmConfig: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'You are a financial analysis orchestrator...'
    },
    orchestrationConfig: {
      subAgents: ['supabase-query', 'chart-generator'],
      workflow: {
        steps: [
          { agent: 'supabase-query', action: 'getMetrics' },
          { agent: 'chart-generator', action: 'createChart' }
        ]
      }
    }
  },
  customizableFields: ['subAgents', 'workflow'],
  requiredConfig: ['namespace']
}
```

## Success Metrics

### Phase 5 Completion Criteria

1. **UI Components**:
   - [ ] All 6 core components implemented (Template, Config, Test, Version, Deploy, Monitor)
   - [ ] Responsive design works on desktop and tablet
   - [ ] Accessible (WCAG 2.1 AA compliant)

2. **Functionality**:
   - [ ] Can create all agent types (context, tool, orchestration)
   - [ ] Live testing works with instant feedback
   - [ ] Version control with diff view
   - [ ] Deploy pipeline (dev → staging → prod)

3. **Templates**:
   - [ ] At least 5 pre-built templates
   - [ ] Template customization works
   - [ ] Import/export agents as JSON

4. **Testing**:
   - [ ] Non-technical user can create working agent in < 10 minutes
   - [ ] Agent config validation catches all errors
   - [ ] Test studio shows debug info for troubleshooting

## Next Steps After Phase 5

With Agent Builder in place:

1. **Phase 6**: Use Agent Builder to create Finance Manager orchestration example
2. **Phase 7**: Build complex multi-agent workflows through UI
3. **Future**: Agent marketplace where users share/sell agent templates

## Open Questions

1. Should we support visual workflow builders (drag-and-drop nodes)?
2. How do we handle agent permissions (who can edit/deploy)?
3. Should we version control system prompts separately?
4. Do we need a staging environment preview URL?
5. How do we handle secrets/API keys in agent configs?
