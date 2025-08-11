import { Injectable, Logger } from '@nestjs/common';
import {
  IPlanningService,
  OrchestratorInput,
  PlanDefinition,
  PlanStep,
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';

/**
 * Enhanced Planning Service - Enterprise workforce development planning
 *
 * Manages iterative, collaborative planning with LLM calls including:
 * - Subproject decomposition for cross-departmental workflows
 * - Human assignment during planning phase
 * - Enterprise timeline planning (days/weeks scale)
 * - Agent capability assessment and gap detection
 * - Workforce development planning integration
 */
@Injectable()
export class PlanningService implements IPlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly agentDiscoveryService: AgentDiscoveryService,
  ) {}

  /**
   * Create enterprise project plan through iterative LLM conversations
   *
   * Enhanced "Plan" phase in "Plan-Approve-Act" with enterprise capabilities:
   * 1. Analyze user goal and detect enterprise requirements
   * 2. Assess current agent capabilities and identify gaps
   * 3. Decompose complex requests into subprojects when needed
   * 4. Assign human experts for oversight and approval steps
   * 5. Plan enterprise timelines (days/weeks, not minutes)
   * 6. Generate workforce development steps when capabilities are missing
   * 7. Return structured PlanDefinition with full enterprise context
   */
  async createPlan(input: OrchestratorInput): Promise<PlanDefinition> {
    this.logger.log(
      `Creating plan for goal: "${input.prompt.substring(0, 100)}..."`,
    );

    try {
      // Step 1: Analyze the goal and detect enterprise requirements
      const goalAnalysis = await this.analyzeEnterpriseGoalRequirements(input);

      // Step 2: Assess current agent capabilities and identify gaps
      const capabilityAssessment = await this.assessAgentCapabilities(
        goalAnalysis,
        input,
      );

      // Step 3: Check if request requires subproject decomposition
      const subprojectAnalysis = await this.analyzeSubprojectNeeds(
        goalAnalysis,
        input,
      );

      // Step 4: Generate structured plan with enterprise features
      const planStructure = await this.generateEnterprisePlanStructure(
        input,
        goalAnalysis,
        capabilityAssessment,
        subprojectAnalysis,
      );

      // Step 5: Add human assignments and enterprise timeline planning
      const planWithHumans = await this.addHumanAssignments(
        planStructure,
        goalAnalysis,
      );

      // Step 6: Validate, optimize, and finalize enterprise plan
      const finalPlan = await this.validateAndOptimizeEnterprisePlan(
        planWithHumans,
        input,
      );

      this.logger.log(
        `🏢 Generated enterprise plan "${finalPlan.projectName}" with ${finalPlan.steps.length} steps, ${this.countSubprojectSteps(finalPlan)} subprojects, ${this.countHumanAssignments(finalPlan)} human assignments`,
      );
      return finalPlan;
    } catch (error) {
      this.logger.error('Plan creation failed:', error);
      throw new Error(
        `Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Refine existing plan based on user feedback
   *
   * Continues the collaborative planning conversation with iterative improvements.
   */
  async refinePlan(
    planId: string,
    feedback: string,
    input: OrchestratorInput,
    originalPlan?: PlanDefinition,
  ): Promise<PlanDefinition> {
    this.logger.log(
      `Refining plan ${planId} with feedback: "${feedback.substring(0, 100)}..."`,
    );

    try {
      // For testing, use the original plan if provided
      // In production, this would load from database using planId
      if (!originalPlan) {
        // Create a basic plan as fallback (for when no original plan is available)
        const goalAnalysis = await this.analyzeGoalRequirements(input);
        const availableAgents = await this.getAvailableAgents();
        originalPlan = await this.generatePlanStructure(
          input,
          goalAnalysis,
          availableAgents,
        );
      }

      // Get available agents
      const availableAgents = await this.getAvailableAgents();

      // Incorporate feedback into existing plan
      const refinedPlan = await this.incorporateFeedback(
        feedback,
        input,
        availableAgents,
        originalPlan,
      );

      this.logger.log(
        `Refined plan with ${refinedPlan.steps.length} steps (was ${originalPlan.steps.length}) based on feedback`,
      );
      return refinedPlan;
    } catch (error) {
      this.logger.error('Plan refinement failed:', error);
      throw new Error(
        `Failed to refine plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Format plan for human review
   *
   * Converts structured PlanDefinition to human-readable format for approval.
   */
  async formatPlanForHuman(plan: PlanDefinition): Promise<string> {
    this.logger.log(`Formatting plan for human review: ${plan.projectName}`);

    try {
      // Use LLM to generate natural language plan description
      const formatted = await this.generateHumanReadablePlan(plan);
      return formatted;
    } catch (error) {
      this.logger.error('Plan formatting failed:', error);

      // Fallback to basic formatting if LLM fails
      return this.generateBasicPlanFormat(plan);
    }
  }

  // ============================================================================
  // ENTERPRISE PLANNING METHODS - Enhanced planning with workforce development
  // ============================================================================

  /**
   * Step 1: Analyze goal with enterprise requirements detection
   */
  private async analyzeEnterpriseGoalRequirements(
    input: OrchestratorInput,
  ): Promise<{
    projectName: string;
    description: string;
    scope: string;
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    estimatedSteps: number;
    requiredSkills: string[];
    timeline: string;
    enterpriseFeatures: {
      requiresCrossDepartmental: boolean;
      requiresAgentCreation: boolean;
      requiresHumanOversight: boolean;
      scaleLevel: 'individual' | 'team' | 'department' | 'organization';
    };
    humanExpertise: {
      required: boolean;
      roles: string[];
      collaborationType: string[];
    };
  }> {
    const systemPrompt = `You are an enterprise project planning analyst. Analyze business goals and classify them for enterprise-scale execution.

ENTERPRISE CHARACTERISTICS TO DETECT:
1. Cross-departmental coordination needs (marketing + engineering + finance)
2. Agent capability gaps requiring workforce development
3. Human expertise requirements for oversight/approval
4. Scale level (individual task vs organizational transformation)
5. Timeline scope (days/weeks vs minutes/hours)

CRITICAL JSON FORMATTING REQUIREMENTS:
- You MUST respond with valid JSON only
- No markdown formatting, no code blocks, no extra text
- Ensure all strings are properly quoted and arrays properly formatted

RESPONSE FORMAT: Return ONLY a JSON object with:
- projectName: Concise, professional project name (max 60 chars)
- description: Clear enterprise goal statement
- scope: Brief scope description with enterprise context
- complexity: "simple" (1-3 steps), "moderate" (4-7 steps), "complex" (8-15 steps), or "enterprise" (16+ steps)
- estimatedSteps: Number estimate including subprojects
- requiredSkills: Array of skill types and departments needed
- timeline: Enterprise time estimate (e.g., "3-5 days", "2-3 weeks", "1-2 months")
- enterpriseFeatures: Object with boolean flags and scale assessment
- humanExpertise: Object detailing human involvement needs

EXAMPLE VALID JSON:
{
  "projectName": "Complete Product Launch Campaign with Team Building",
  "description": "Launch new AI product with comprehensive marketing strategy and agent workforce development",
  "scope": "Multi-department coordination with permanent agent team creation",
  "complexity": "enterprise",
  "estimatedSteps": 18,
  "requiredSkills": ["market_research", "content_creation", "competitive_analysis", "agent_development", "cross_department_coordination"],
  "timeline": "4-6 weeks",
  "enterpriseFeatures": {
    "requiresCrossDepartmental": true,
    "requiresAgentCreation": true,
    "requiresHumanOversight": true,
    "scaleLevel": "organization"
  },
  "humanExpertise": {
    "required": true,
    "roles": ["Marketing Director", "Product Manager", "Brand Strategist"],
    "collaborationType": ["approval", "strategy", "review"]
  }
}`;

    const userMessage = `ANALYZE THIS ENTERPRISE PROJECT GOAL:
"${input.prompt}"

CONTEXT:
- User ID: ${input.userId}
- Conversation ID: ${input.conversationId}
${input.conversationHistory?.length ? `- Conversation history: ${input.conversationHistory.length} messages` : ''}
${input.delegationContext ? `- Available delegation context provided` : ''}

Detect enterprise characteristics and provide complete analysis in the required JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3,
          maxTokens: 800,
          provider: 'anthropic',
        },
      );

      return this.parseEnterpriseGoalAnalysis(response);
    } catch (error) {
      this.logger.error('Enterprise goal analysis failed:', error);
      throw new Error(
        `Enterprise goal analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 2: Assess current agent capabilities and identify gaps
   */
  private async assessAgentCapabilities(
    goalAnalysis: any,
    input: OrchestratorInput,
  ): Promise<{
    availableAgents: Array<{
      name: string;
      type: string;
      displayName: string;
      description?: string;
      department?: string;
      capabilities: string[];
    }>;
    capabilityGaps: Array<{
      requiredCapability: string;
      gapDescription: string;
      suggestedAgentType: 'context_driven' | 'function_based';
      priority: 'low' | 'medium' | 'high';
      department: string;
    }>;
    agentCreationNeeded: boolean;
    agentImprovementNeeded: boolean;
  }> {
    try {
      // Get current agents
      const availableAgents = await this.getAvailableAgents();

      // Use LLM to analyze capability gaps
      const systemPrompt = `You are an agent capability analyst. Compare required skills against available agents to identify workforce gaps.

RESPONSE FORMAT: Return ONLY valid JSON with:
- availableAgents: Enhanced agent list with capabilities
- capabilityGaps: Array of missing capabilities requiring new agents
- agentCreationNeeded: Boolean if new agents should be built
- agentImprovementNeeded: Boolean if existing agents need enhancement

EXAMPLE:
{
  "availableAgents": [
    {
      "name": "marketing_swarm",
      "type": "specialist",
      "displayName": "Marketing Swarm",
      "department": "marketing",
      "capabilities": ["campaign_strategy", "multi_channel_coordination"]
    }
  ],
  "capabilityGaps": [
    {
      "requiredCapability": "social_media_automation",
      "gapDescription": "No agent handles automated social media posting and scheduling",
      "suggestedAgentType": "function_based",
      "priority": "high",
      "department": "marketing"
    }
  ],
  "agentCreationNeeded": true,
  "agentImprovementNeeded": false
}`;

      const userMessage = `ASSESS AGENT CAPABILITIES FOR THIS PROJECT:

PROJECT ANALYSIS:
${JSON.stringify(goalAnalysis, null, 2)}

AVAILABLE AGENTS:
${JSON.stringify(availableAgents, null, 2)}

REQUIRED SKILLS: ${goalAnalysis.requiredSkills.join(', ')}

Identify capability gaps and workforce development needs.`;

      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.2,
          maxTokens: 800,
          provider: 'anthropic',
        },
      );

      return this.parseCapabilityAssessment(response, availableAgents);
    } catch (error) {
      this.logger.error('Agent capability assessment failed:', error);
      throw new Error(
        `Agent capability assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 3: Analyze if request requires subproject decomposition
   */
  private async analyzeSubprojectNeeds(
    goalAnalysis: any,
    input: OrchestratorInput,
  ): Promise<{
    requiresSubprojects: boolean;
    suggestedSubprojects: Array<{
      name: string;
      description: string;
      department: string;
      assignedOrchestrator: string;
      estimatedDuration: string;
      dependencies: string[];
    }>;
    crossDepartmentalCoordination: boolean;
    parallelExecutionOpportunities: string[];
  }> {
    if (!goalAnalysis.enterpriseFeatures?.requiresCrossDepartmental) {
      return {
        requiresSubprojects: false,
        suggestedSubprojects: [],
        crossDepartmentalCoordination: false,
        parallelExecutionOpportunities: [],
      };
    }

    const systemPrompt = `You are a subproject decomposition specialist. Analyze complex enterprise requests to determine if they should be broken into subprojects managed by different department orchestrators.

AVAILABLE ORCHESTRATORS:
- ceo_orchestrator: Cross-functional, strategic oversight
- cto_orchestrator: Technical implementation, engineering coordination
- cmo_orchestrator: Marketing strategy, brand management
- cfo_orchestrator: Financial planning, budget analysis
- marketing_manager_orchestrator: Marketing execution, campaign management

RESPONSE FORMAT: Return ONLY valid JSON with:
- requiresSubprojects: Boolean if decomposition is beneficial
- suggestedSubprojects: Array of proposed subprojects with orchestrator assignments
- crossDepartmentalCoordination: Boolean if coordination is needed
- parallelExecutionOpportunities: Array of subproject groups that can run in parallel

EXAMPLE:
{
  "requiresSubprojects": true,
  "suggestedSubprojects": [
    {
      "name": "Technical Implementation",
      "description": "Build product features and infrastructure",
      "department": "engineering",
      "assignedOrchestrator": "cto_orchestrator",
      "estimatedDuration": "3-4 weeks",
      "dependencies": []
    },
    {
      "name": "Marketing Campaign Launch",
      "description": "Create and execute marketing strategy",
      "department": "marketing",
      "assignedOrchestrator": "cmo_orchestrator", 
      "estimatedDuration": "2-3 weeks",
      "dependencies": ["Technical Implementation"]
    }
  ],
  "crossDepartmentalCoordination": true,
  "parallelExecutionOpportunities": ["research_phase", "content_creation_phase"]
}`;

    const userMessage = `ANALYZE SUBPROJECT DECOMPOSITION NEEDS:

PROJECT ANALYSIS:
${JSON.stringify(goalAnalysis, null, 2)}

USER REQUEST: "${input.prompt}"

Determine if this complex request should be decomposed into subprojects managed by different orchestrators.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3,
          maxTokens: 800,
          provider: 'anthropic',
        },
      );

      return this.parseSubprojectAnalysis(response);
    } catch (error) {
      this.logger.error('Subproject analysis failed:', error);
      throw new Error(
        `Subproject analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 4: Generate enterprise plan structure with all features
   */
  private async generateEnterprisePlanStructure(
    input: OrchestratorInput,
    goalAnalysis: any,
    capabilityAssessment: any,
    subprojectAnalysis: any,
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are an enterprise project planner. Create comprehensive plans with agent steps, subprojects, and workforce development.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations.

STEP TYPES AVAILABLE:
- "agent_step": Delegate to existing agent
- "build_agent": Create new permanent agent for capability gap
- "improve_agent": Enhance existing agent performance
- "subproject": Create child project managed by different orchestrator
- "human_approval": Human expert review and approval

ORCHESTRATORS AVAILABLE: ceo_orchestrator, cto_orchestrator, cmo_orchestrator, cfo_orchestrator, marketing_manager_orchestrator

JSON STRUCTURE REQUIRED:
{
  "projectName": "string",
  "description": "string",
  "steps": [
    {
      "stepId": "step-1",
      "stepName": "string",
      "stepType": "agent_step|build_agent|improve_agent|subproject|human_approval",
      "agentName": "string (for agent_step)",
      "prompt": "string",
      "dependencies": [],
      "assignedOrchestrator": "string (for subproject steps)",
      "estimatedDuration": "string (enterprise timelines: days/weeks)",
      "metadata": {
        "department": "string",
        "priority": "low|medium|high",
        "humanExpert": "string (name/role)"
      }
    }
  ],
  "metadata": {
    "totalEstimatedDuration": "string",
    "complexity": "string",
    "requiresSubprojects": boolean,
    "agentCreationSteps": number
  }
}`;

    const userMessage = `CREATE ENTERPRISE PROJECT PLAN:

GOAL ANALYSIS:
${JSON.stringify(goalAnalysis, null, 2)}

CAPABILITY ASSESSMENT:
${JSON.stringify(capabilityAssessment, null, 2)}

SUBPROJECT ANALYSIS:
${JSON.stringify(subprojectAnalysis, null, 2)}

Create a comprehensive plan with:
1. Steps for existing agent capabilities
2. "build_agent" steps for capability gaps
3. "subproject" steps for cross-departmental work
4. "human_approval" steps for expert oversight
5. Enterprise timelines (days/weeks, not minutes)

Return the complete plan structure in JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 1500,
          provider: 'anthropic',
        },
      );

      return this.parseEnterprisePlanStructure(response, input);
    } catch (error) {
      this.logger.error('Enterprise plan structure generation failed:', error);
      throw new Error(
        `Enterprise plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 5: Add human assignments to plan steps
   */
  private async addHumanAssignments(
    plan: PlanDefinition,
    goalAnalysis: any,
  ): Promise<PlanDefinition> {
    if (!goalAnalysis.humanExpertise?.required) {
      return plan; // No human assignments needed
    }

    const systemPrompt = `You are a human assignment specialist. Assign specific human experts to project steps that require oversight, approval, or expertise.

HUMAN EXPERT TYPES:
- Strategy: "Sarah (Marketing Director)", "Mike (Product Strategy)", "Jennifer (Brand Manager)"
- Technical: "Alex (Engineering Lead)", "Chris (Technical Architect)", "Pat (DevOps)"
- Financial: "Jordan (Finance Director)", "Sam (Budget Analyst)", "Taylor (ROI Specialist)"
- Operations: "Casey (Operations Manager)", "Riley (Process Expert)", "Morgan (Quality Lead)"

ASSIGNMENT RULES:
1. Add humanExpert to metadata for steps needing human involvement
2. Add "human_approval" steps after critical agent outputs
3. Match expert type to step domain
4. Use realistic names and roles

RESPONSE FORMAT: Return the enhanced plan with human assignments added to step metadata.`;

    const userMessage = `ADD HUMAN ASSIGNMENTS TO THIS PLAN:

PLAN:
${JSON.stringify(plan, null, 2)}

HUMAN EXPERTISE REQUIREMENTS:
${JSON.stringify(goalAnalysis.humanExpertise, null, 2)}

Add appropriate human expert assignments to steps that need oversight or approval.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3,
          maxTokens: 1200,
          provider: 'anthropic',
        },
      );

      return this.parseHumanAssignedPlan(response);
    } catch (error) {
      this.logger.error('Human assignment failed:', error);
      // Return original plan if human assignment fails (non-critical)
      this.logger.warn('Continuing with plan without human assignments');
      return plan;
    }
  }

  /**
   * Step 6: Validate and optimize enterprise plan
   */
  private async validateAndOptimizeEnterprisePlan(
    plan: PlanDefinition,
    input: OrchestratorInput,
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are an enterprise plan validation expert. Review comprehensive plans for:

VALIDATION CRITERIA:
1. Enterprise timeline realism (days/weeks, not minutes)
2. Proper subproject decomposition and orchestrator assignments
3. Agent capability gaps addressed with build_agent steps
4. Human expert assignments for oversight and approval
5. Logical dependencies and sequencing
6. Cross-departmental coordination handled properly
7. Workforce development opportunities captured

OPTIMIZATION OPPORTUNITIES:
- Parallel execution where possible
- Resource optimization
- Timeline efficiency
- Risk mitigation
- Quality assurance

Return the validated and optimized plan with the same JSON structure.`;

    const userMessage = `VALIDATE AND OPTIMIZE THIS ENTERPRISE PLAN:

${JSON.stringify(plan, null, 2)}

ORIGINAL REQUEST: "${input.prompt}"

Check for:
- Enterprise timeline realism
- Proper subproject handling
- Agent workforce development
- Human collaboration patterns
- Cross-departmental coordination
- Missing steps or dependencies

Return the improved plan in the same JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.2,
          maxTokens: 1500,
          provider: 'anthropic',
        },
      );

      return this.parseValidatedEnterprisePlan(response);
    } catch (error) {
      this.logger.error('Enterprise plan validation failed:', error);
      throw new Error(
        `Enterprise plan validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ============================================================================
  // ENTERPRISE HELPER METHODS
  // ============================================================================

  /**
   * Count subproject steps in plan
   */
  private countSubprojectSteps(plan: PlanDefinition): number {
    return plan.steps.filter((step) => (step as any).stepType === 'subproject')
      .length;
  }

  /**
   * Count human assignments in plan
   */
  private countHumanAssignments(plan: PlanDefinition): number {
    return plan.steps.filter(
      (step) =>
        step.metadata?.humanExpert || step.stepType === 'human_approval',
    ).length;
  }

  // ============================================================================
  // LEGACY PLANNING METHODS - Maintained for backward compatibility
  // ============================================================================

  /**
   * Step 1: Analyze goal and requirements with LLM
   */
  private async analyzeGoalRequirements(input: OrchestratorInput): Promise<{
    projectName: string;
    description: string;
    scope: string;
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedSteps: number;
    requiredSkills: string[];
    timeline: string;
  }> {
    const systemPrompt = `You are a project planning analyst. Analyze user goals and break them down into structured requirements.

Your job is to understand:
1. What the user wants to accomplish (goal)
2. The scope and complexity of the work
3. What types of skills/agents will be needed
4. Rough timeline and number of steps

CRITICAL JSON FORMATTING REQUIREMENTS:
- You MUST respond with valid JSON only
- No markdown formatting, no code blocks, no extra text
- Ensure all strings are properly quoted
- Ensure all arrays and objects are properly closed
- Double-check for trailing commas or missing commas

RESPONSE FORMAT: Return ONLY a JSON object with:
- projectName: Concise, professional project name (max 50 chars)
- description: Clear goal statement
- scope: Brief scope description
- complexity: "simple" (1-3 steps), "moderate" (4-7 steps), or "complex" (8+ steps)
- estimatedSteps: Number estimate
- requiredSkills: Array of skill types needed
- timeline: Rough time estimate (e.g., "2-3 days", "1-2 weeks")

EXAMPLE VALID JSON:
{
  "projectName": "Product Launch Campaign",
  "description": "Comprehensive marketing campaign for new AI product",
  "scope": "Multi-channel marketing with research, content, and promotion",
  "complexity": "complex",
  "estimatedSteps": 8,
  "requiredSkills": ["market_research", "content_creation", "social_media", "competitive_analysis"],
  "timeline": "4-6 weeks"
}`;

    const userMessage = `ANALYZE THIS PROJECT GOAL:
"${input.prompt}"

CONTEXT:
- User ID: ${input.userId}
- Conversation ID: ${input.conversationId}
${input.conversationHistory?.length ? `- Conversation history: ${input.conversationHistory.length} messages` : ''}
${input.delegationContext ? `- Available delegation context provided` : ''}

Provide your analysis in the required JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3, // Moderate creativity for planning
          maxTokens: 600,
          provider: 'anthropic', // Use direct Anthropic path to avoid Supabase dependency
          modelId: 'claude-3-5-sonnet-20241022', // Use current model, not modelId to avoid enhanced routing
        },
      );

      return this.parseGoalAnalysis(response);
    } catch (error) {
      this.logger.error('Goal analysis failed:', error);
      throw new Error(
        `Goal analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 2: Get available agents for task assignment
   */
  private async getAvailableAgents(): Promise<
    Array<{
      name: string;
      type: string;
      displayName: string;
      description?: string;
    }>
  > {
    try {
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();

      return agents.map((agent) => ({
        name: agent.name,
        type: agent.type,
        displayName: agent.metadata?.displayName || agent.name,
        description: agent.metadata?.description,
      }));
    } catch (error) {
      this.logger.error('Agent discovery failed:', error);
      throw new Error(
        `Failed to discover agents for planning: ${error instanceof Error ? error.message : 'Unknown error'}. Agent discovery must work for planning to function.`,
      );
    }
  }

  /**
   * Step 3: Generate plan structure with agent assignments
   */
  private async generatePlanStructure(
    input: OrchestratorInput,
    goalAnalysis: any,
    availableAgents: any[],
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are a project planner. Create marketing campaign plans.

CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations, no extra text.

AVAILABLE AGENTS: marketing_swarm, blog_post_writer, content_writer, market_research, competitors

JSON STRUCTURE REQUIRED:
{
  "projectName": "string",
  "description": "string", 
  "steps": [
    {
      "stepId": "step-1",
      "stepName": "string",
      "stepType": "agent_step",
      "agentName": "string",
      "prompt": "string",
      "dependencies": [],
      "status": "pending"
    }
  ],
  "metadata": {}
}`;

    const userMessage = `Create a marketing campaign plan for: ${input.prompt}

Create 3-5 steps using the available agents. Return only the JSON structure.`;

    try {
      this.logger.log(`=== PLAN GENERATION DEBUG ===`);
      this.logger.log(`System prompt length: ${systemPrompt.length}`);
      this.logger.log(`User message length: ${userMessage.length}`);
      this.logger.log(
        `Available agents: ${JSON.stringify(availableAgents, null, 2)}`,
      );

      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 1200,
          provider: 'anthropic',
        },
      );

      this.logger.log(`LLM response length: ${response.length}`);
      this.logger.log(
        `LLM response (first 500 chars): ${response.substring(0, 500)}`,
      );
      this.logger.log(
        `LLM response (last 500 chars): ${response.substring(Math.max(0, response.length - 500))}`,
      );

      return this.parsePlanStructure(response, input);
    } catch (error) {
      this.logger.error('Plan structure generation failed:', error);
      throw new Error(
        `Plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Step 4: Validate and optimize the plan
   */
  private async validateAndOptimizePlan(
    planStructure: PlanDefinition,
    input: OrchestratorInput,
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are a plan validation expert. Review project plans for:
1. Logical step sequencing
2. Appropriate dependencies
3. Realistic agent assignments
4. Missing steps or gaps
5. Optimization opportunities

Return the validated plan with any necessary adjustments.
IMPORTANT: Return the exact same JSON structure, just with improvements.`;

    const userMessage = `VALIDATE AND OPTIMIZE THIS PLAN:

${JSON.stringify(planStructure, null, 2)}

Check for:
- Logical flow and dependencies
- Appropriate agent assignments
- Missing steps
- Optimization opportunities
- Timeline realism

Return the improved plan in the same JSON format.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.2, // Low temperature for validation
          maxTokens: 1200,
          provider: 'anthropic',
        },
      );

      return this.parseValidatedPlan(response);
    } catch (error) {
      this.logger.error('Plan validation failed:', error);
      throw new Error(
        `Plan validation failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM must be able to validate and optimize plans.`,
      );
    }
  }

  // ============================================================================
  // FEEDBACK AND REFINEMENT METHODS
  // ============================================================================

  /**
   * Analyze user feedback to understand requested changes
   */
  private async analyzeFeedback(
    feedback: string,
    input: OrchestratorInput,
  ): Promise<{
    changeType:
      | 'modify_steps'
      | 'add_steps'
      | 'remove_steps'
      | 'change_agents'
      | 'adjust_timeline';
    specificChanges: string[];
    priority: 'low' | 'medium' | 'high';
    reasoning: string;
  }> {
    const systemPrompt = `You are a feedback analyst. Analyze user feedback on project plans to understand what changes they want.

RESPONSE FORMAT: JSON object with:
- changeType: Main type of change requested
- specificChanges: Array of specific changes mentioned
- priority: How urgent/important the changes seem
- reasoning: Explanation of the feedback`;

    const userMessage = `ANALYZE THIS FEEDBACK ON A PROJECT PLAN:
"${feedback}"

ORIGINAL REQUEST CONTEXT:
"${input.prompt}"

What changes is the user requesting?`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.2,
          maxTokens: 400,
          provider: 'anthropic',
        },
      );

      return this.parseFeedbackAnalysis(response);
    } catch (error) {
      this.logger.error('Feedback analysis failed:', error);
      throw new Error(
        `Feedback analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Incorporate feedback into a refined plan
   */
  private async incorporateFeedback(
    feedback: string,
    input: OrchestratorInput,
    availableAgents: any[],
    originalPlan: PlanDefinition,
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are a project plan refinement specialist. Your job is to take an EXISTING plan and EXPAND it based on user feedback.

CRITICAL: Return ONLY valid JSON. No markdown, no explanations.

AVAILABLE AGENTS: marketing_swarm, blog_post_writer, content_writer, market_research, competitors

INSTRUCTIONS:
1. Keep ALL original steps from the existing plan
2. Add NEW steps based on the user feedback
3. Update dependencies appropriately
4. The refined plan should have MORE steps than the original

JSON STRUCTURE:
{
  "projectName": "string",
  "description": "string",
  "steps": [array of step objects],
  "metadata": {}
}`;

    const userMessage = `EXPAND THIS EXISTING PLAN:

ORIGINAL PLAN:
${JSON.stringify(originalPlan, null, 2)}

USER FEEDBACK TO INCORPORATE:
"${feedback}"

Return the expanded plan with all original steps PLUS new steps for the requested additions. The refined plan should have at least ${originalPlan.steps.length + 2} steps.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.3,
          maxTokens: 1500,
          provider: 'anthropic',
        },
      );

      return this.parsePlanStructure(response, input);
    } catch (error) {
      this.logger.error('Feedback incorporation failed:', error);
      throw new Error(
        `Failed to incorporate feedback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ============================================================================
  // PLAN FORMATTING METHODS
  // ============================================================================

  /**
   * Generate human-readable plan with LLM
   */
  private async generateHumanReadablePlan(
    plan: PlanDefinition,
  ): Promise<string> {
    const systemPrompt = `You are a plan formatter. Convert structured project plans into clear, engaging human-readable formats for user approval.

Format as markdown with:
- Clear project overview
- Step-by-step breakdown
- Agent assignments explained
- Timeline information
- Next steps for approval

Make it professional but approachable.`;

    const userMessage = `FORMAT THIS PLAN FOR HUMAN REVIEW:

${JSON.stringify(plan, null, 2)}

Create an engaging, clear presentation that helps the user understand and approve the plan.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 800,
          provider: 'anthropic',
        },
      );

      return response;
    } catch (error) {
      this.logger.error('LLM plan formatting failed:', error);
      return this.generateBasicPlanFormat(plan);
    }
  }

  /**
   * Basic fallback plan formatting
   */
  private generateBasicPlanFormat(plan: PlanDefinition): string {
    let formatted = `# Project Plan: ${plan.projectName}\n\n`;
    formatted += `**Goal:** ${plan.description}\n\n`;
    formatted += `**Execution Steps:**\n\n`;

    plan.steps.forEach((step, index) => {
      formatted += `### ${index + 1}. ${step.stepName}\n`;
      formatted += `- **Type:** ${step.stepType === 'agent_step' ? 'Agent Task' : 'Human Review'}\n`;
      if (step.agentName) {
        formatted += `- **Assigned to:** ${step.agentName}\n`;
      }
      formatted += `- **Task:** ${step.prompt}\n`;
      if (step.dependencies.length > 0) {
        formatted += `- **Depends on:** Steps ${step.dependencies.join(', ')}\n`;
      }
      formatted += `\n`;
    });

    formatted += `\n**Ready to proceed?** Please review and approve this plan to begin execution.`;

    return formatted;
  }

  // ============================================================================
  // ENTERPRISE PARSING METHODS
  // ============================================================================

  /**
   * Parse enterprise goal analysis response
   */
  private parseEnterpriseGoalAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required enterprise fields
      if (
        !parsed.projectName ||
        !parsed.description ||
        !parsed.complexity ||
        !parsed.enterpriseFeatures
      ) {
        throw new Error('Missing required fields in enterprise goal analysis');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse enterprise goal analysis:', error);
      throw new Error(
        `Enterprise goal analysis parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse capability assessment response
   */
  private parseCapabilityAssessment(
    response: string,
    availableAgents: any[],
  ): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        !parsed.hasOwnProperty('agentCreationNeeded') ||
        !parsed.capabilityGaps
      ) {
        throw new Error('Missing required fields in capability assessment');
      }

      // Enhance with available agents data
      const enhancedAgents = availableAgents.map((agent) => ({
        ...agent,
        department: this.inferAgentDepartment(agent.name),
        capabilities: this.inferAgentCapabilities(
          agent.name,
          agent.description,
        ),
      }));

      return {
        ...parsed,
        availableAgents: enhancedAgents,
      };
    } catch (error) {
      this.logger.error('Failed to parse capability assessment:', error);
      throw new Error(
        `Capability assessment parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse subproject analysis response
   */
  private parseSubprojectAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.hasOwnProperty('requiresSubprojects')) {
        throw new Error(
          'Missing requiresSubprojects field in subproject analysis',
        );
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse subproject analysis:', error);
      throw new Error(
        `Subproject analysis parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse enterprise plan structure response
   */
  private parseEnterprisePlanStructure(
    response: string,
    input: OrchestratorInput,
  ): PlanDefinition {
    try {
      const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, '');
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in enterprise plan response');
        throw new Error('No JSON found in response');
      }

      let jsonString = jsonMatch[0];
      jsonString = jsonString.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ');

      const parsed = JSON.parse(jsonString);

      // Validate and enhance the enterprise plan
      const plan: PlanDefinition = {
        projectName: parsed.projectName || 'Unnamed Enterprise Project',
        description: parsed.description || input.prompt,
        steps: this.validateEnterpriseSteps(parsed.steps || []),
        metadata: {
          createdAt: new Date().toISOString(),
          userId: input.userId,
          conversationId: input.conversationId,
          enterpriseFeatures: true,
          ...parsed.metadata,
        },
      };

      return plan;
    } catch (error) {
      this.logger.error('Failed to parse enterprise plan structure:', error);
      throw new Error(
        `Enterprise plan parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse human-assigned plan response
   */
  private parseHumanAssignedPlan(response: string): PlanDefinition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in human assignment response');
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.projectName || !parsed.steps) {
        throw new Error('Invalid plan structure in human assignment response');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse human-assigned plan:', error);
      throw new Error(
        `Human assignment parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Parse validated enterprise plan response
   */
  private parseValidatedEnterprisePlan(response: string): PlanDefinition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error(
          'No JSON found in enterprise plan validation response',
        );
        throw new Error('Plan validation response contained no JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.projectName || !parsed.steps) {
        throw new Error('Plan validation response missing required fields');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Enterprise plan validation parsing failed:', error);
      throw new Error(
        `Enterprise plan validation parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ============================================================================
  // ENTERPRISE HELPER METHODS
  // ============================================================================

  /**
   * Infer agent department from name
   */
  private inferAgentDepartment(agentName: string): string {
    if (
      agentName.includes('marketing') ||
      agentName.includes('content') ||
      agentName.includes('blog')
    ) {
      return 'marketing';
    }
    if (agentName.includes('research') || agentName.includes('competitor')) {
      return 'research';
    }
    if (agentName.includes('finance') || agentName.includes('budget')) {
      return 'finance';
    }
    if (agentName.includes('engineer') || agentName.includes('tech')) {
      return 'engineering';
    }
    return 'general';
  }

  /**
   * Infer agent capabilities from name and description
   */
  private inferAgentCapabilities(
    agentName: string,
    description?: string,
  ): string[] {
    const capabilities: string[] = [];

    const text = `${agentName} ${description || ''}`.toLowerCase();

    if (text.includes('marketing') || text.includes('campaign')) {
      capabilities.push('marketing_strategy', 'campaign_management');
    }
    if (
      text.includes('content') ||
      text.includes('blog') ||
      text.includes('writing')
    ) {
      capabilities.push('content_creation', 'copywriting');
    }
    if (text.includes('research') || text.includes('analysis')) {
      capabilities.push('market_research', 'data_analysis');
    }
    if (text.includes('competitor') || text.includes('competitive')) {
      capabilities.push('competitive_analysis');
    }
    if (text.includes('swarm') || text.includes('coordination')) {
      capabilities.push('multi_agent_coordination');
    }

    return capabilities.length > 0 ? capabilities : ['general_purpose'];
  }

  /**
   * Validate enterprise step structure
   */
  private validateEnterpriseSteps(steps: any[]): any[] {
    return steps.map((step, index) => ({
      stepId: step.stepId || `step-${index + 1}`,
      stepName: step.stepName || `Unnamed Step ${index + 1}`,
      stepType: this.validateStepType(step.stepType),
      agentName: step.agentName,
      prompt: step.prompt || '',
      dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
      assignedOrchestrator: step.assignedOrchestrator,
      estimatedDuration: step.estimatedDuration || '1-2 hours',
      metadata: {
        ...step.metadata,
        stepIndex: index,
      },
    }));
  }

  /**
   * Validate step type for enterprise plans
   */
  private validateStepType(stepType: string): string {
    const validTypes = [
      'agent_step',
      'build_agent',
      'improve_agent',
      'subproject',
      'human_approval',
    ];
    return validTypes.includes(stepType) ? stepType : 'agent_step';
  }

  // ============================================================================
  // LEGACY PARSING HELPER METHODS - Maintained for backward compatibility
  // ============================================================================

  private parseGoalAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.projectName || !parsed.description || !parsed.complexity) {
        throw new Error('Missing required fields in goal analysis');
      }

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse goal analysis:', error);
      throw new Error(
        `Goal analysis parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private parsePlanStructure(
    response: string,
    input: OrchestratorInput,
  ): PlanDefinition {
    try {
      // Clean the response and try to extract JSON
      const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn(
          'No JSON found in LLM plan response, trying full response as JSON',
        );
        this.logger.debug(`Response content: ${response.substring(0, 500)}...`);
        throw new Error('No JSON found in response');
      }

      let jsonString = jsonMatch[0];
      // Additional cleaning for common JSON issues
      jsonString = jsonString.replace(/[\n\r\t]/g, ' '); // Replace newlines/tabs with spaces
      jsonString = jsonString.replace(/\s+/g, ' '); // Normalize whitespace

      this.logger.debug(
        `Attempting to parse plan JSON: ${jsonString.substring(0, 200)}...`,
      );
      const parsed = JSON.parse(jsonString);

      // Validate and enhance the plan
      const plan: PlanDefinition = {
        projectName: parsed.projectName || 'Unnamed Project',
        description: parsed.description || input.prompt,
        steps: parsed.steps || [],
        metadata: {
          createdAt: new Date().toISOString(),
          userId: input.userId,
          conversationId: input.conversationId,
          ...parsed.metadata,
        },
      };

      return plan;
    } catch (error) {
      this.logger.error('Failed to parse plan structure:', error);
      this.logger.debug(
        `Raw LLM response causing parse failure: ${response.substring(0, 1000)}...`,
      );
      throw new Error(
        `Plan parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM generated malformed JSON that cannot be parsed.`,
      );
    }
  }

  private parseValidatedPlan(response: string): PlanDefinition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.error('No JSON found in plan validation response');
        throw new Error('Plan validation response contained no JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.projectName) {
        throw new Error(
          'Plan validation response missing required projectName field',
        );
      }
      return parsed;
    } catch (error) {
      this.logger.error('Plan validation parsing failed:', error);
      throw new Error(
        `Plan validation parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM must generate valid JSON.`,
      );
    }
  }

  private parseFeedbackAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error('Failed to parse feedback analysis:', error);
      throw new Error(
        `Feedback parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
