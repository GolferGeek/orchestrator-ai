# Orchestrator Agent Rules

This document defines the standards, patterns, and implementation guidelines for creating orchestrator agents in the OrchestratorAI system. Orchestrator agents are coordination agents that manage teams of specialist agents, plan complex projects, and execute multi-step workflows through intelligent delegation.

## Table of Contents

1. [Agent Definition & Types](#agent-definition--types)
2. [File Structure](#file-structure)
3. [Agent Configuration Schema](#agent-configuration-schema)
4. [Orchestration Patterns](#orchestration-patterns)
5. [Implementation Examples](#implementation-examples)
6. [Delegation & Team Management](#delegation--team-management)
7. [Testing Requirements](#testing-requirements)

---

## Agent Definition & Types

### What is an Orchestrator Agent?

An orchestrator agent is a specialized AI agent that coordinates teams of specialist agents to execute complex, multi-step projects. Unlike function or API agents that perform specific tasks, orchestrator agents focus on project planning, team coordination, and intelligent delegation to achieve larger business objectives.

### Orchestrator Agent Characteristics

- **Team Management**: Coordinates and delegates to teams of specialist agents
- **Project Planning**: Creates comprehensive project plans with timelines and deliverables
- **Intelligent Delegation**: Routes tasks to appropriate specialist agents based on context
- **Workflow Coordination**: Manages multi-step processes and dependencies
- **Progress Tracking**: Monitors project progress and adjusts plans as needed
- **Strategic Thinking**: Focuses on high-level objectives and business outcomes
- **A2A Compliance**: Maintains conversation + tasks paradigm while adding project capabilities

### Orchestrator Hierarchy Levels

1. **Executive Orchestrators**: Strategic decision-making, cross-departmental coordination
2. **Manager Orchestrators**: Departmental management, team coordination, project oversight
3. **Specialist Orchestrators**: Domain-specific coordination, technical project management

---

## File Structure

### Standard Directory Layout

```
apps/api/src/agents/demo/{department}/{agent_name}/
├── agent.config.yaml           # Agent configuration (generates .well-known/agent.json)
├── agent-service.ts            # Minimal orchestrator service implementation
├── agent.module.ts             # NestJS module with orchestrator dependencies
├── delegation.context.md       # Team and delegation context
├── context.md                  # Optional knowledge base
└── README.md                   # Agent documentation
```

### Required Files

- **`agent.config.yaml`** - Agent configuration and metadata (automatically generates `.well-known/agent.json` via A2A protocol)
- **`agent-service.ts`** - Minimal orchestrator service implementation
- **`agent.module.ts`** - NestJS module with orchestrator dependencies

### Optional Files

- **`delegation.context.md`** - Team and delegation context for specialist coordination
- **`context.md`** - Knowledge base content

---

## Agent Configuration Schema

### Complete Configuration Schema

```yaml
# Orchestrator Agent Configuration
name: agent_name
type: orchestrator
displayName: "Human Readable Name"
description: "Strategic orchestrator description with team management and project coordination capabilities."

# Hierarchy Configuration
hierarchy:
  level: manager|executive|specialist
  reportsTo: parent_orchestrator
  team:
    - specialist_agent_1
    - specialist_agent_2
    - specialist_agent_3

# Orchestrator-specific configuration
orchestrator:
  scope: department|cross_departmental|strategic
  authority_level: manager|executive|specialist
  delegation_depth: specialist|team|department
  project_complexity: departmental|enterprise|strategic

# Capabilities
capabilities:
  - strategic_planning
  - team_coordination
  - project_management
  - resource_allocation
  - performance_monitoring
  - cross_functional_integration

# LLM Configuration
llm:
  provider: anthropic|openai|google
  model: claude-3-5-sonnet-20241022|gpt-4|gemini-pro
  temperature: 0.4
  max_tokens: 1500
  system_prompt: |
    You are the [Role] Orchestrator, the strategic coordinator for [domain] initiatives. Your role is to:

    1. **Strategic Planning**: Plan and coordinate [domain] initiatives that align with business objectives
    2. **Team Coordination**: Manage [domain] specialist agents to execute cohesive projects
    3. **Project Management**: Orchestrate complex workflows with clear timelines and deliverables
    4. **Performance Oversight**: Monitor project performance and optimize strategies

    ## Your Orchestration Style:
    - Think strategically about [domain] objectives and business impact
    - Coordinate multiple specialists for integrated solutions
    - Focus on measurable outcomes: [specific metrics]
    - Balance creativity with data-driven decision making
    - Maintain consistency across all [domain] touchpoints

    ## Your Team (Direct Reports):
    - **Agent 1**: [Description of specialist role]
    - **Agent 2**: [Description of specialist role]
    - **Agent 3**: [Description of specialist role]

    ## When Planning Projects:
    - Define clear objectives and success metrics
    - Identify required specialists and resources
    - Plan timeline and milestone schedule
    - Coordinate across multiple workstreams
    - Set up tracking and analytics for performance measurement
    - Consider dependencies and risk mitigation

    ## When Delegating to Specialists:
    - Provide clear brief with objectives and context
    - Set specific deliverables, formats, and deadlines
    - Include requirements and success criteria
    - Specify review and approval processes
    - Define success metrics and evaluation criteria

    ## Reporting to [Parent]:
    - Focus on business impact and ROI of initiatives
    - Provide strategic recommendations based on insights
    - Escalate resource needs and strategic decisions
    - Report on project performance and trends
    - Request support for cross-departmental initiatives

    You report directly to the [Parent] Orchestrator and are responsible for all [domain] operations. Always think about how [domain] initiatives support overall business strategy and growth objectives.

# Agent Module Configuration
module:
  imports:
    - BaseSubServicesModule
    - OrchestratorModule
  providers:
    - AgentNameOrchestratorService
  exports:
    - AgentNameOrchestratorService
```

---

## Orchestration Patterns

### 1. Conversation + Tasks Paradigm

Orchestrator agents maintain the proven conversation + tasks pattern while adding project capabilities:

```typescript
// A2A Entry Point - Single method that routes all orchestrator operations
public async executeTask(method: string, params: any): Promise<any> {
  try {
    // Determine effective orchestrator method based on params.mode and context
    const requestedMode = (params && params.mode) as 'converse' | 'plan' | 'build' | undefined;
    let effectiveMethod: OrchestratorA2AMethod;
    
    if (requestedMode === 'converse' || !requestedMode) {
      effectiveMethod = 'converse';
    } else if (requestedMode === 'plan') {
      effectiveMethod = 'explicit_create_project';
    } else if (requestedMode === 'build') {
      effectiveMethod = params?.projectId ? 'approve_project_plan' : 'converse';
    } else {
      effectiveMethod = 'converse';
    }

    // Adapt A2A request to OrchestratorInput (conversation + tasks pattern)
    const input = await this.adaptA2AToOrchestratorInput(effectiveMethod, params);

    // Route through facade service (maintains single entry point principle)
    const response = await this.orchestratorFacadeService.processRequest(
      effectiveMethod,
      input,
      this.delegationContext,
    );

    return response;
  } catch (error) {
    // Error handling...
  }
}
```

### 2. Project Planning Pattern

```typescript
// Project creation and planning workflow
async createProject(input: OrchestratorInput): Promise<Project> {
  // Step 1: Analyze requirements and scope
  const analysis = await this.analyzeProjectRequirements(input);
  
  // Step 2: Identify required specialists
  const specialists = await this.identifyRequiredSpecialists(analysis);
  
  // Step 3: Create project plan with timeline
  const plan = await this.createProjectPlan(analysis, specialists);
  
  // Step 4: Define deliverables and milestones
  const deliverables = await this.defineDeliverables(plan);
  
  // Step 5: Set up tracking and monitoring
  const tracking = await this.setupProjectTracking(plan);
  
  return {
    id: generateProjectId(),
    name: analysis.projectName,
    description: analysis.description,
    plan,
    specialists,
    deliverables,
    tracking,
    status: 'planned',
    createdAt: new Date(),
  };
}
```

### 3. Intelligent Delegation Pattern

```typescript
// Delegate task to specialist agent
async delegateToAgent(
  agentName: string,
  prompt: string,
  input: OrchestratorInput,
): Promise<OrchestratorResponse> {
  try {
    // Step 1: Discover and validate target agent
    const targetAgent = await this.discoverTargetAgent(agentName);
    if (!targetAgent) {
      throw new DelegationError(`Agent '${agentName}' not found in agent pool`);
    }

    // Step 2: Create agent instance
    const agentInstance = await this.createAgentInstance(targetAgent, input);

    // Step 3: Prepare A2A task payload
    const taskPayload = this.createA2ATaskPayload(prompt, input, targetAgent);

    // Step 4: Execute delegation via A2A protocol
    const delegationResult = await this.executeA2ADelegation(
      agentInstance,
      taskPayload,
    );

    // Step 5: Process and return orchestrator response
    const orchestratorResponse = this.processDelegationResult(
      delegationResult,
      agentName,
      input,
    );

    return orchestratorResponse;
  } catch (error) {
    throw new DelegationError(`Delegation failed: ${error.message}`, agentName);
  }
}
```

### 4. Team Coordination Pattern

```typescript
// Coordinate multiple specialists for complex projects
async coordinateTeam(
  project: Project,
  input: OrchestratorInput,
): Promise<OrchestratorResponse> {
  const coordinationResults = [];
  
  for (const specialist of project.specialists) {
    try {
      // Create specialized prompt for each agent
      const specialistPrompt = this.createSpecialistPrompt(
        specialist,
        project,
        input,
      );
      
      // Delegate to specialist
      const result = await this.delegateToAgent(
        specialist.name,
        specialistPrompt,
        input,
      );
      
      coordinationResults.push({
        specialist: specialist.name,
        result,
        status: 'completed',
      });
    } catch (error) {
      coordinationResults.push({
        specialist: specialist.name,
        error: error.message,
        status: 'failed',
      });
    }
  }
  
  // Synthesize results from all specialists
  const synthesizedResponse = await this.synthesizeTeamResults(
    coordinationResults,
    project,
  );
  
  return synthesizedResponse;
}
```

---

## Implementation Examples

### Example 1: Marketing Manager Orchestrator

**File: `apps/api/src/agents/demo/marketing/marketing_manager_orchestrator/agent.config.yaml`**
```yaml
name: marketing_manager_orchestrator
type: orchestrator
displayName: "Marketing Manager"
description: "Strategic marketing orchestrator for coordinating campaigns, content, and brand initiatives. Reports to CEO and manages all marketing specialist agents with sophisticated project planning and execution capabilities."

# Hierarchy Configuration
hierarchy:
  level: manager
  reportsTo: ceo_orchestrator
  team:
    - marketing_swarm
    - blog_post
    - content
    - market_research
    - competitors
    - hiverarchy

# Orchestrator-specific configuration
orchestrator:
  scope: marketing
  authority_level: manager
  delegation_depth: specialist
  project_complexity: departmental

# Capabilities
capabilities:
  - marketing_strategy
  - campaign_planning
  - content_coordination
  - brand_management
  - customer_engagement
  - market_research
  - performance_analytics
  - cross_channel_integration

# LLM Configuration
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.4
  max_tokens: 1500
  system_prompt: |
    You are the Marketing Manager Orchestrator, the strategic coordinator for all marketing initiatives. Your role is to:

    1. **Marketing Strategy**: Plan and coordinate marketing campaigns that align with business objectives
    2. **Team Coordination**: Manage marketing specialist agents to execute cohesive campaigns
    3. **Content Planning**: Orchestrate content creation across blogs, social media, and marketing materials
    4. **Campaign Management**: Plan multi-channel marketing initiatives with clear timelines and deliverables
    5. **Performance Oversight**: Monitor campaign performance and optimize strategies

    ## Your Orchestration Style:
    - Think strategically about marketing objectives and customer journey
    - Coordinate multiple marketing specialists for integrated campaigns
    - Focus on measurable outcomes: leads, engagement, conversions, brand awareness
    - Balance creativity with data-driven decision making
    - Maintain brand consistency across all marketing touchpoints

    ## Your Team (Direct Reports):
    - **Marketing Swarm**: Multi-agent collaboration for complex campaigns
    - **Blog Post**: Long-form content and thought leadership specialist
    - **Content**: Marketing copy, web content, and promotional materials specialist
    - **Market Research**: Market research and customer insights specialist
    - **Competitors**: Competitive analysis and market positioning specialist

    ## When Planning Marketing Projects:
    - Define clear campaign objectives and success metrics
    - Identify target audience and customer segments
    - Plan content calendar and publication schedule
    - Coordinate across multiple channels (email, social, web, paid)
    - Set up tracking and analytics for performance measurement
    - Consider brand guidelines and messaging consistency

    ## When Delegating to Specialists:
    - Provide clear brief with objectives, audience, and key messages
    - Set specific deliverables, formats, and deadlines
    - Include brand guidelines and style requirements
    - Specify distribution channels and publication schedules
    - Define success metrics and review criteria

    ## Reporting to CEO:
    - Focus on business impact and ROI of marketing initiatives
    - Provide strategic recommendations based on market insights
    - Escalate resource needs and strategic decisions
    - Report on campaign performance and market trends
    - Request support for cross-departmental initiatives

    You report directly to the CEO Orchestrator and are responsible for all marketing operations. Always think about how marketing initiatives support overall business strategy and growth objectives.

# Agent Module Configuration
module:
  imports:
    - BaseSubServicesModule
    - OrchestratorModule
  providers:
    - MarketingManagerOrchestratorService
  exports:
    - MarketingManagerOrchestratorService
```

**File: `apps/api/src/agents/demo/marketing/marketing_manager_orchestrator/agent-service.ts`**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OrchestratorAgentBaseService } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-base.service';
import { OrchestratorAgentServicesContext } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services.context';

/**
 * Marketing Manager Orchestrator Service
 *
 * Minimal orchestrator service - all functionality is in the base class.
 * This service only defines the agent name and passes services up.
 */
@Injectable()
export class MarketingManagerOrchestratorService extends OrchestratorAgentBaseService {
  protected readonly logger = new Logger(
    MarketingManagerOrchestratorService.name,
  );

  constructor(services: OrchestratorAgentServicesContext) {
    super(services);
  }

  /**
   * Get agent identification
   */
  getAgentName(): string {
    return 'marketing_manager_orchestrator';
  }

  // All other functionality is implemented in OrchestratorAgentBaseService
}
```

**File: `apps/api/src/agents/demo/marketing/marketing_manager_orchestrator/agent.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { MarketingManagerOrchestratorService } from './agent-service';

/**
 * Marketing Manager Orchestrator Module
 *
 * Provides the Marketing Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for marketing campaign planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [MarketingManagerOrchestratorService],
  exports: [MarketingManagerOrchestratorService],
})
export class MarketingManagerOrchestratorModule {}
```

### Example 2: Engineering Manager Orchestrator

**File: `apps/api/src/agents/demo/engineering/engineering_manager_orchestrator/agent.config.yaml`**
```yaml
name: engineering_manager_orchestrator
type: orchestrator
displayName: "Engineering Manager"
description: "Strategic engineering orchestrator for coordinating development projects, technical initiatives, and engineering team management. Reports to CTO and manages all engineering specialist agents."

# Hierarchy Configuration
hierarchy:
  level: manager
  reportsTo: cto_orchestrator
  team:
    - requirements_writer
    - code_reviewer
    - testing_specialist
    - architecture_consultant
    - devops_engineer

# Orchestrator-specific configuration
orchestrator:
  scope: engineering
  authority_level: manager
  delegation_depth: specialist
  project_complexity: departmental

# Capabilities
capabilities:
  - technical_strategy
  - project_planning
  - team_coordination
  - code_quality_oversight
  - architecture_guidance
  - performance_monitoring
  - resource_allocation
  - cross_team_integration

# LLM Configuration
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.3
  max_tokens: 2000
  system_prompt: |
    You are the Engineering Manager Orchestrator, the strategic coordinator for all engineering initiatives. Your role is to:

    1. **Technical Strategy**: Plan and coordinate engineering projects that align with business objectives
    2. **Team Coordination**: Manage engineering specialist agents to execute cohesive development projects
    3. **Project Management**: Orchestrate complex technical workflows with clear timelines and deliverables
    4. **Quality Oversight**: Monitor code quality, architecture decisions, and technical standards
    5. **Performance Monitoring**: Track engineering metrics and optimize development processes

    ## Your Orchestration Style:
    - Think strategically about technical architecture and scalability
    - Coordinate multiple engineering specialists for integrated solutions
    - Focus on measurable outcomes: code quality, delivery speed, system reliability
    - Balance technical excellence with business delivery requirements
    - Maintain technical standards and best practices across all projects

    ## Your Team (Direct Reports):
    - **Requirements Writer**: Technical specification and documentation specialist
    - **Code Reviewer**: Code quality and best practices specialist
    - **Testing Specialist**: Test strategy and quality assurance specialist
    - **Architecture Consultant**: System design and technical architecture specialist
    - **DevOps Engineer**: Infrastructure and deployment specialist

    ## When Planning Engineering Projects:
    - Define clear technical objectives and success metrics
    - Identify required specialists and technical resources
    - Plan development timeline and milestone schedule
    - Coordinate across multiple technical workstreams
    - Set up tracking and analytics for performance measurement
    - Consider technical dependencies and risk mitigation

    ## When Delegating to Specialists:
    - Provide clear technical brief with objectives and context
    - Set specific deliverables, formats, and deadlines
    - Include technical requirements and success criteria
    - Specify review and approval processes
    - Define success metrics and evaluation criteria

    ## Reporting to CTO:
    - Focus on technical impact and engineering efficiency
    - Provide strategic recommendations based on technical insights
    - Escalate resource needs and technical decisions
    - Report on project performance and technical trends
    - Request support for cross-departmental technical initiatives

    You report directly to the CTO Orchestrator and are responsible for all engineering operations. Always think about how engineering initiatives support overall business strategy and technical excellence.

# Agent Module Configuration
module:
  imports:
    - BaseSubServicesModule
    - OrchestratorModule
  providers:
    - EngineeringManagerOrchestratorService
  exports:
    - EngineeringManagerOrchestratorService
```

---

## Delegation & Team Management

### 1. Agent Discovery and Validation

```typescript
// Discover and validate target agent
private async discoverTargetAgent(agentName: string): Promise<DiscoveredAgent | null> {
  try {
    const availableAgents = await this.agentDiscoveryService.getAvailableAgents();
    const targetAgent = availableAgents.find(agent => 
      agent.name === agentName || 
      agent.metadata?.displayName === agentName
    );
    
    if (!targetAgent) {
      this.logger.warn(`Agent '${agentName}' not found in available agents`);
      return null;
    }
    
    // Validate agent is in our team
    if (!this.isAgentInTeam(targetAgent)) {
      this.logger.warn(`Agent '${agentName}' is not in our team hierarchy`);
      return null;
    }
    
    return targetAgent;
  } catch (error) {
    this.logger.error(`Failed to discover agent '${agentName}':`, error);
    return null;
  }
}
```

### 2. Team Hierarchy Management

```typescript
// Check if agent is in our team hierarchy
private isAgentInTeam(agent: DiscoveredAgent): boolean {
  const teamAgents = this.delegationContext?.team || [];
  return teamAgents.includes(agent.name) || 
         teamAgents.includes(agent.metadata?.displayName);
}

// Get team context for delegation
private getTeamContext(): TeamContext {
  return {
    orchestrator: this.getAgentName(),
    team: this.delegationContext?.team || [],
    hierarchy: this.delegationContext?.hierarchy || {},
    capabilities: this.delegationContext?.capabilities || [],
  };
}
```

### 3. Intelligent Task Routing

```typescript
// Route task to appropriate specialist based on context
private async routeTaskToSpecialist(
  task: Task,
  context: OrchestratorInput,
): Promise<string> {
  const analysis = await this.analyzeTaskRequirements(task);
  const availableSpecialists = await this.getAvailableSpecialists();
  
  // Score each specialist based on task requirements
  const specialistScores = availableSpecialists.map(specialist => ({
    name: specialist.name,
    score: this.calculateSpecialistScore(specialist, analysis),
    capabilities: specialist.capabilities,
  }));
  
  // Sort by score and return best match
  specialistScores.sort((a, b) => b.score - a.score);
  
  if (specialistScores.length === 0 || specialistScores[0].score < 0.5) {
    throw new Error('No suitable specialist found for this task');
  }
  
  return specialistScores[0].name;
}

// Calculate specialist suitability score
private calculateSpecialistScore(
  specialist: DiscoveredAgent,
  analysis: TaskAnalysis,
): number {
  let score = 0;
  
  // Match capabilities
  const capabilityMatches = analysis.requiredCapabilities.filter(cap =>
    specialist.capabilities?.includes(cap)
  );
  score += (capabilityMatches.length / analysis.requiredCapabilities.length) * 0.6;
  
  // Match skills
  const skillMatches = analysis.requiredSkills.filter(skill =>
    specialist.skills?.some(s => s.name === skill)
  );
  score += (skillMatches.length / analysis.requiredSkills.length) * 0.4;
  
  return score;
}
```

---

## Testing Requirements

### 1. Unit Tests

```typescript
// orchestrator-agent.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingManagerOrchestratorService } from './agent-service';
import { OrchestratorAgentServicesContext } from './orchestrator-agent-services.context';

describe('Marketing Manager Orchestrator', () => {
  let service: MarketingManagerOrchestratorService;
  let mockServices: OrchestratorAgentServicesContext;

  beforeEach(() => {
    mockServices = {
      orchestratorFacadeService: {
        processRequest: vi.fn(),
      },
      agentDiscoveryService: {
        getAvailableAgents: vi.fn(),
      },
    } as any;

    service = new MarketingManagerOrchestratorService(mockServices);
  });

  it('should delegate to marketing specialists correctly', async () => {
    const mockInput = {
      userMessage: 'Create a marketing campaign for our new product',
      sessionId: 'test-session',
      mode: 'plan',
    };

    const mockResponse = {
      success: true,
      response: 'Marketing campaign plan created',
      metadata: {
        projectId: 'proj-123',
        specialists: ['blog_post', 'content', 'market_research'],
      },
    };

    mockServices.orchestratorFacadeService.processRequest.mockResolvedValue(mockResponse);

    const result = await service.executeTask('converse', mockInput);

    expect(result.success).toBe(true);
    expect(result.response).toBe('Marketing campaign plan created');
    expect(mockServices.orchestratorFacadeService.processRequest).toHaveBeenCalledWith(
      'explicit_create_project',
      expect.objectContaining({
        userMessage: 'Create a marketing campaign for our new product',
        sessionId: 'test-session',
      }),
      expect.any(Object)
    );
  });

  it('should handle delegation errors gracefully', async () => {
    const mockInput = {
      userMessage: 'Create a marketing campaign',
      sessionId: 'test-session',
    };

    mockServices.orchestratorFacadeService.processRequest.mockRejectedValue(
      new Error('Delegation failed')
    );

    const result = await service.executeTask('converse', mockInput);

    expect(result.success).toBe(false);
    expect(result.response).toContain('error');
  });

  it('should identify correct specialists for marketing tasks', async () => {
    const mockAgents = [
      { name: 'blog_post', capabilities: ['content_creation', 'blog_writing'] },
      { name: 'content', capabilities: ['marketing_copy', 'web_content'] },
      { name: 'market_research', capabilities: ['market_analysis', 'customer_insights'] },
    ];

    mockServices.agentDiscoveryService.getAvailableAgents.mockResolvedValue(mockAgents);

    const specialists = await service.getAvailableSpecialists();

    expect(specialists).toHaveLength(3);
    expect(specialists.map(s => s.name)).toEqual(['blog_post', 'content', 'market_research']);
  });
});
```

### 2. Integration Tests

```typescript
// orchestrator-agent.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Marketing Manager Orchestrator (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/orchestrator/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/orchestrator/execute')
      .send({
        userMessage: 'Create a comprehensive marketing campaign for our new product launch',
        sessionId: 'test-session',
        mode: 'plan',
        agentName: 'marketing_manager_orchestrator',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.response).toBeDefined();
        expect(res.body.metadata.projectId).toBeDefined();
        expect(res.body.metadata.specialists).toBeInstanceOf(Array);
      });
  });

  it('should handle team coordination requests', () => {
    return request(app.getHttpServer())
      .post('/agents/orchestrator/execute')
      .send({
        userMessage: 'Coordinate our marketing team to create content for the Q4 campaign',
        sessionId: 'test-session',
        mode: 'build',
        projectId: 'proj-123',
        agentName: 'marketing_manager_orchestrator',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.response).toContain('team coordination');
      });
  });
});
```

### 3. Performance Tests

```typescript
// orchestrator-agent.performance.spec.ts
import { performance } from 'perf_hooks';

describe('Orchestrator Agent Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const startTime = performance.now();
    
    const result = await executeOrchestratorAgent({
      userMessage: 'Create a marketing campaign plan',
      sessionId: 'test-session',
      mode: 'plan',
      agentName: 'marketing_manager_orchestrator',
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(15000); // 15 seconds max for complex orchestration
    expect(result.success).toBe(true);
  });

  it('should handle concurrent orchestration requests efficiently', async () => {
    const concurrentRequests = 5;
    const startTime = performance.now();
    
    const promises = Array(concurrentRequests).fill(null).map(() =>
      executeOrchestratorAgent({
        userMessage: 'Create a project plan',
        sessionId: 'test-session',
        mode: 'plan',
        agentName: 'marketing_manager_orchestrator',
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrentRequests);
    expect(results.every(r => r.success)).toBe(true);
    expect(totalTime).toBeLessThan(30000); // 30 seconds max for all requests
  });
});
```

---

## Best Practices

### 1. Orchestration Design

- **Single Entry Point**: Maintain A2A compliance with single `executeTask()` method
- **Conversation + Tasks**: Preserve the proven conversation + tasks paradigm
- **Project Capabilities**: Add project planning and coordination on top of existing patterns
- **Team Hierarchy**: Define clear team structures and reporting relationships
- **Delegation Intelligence**: Implement smart routing based on agent capabilities

### 2. Team Management

- **Agent Discovery**: Use robust agent discovery and validation
- **Capability Matching**: Route tasks based on specialist capabilities and skills
- **Team Context**: Maintain team hierarchy and delegation context
- **Error Handling**: Gracefully handle delegation failures and agent unavailability
- **Progress Tracking**: Monitor team performance and project progress

### 3. Project Coordination

- **Clear Objectives**: Define specific, measurable project objectives
- **Timeline Management**: Create realistic timelines with milestones
- **Resource Allocation**: Allocate specialists and resources efficiently
- **Dependency Management**: Handle task dependencies and sequencing
- **Risk Mitigation**: Identify and mitigate project risks

### 4. Performance Optimization

- **Async Operations**: Use async/await for non-blocking operations
- **Caching**: Cache agent discovery and capability information
- **Connection Pooling**: Reuse HTTP connections for delegation
- **Batch Operations**: Batch multiple delegations when possible
- **Monitoring**: Track orchestration performance and bottlenecks

### 5. Security Considerations

- **Agent Validation**: Validate all agent interactions and delegations
- **Access Control**: Implement proper access control for team management
- **Input Sanitization**: Sanitize all inputs before delegation
- **Error Information**: Don't expose sensitive information in error messages
- **Audit Logging**: Log all orchestration activities for security auditing

---

This comprehensive guide provides the foundation for creating, implementing, and maintaining orchestrator agents in the OrchestratorAI system. Follow these patterns and examples to ensure effective team coordination, project management, and intelligent delegation across your agent ecosystem.
