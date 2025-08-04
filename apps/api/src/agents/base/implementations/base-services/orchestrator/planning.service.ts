import { Injectable, Logger } from '@nestjs/common';
import { 
  IPlanningService, 
  OrchestratorInput, 
  PlanDefinition,
  PlanStep
} from '../../../../../orchestration/orchestration.types';
import { LLMService } from '../../../../../llms/llm.service';
import { AgentDiscoveryService } from '../../../../../agent-discovery.service';

/**
 * Planning Service - Iterative, collaborative planning with LLM
 * 
 * Manages the back-and-forth conversational loop with multiple LLM calls 
 * for collaborative planning between user and orchestrator.
 */
@Injectable()
export class PlanningService implements IPlanningService {
  private readonly logger = new Logger(PlanningService.name);
  
  constructor(
    private readonly llmService: LLMService,
    private readonly agentDiscoveryService: AgentDiscoveryService,
  ) {}

  /**
   * Create project plan through iterative LLM conversations
   * 
   * This is the core of the "Plan" phase in "Plan-Approve-Act":
   * 1. Analyze user goal with LLM to understand requirements
   * 2. Break down into actionable steps with agent assignments
   * 3. Analyze dependencies and sequencing
   * 4. Return structured PlanDefinition ready for execution
   */
  async createPlan(input: OrchestratorInput): Promise<PlanDefinition> {
    this.logger.log(`Creating plan for goal: "${input.prompt.substring(0, 100)}..."`);
    
    try {
      // Step 1: Analyze the goal and requirements
      const goalAnalysis = await this.analyzeGoalRequirements(input);
      
      // Step 2: Get available agents for task assignment
      const availableAgents = await this.getAvailableAgents();
      
      // Step 3: Generate structured plan with multiple LLM calls
      const planStructure = await this.generatePlanStructure(input, goalAnalysis, availableAgents);
      
      // Step 4: Analyze dependencies and validate plan
      const finalPlan = await this.validateAndOptimizePlan(planStructure, input);
      
      this.logger.log(`Generated plan "${finalPlan.projectName}" with ${finalPlan.steps.length} steps`);
      return finalPlan;
      
    } catch (error) {
      this.logger.error('Plan creation failed:', error);
      throw new Error(`Failed to create plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refine existing plan based on user feedback
   * 
   * Continues the collaborative planning conversation with iterative improvements.
   */
  async refinePlan(planId: string, feedback: string, input: OrchestratorInput): Promise<PlanDefinition> {
    this.logger.log(`Refining plan ${planId} with feedback: "${feedback.substring(0, 100)}..."`);
    
    try {
      // TODO: Load existing plan from database first
      // For now, create a new plan incorporating the feedback
      
      // Analyze the feedback to understand requested changes
      const feedbackAnalysis = await this.analyzeFeedback(feedback, input);
      
      // Get available agents again (might have changed)
      const availableAgents = await this.getAvailableAgents();
      
      // Incorporate feedback into new plan
      const refinedPlan = await this.incorporateFeedback(feedbackAnalysis, input, availableAgents);
      
      this.logger.log(`Refined plan with ${refinedPlan.steps.length} steps based on feedback`);
      return refinedPlan;
      
    } catch (error) {
      this.logger.error('Plan refinement failed:', error);
      throw new Error(`Failed to refine plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  // CORE PLANNING METHODS - Multiple LLM calls for comprehensive planning
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

RESPONSE FORMAT: Return a JSON object with:
- projectName: Concise, professional project name (max 50 chars)
- description: Clear goal statement
- scope: Brief scope description
- complexity: "simple" (1-3 steps), "moderate" (4-7 steps), or "complex" (8+ steps)
- estimatedSteps: Number estimate
- requiredSkills: Array of skill types needed
- timeline: Rough time estimate (e.g., "2-3 days", "1-2 weeks")`;

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
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parseGoalAnalysis(response);
    } catch (error) {
      this.logger.error('Goal analysis failed:', error);
      throw new Error(`Goal analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 2: Get available agents for task assignment
   */
  private async getAvailableAgents(): Promise<Array<{
    name: string;
    type: string;
    displayName: string;
    description?: string;
  }>> {
    try {
      await this.agentDiscoveryService.discoverAgents();
      const agents = this.agentDiscoveryService.getDiscoveredAgents();
      
      return agents.map(agent => ({
        name: agent.name,
        type: agent.type,
        displayName: agent.metadata?.displayName || agent.name,
        description: agent.metadata?.description
      }));
    } catch (error) {
      this.logger.warn('Failed to get agents, using fallback list:', error);
      
      // Fallback agent list if discovery fails
      return [
        { name: 'research_agent', type: 'research', displayName: 'Research Agent' },
        { name: 'marketing_swarm', type: 'marketing', displayName: 'Marketing Swarm' },
        { name: 'blog_post_writer', type: 'marketing', displayName: 'Blog Post Writer' },
        { name: 'content_writer', type: 'marketing', displayName: 'Content Writer' },
      ];
    }
  }

  /**
   * Step 3: Generate plan structure with agent assignments
   */
  private async generatePlanStructure(
    input: OrchestratorInput,
    goalAnalysis: any,
    availableAgents: any[]
  ): Promise<PlanDefinition> {
    const systemPrompt = `You are a project planner. Create detailed execution plans with specific agent assignments.

AVAILABLE AGENTS:
${availableAgents.map(agent => `- ${agent.displayName} (${agent.type}): ${agent.description || 'General ' + agent.type + ' tasks'}`).join('\n')}

PLAN STRUCTURE:
Create a step-by-step plan where each step is either:
1. agent_step: Task for a specific agent
2. human_approval: User review/approval point

STEP GUIDELINES:
- Use specific agent names from the available list
- Make prompts clear and actionable
- Include user approval steps for major milestones
- Steps should be 15-60 minutes of work each
- Consider logical sequencing and dependencies

RESPONSE FORMAT: JSON object with:
- projectName: From analysis
- description: From analysis  
- steps: Array of step objects with:
  - stepId: Unique ID (step_1, step_2, etc.)
  - stepName: Human-readable name
  - stepType: "agent_step" or "human_approval"
  - agentName: Specific agent name (for agent_step only)
  - prompt: Clear instruction for the step
  - dependencies: Array of stepIds this depends on
  - metadata: Additional context`;

    const userMessage = `CREATE EXECUTION PLAN FOR:

GOAL ANALYSIS:
${JSON.stringify(goalAnalysis, null, 2)}

ORIGINAL REQUEST:
"${input.prompt}"

Generate a detailed plan with ${goalAnalysis.estimatedSteps} steps (approximately).
Focus on practical execution with the available agents.`;

    try {
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 1200,
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parsePlanStructure(response, input);
    } catch (error) {
      this.logger.error('Plan structure generation failed:', error);
      throw new Error(`Plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Step 4: Validate and optimize the plan
   */
  private async validateAndOptimizePlan(
    planStructure: PlanDefinition,
    input: OrchestratorInput
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
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parseValidatedPlan(response, planStructure);
    } catch (error) {
      this.logger.warn('Plan validation failed, using original plan:', error);
      return planStructure; // Return original if validation fails
    }
  }

  // ============================================================================
  // FEEDBACK AND REFINEMENT METHODS
  // ============================================================================

  /**
   * Analyze user feedback to understand requested changes
   */
  private async analyzeFeedback(feedback: string, input: OrchestratorInput): Promise<{
    changeType: 'modify_steps' | 'add_steps' | 'remove_steps' | 'change_agents' | 'adjust_timeline';
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
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parseFeedbackAnalysis(response);
    } catch (error) {
      this.logger.error('Feedback analysis failed:', error);
      throw new Error(`Feedback analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Incorporate feedback into a refined plan
   */
  private async incorporateFeedback(
    feedbackAnalysis: any,
    input: OrchestratorInput,
    availableAgents: any[]
  ): Promise<PlanDefinition> {
    // For now, create a new plan with feedback context
    const modifiedInput = {
      ...input,
      prompt: `${input.prompt}\n\nUser feedback to incorporate: ${feedbackAnalysis.specificChanges.join(', ')}`
    };

    const goalAnalysis = await this.analyzeGoalRequirements(modifiedInput);
    return await this.generatePlanStructure(modifiedInput, goalAnalysis, availableAgents);
  }

  // ============================================================================
  // PLAN FORMATTING METHODS
  // ============================================================================

  /**
   * Generate human-readable plan with LLM
   */
  private async generateHumanReadablePlan(plan: PlanDefinition): Promise<string> {
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
          providerId: 'anthropic',
          modelId: 'claude-3-5-sonnet-20241022'
        }
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
  // PARSING HELPER METHODS
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
      throw new Error(`Goal analysis parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parsePlanStructure(response: string, input: OrchestratorInput): PlanDefinition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and enhance the plan
      const plan: PlanDefinition = {
        projectName: parsed.projectName || 'Unnamed Project',
        description: parsed.description || input.prompt,
        steps: parsed.steps || [],
        metadata: {
          createdAt: new Date().toISOString(),
          userId: input.userId,
          conversationId: input.conversationId,
          ...parsed.metadata
        }
      };
      
      return plan;
    } catch (error) {
      this.logger.error('Failed to parse plan structure:', error);
      throw new Error(`Plan parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseValidatedPlan(response: string, fallback: PlanDefinition): PlanDefinition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.projectName ? parsed : fallback;
    } catch (error) {
      this.logger.warn('Validation parsing failed, using fallback:', error);
      return fallback;
    }
  }

  private parseFeedbackAnalysis(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      this.logger.error('Failed to parse feedback analysis:', error);
      throw new Error(`Feedback parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}