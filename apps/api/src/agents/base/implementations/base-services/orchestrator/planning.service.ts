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
  async refinePlan(planId: string, feedback: string, input: OrchestratorInput, originalPlan?: PlanDefinition): Promise<PlanDefinition> {
    this.logger.log(`Refining plan ${planId} with feedback: "${feedback.substring(0, 100)}..."`);
    
    try {
      // For testing, use the original plan if provided
      // In production, this would load from database using planId
      if (!originalPlan) {
        // Create a basic plan as fallback (for when no original plan is available)
        const goalAnalysis = await this.analyzeGoalRequirements(input);
        const availableAgents = await this.getAvailableAgents();
        originalPlan = await this.generatePlanStructure(input, goalAnalysis, availableAgents);
      }
      
      // Get available agents
      const availableAgents = await this.getAvailableAgents();
      
      // Incorporate feedback into existing plan
      const refinedPlan = await this.incorporateFeedback(feedback, input, availableAgents, originalPlan);
      
      this.logger.log(`Refined plan with ${refinedPlan.steps.length} steps (was ${originalPlan.steps.length}) based on feedback`);
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
          model: 'claude-3-5-sonnet-20241022' // Use current model, not modelId to avoid enhanced routing
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
      this.logger.error('Agent discovery failed:', error);
      throw new Error(`Failed to discover agents for planning: ${error instanceof Error ? error.message : 'Unknown error'}. Agent discovery must work for planning to function.`);
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
      this.logger.log(`Available agents: ${JSON.stringify(availableAgents, null, 2)}`);
      
      const response = await this.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          temperature: 0.4,
          maxTokens: 1200,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      );

      this.logger.log(`LLM response length: ${response.length}`);
      this.logger.log(`LLM response (first 500 chars): ${response.substring(0, 500)}`);
      this.logger.log(`LLM response (last 500 chars): ${response.substring(Math.max(0, response.length - 500))}`);

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
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parseValidatedPlan(response);
    } catch (error) {
      this.logger.error('Plan validation failed:', error);
      throw new Error(`Plan validation failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM must be able to validate and optimize plans.`);
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
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
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
    feedback: string,
    input: OrchestratorInput,
    availableAgents: any[],
    originalPlan: PlanDefinition
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
          model: 'claude-3-5-sonnet-20241022'
        }
      );

      return this.parsePlanStructure(response, input);
    } catch (error) {
      this.logger.error('Feedback incorporation failed:', error);
      throw new Error(`Failed to incorporate feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022'
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
      // Clean the response and try to extract JSON
      const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in LLM plan response, trying full response as JSON');
        this.logger.debug(`Response content: ${response.substring(0, 500)}...`);
        throw new Error('No JSON found in response');
      }
      
      let jsonString = jsonMatch[0];
      // Additional cleaning for common JSON issues
      jsonString = jsonString.replace(/[\n\r\t]/g, ' '); // Replace newlines/tabs with spaces
      jsonString = jsonString.replace(/\s+/g, ' '); // Normalize whitespace
      
      this.logger.debug(`Attempting to parse plan JSON: ${jsonString.substring(0, 200)}...`);
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
          ...parsed.metadata
        }
      };
      
      return plan;
    } catch (error) {
      this.logger.error('Failed to parse plan structure:', error);
      this.logger.debug(`Raw LLM response causing parse failure: ${response.substring(0, 1000)}...`);
      throw new Error(`Plan parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM generated malformed JSON that cannot be parsed.`);
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
        throw new Error('Plan validation response missing required projectName field');
      }
      return parsed;
    } catch (error) {
      this.logger.error('Plan validation parsing failed:', error);
      throw new Error(`Plan validation parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. LLM must generate valid JSON.`);
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