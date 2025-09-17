import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

/**
 * Marketing Swarm Agent Function - Advanced Multi-Agent Orchestration
 *
 * This agent coordinates multiple specialist agents to create, evaluate, and refine
 * marketing content through sophisticated workflows. It demonstrates real production
 * multi-agent collaboration, not just examples.
 */

interface MarketingTask {
  type: 'campaign_creation' | 'content_evaluation' | 'strategy_execution';
  complexity: 'simple' | 'moderate' | 'complex';
  requirements: {
    content_types: string[];
    target_audience: string;
    goals: string[];
    constraints?: string[];
  };
  timeline?: string;
}

interface AgentSpecialist {
  name: string;
  role: string;
  specialties: string[];
  systemPrompt: string;
  temperature: number;
}

interface SwarmWorkflowState {
  originalRequest: string;
  taskAnalysis: MarketingTask | null;
  selectedAgents: AgentSpecialist[];
  agentOutputs: Map<string, any>;
  evaluationResults: Map<string, any>;
  finalContent: any;
  metadata: Record<string, any>;
}

/**
 * Specialist Agent Definitions
 */
const SPECIALIST_AGENTS: Record<string, AgentSpecialist> = {
  blog_writer: {
    name: 'Blog Post Writer',
    role: 'content_creator',
    specialties: [
      'long-form content',
      'thought leadership',
      'educational content',
      'storytelling',
    ],
    systemPrompt: `You are an expert blog post writer. Create compelling, informative, and engaging blog content that drives traffic and establishes thought leadership. Focus on clear structure, engaging introductions, valuable insights, and strong conclusions with clear CTAs.`,
    temperature: 0.7,
  },

  seo_specialist: {
    name: 'SEO Specialist',
    role: 'optimizer',
    specialties: [
      'keyword optimization',
      'meta descriptions',
      'search intent',
      'technical seo',
    ],
    systemPrompt: `You are an SEO expert. Optimize content for search engines while maintaining readability and user value. Focus on keyword integration, meta descriptions, heading structure, and search intent alignment.`,
    temperature: 0.3,
  },

  brand_voice_analyst: {
    name: 'Brand Voice Analyst',
    role: 'evaluator',
    specialties: [
      'brand consistency',
      'voice and tone',
      'messaging alignment',
      'brand guidelines',
    ],
    systemPrompt: `You are a brand voice expert. Ensure all content maintains consistent brand voice, tone, and messaging. Evaluate content for brand alignment and suggest improvements for better brand representation.`,
    temperature: 0.4,
  },

  conversion_optimizer: {
    name: 'Conversion Optimizer',
    role: 'optimizer',
    specialties: [
      'cta optimization',
      'user journey',
      'conversion psychology',
      'persuasive writing',
    ],
    systemPrompt: `You are a conversion optimization expert. Focus on elements that drive user action: compelling CTAs, persuasive copy, clear value propositions, and optimized user journeys.`,
    temperature: 0.5,
  },

  social_media_specialist: {
    name: 'Social Media Specialist',
    role: 'content_creator',
    specialties: [
      'social media content',
      'engagement optimization',
      'platform adaptation',
      'viral content',
    ],
    systemPrompt: `You are a social media expert. Create engaging, shareable content optimized for various social platforms. Focus on engagement, community building, and platform-specific best practices.`,
    temperature: 0.8,
  },

  email_specialist: {
    name: 'Email Marketing Expert',
    role: 'content_creator',
    specialties: [
      'email campaigns',
      'subject lines',
      'email sequences',
      'personalization',
    ],
    systemPrompt: `You are an email marketing expert. Create compelling email content that drives opens, clicks, and conversions. Focus on subject lines, personalization, clear value delivery, and strong CTAs.`,
    temperature: 0.6,
  },
};

/**
 * Step 1: Analyze the marketing request and determine task complexity
 */
async function analyzeMarketingTask(
  state: SwarmWorkflowState,
  llmService: any,
  llmPreferences?: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<SwarmWorkflowState> {
  progressCallback?.(
    'Analyzing marketing task',
    0,
    'in_progress',
    'Understanding request and determining complexity',
  );
  const analysisPrompt = `Analyze this marketing request and classify it:

Request: "${state.originalRequest}"

Determine:
1. Task type: campaign_creation, content_evaluation, or strategy_execution
2. Complexity: simple (1-2 content pieces), moderate (3-5 pieces), complex (campaign/multiple formats)
3. Required content types (blog posts, social media, emails, etc.)
4. Target audience
5. Primary goals
6. Any constraints or special requirements

Respond with JSON:
{
  "type": "task_type",
  "complexity": "complexity_level",
  "requirements": {
    "content_types": ["type1", "type2"],
    "target_audience": "audience description",
    "goals": ["goal1", "goal2"],
    "constraints": ["constraint1"]
  },
  "timeline": "if_mentioned"
}`;

  try {
    const analysisResponse = await llmService.generateResponse(
      'You are a marketing strategy analyst. Always respond with valid JSON.',
      analysisPrompt,
      {
        temperature: 0.1,
        maxTokens: 400,
        callerType: 'agent',
        callerName: 'marketing-swarm-agent',
        conversationId: state.metadata?.sessionId,
        dataClassification: 'marketing',
        // Pass user preferences
        ...llmPreferences,
      },
    );

    const taskAnalysis: MarketingTask = JSON.parse(analysisResponse);

    progressCallback?.(
      'Analyzing marketing task',
      0,
      'completed',
      `Task identified as ${taskAnalysis.complexity} ${taskAnalysis.type}`,
    );

    return {
      ...state,
      taskAnalysis,
      metadata: {
        ...state.metadata,
        analysis_step: 'completed',
        task_complexity: taskAnalysis.complexity,
        content_types_needed: taskAnalysis.requirements.content_types.length,
      },
    };
  } catch (error) {
    // Fallback analysis
    return {
      ...state,
      taskAnalysis: {
        type: 'campaign_creation',
        complexity: 'moderate',
        requirements: {
          content_types: ['blog_post', 'social_media'],
          target_audience: 'general business audience',
          goals: ['increase_awareness', 'drive_engagement'],
        },
      },
      metadata: {
        ...state.metadata,
        analysis_step: 'fallback',
        analysis_error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Step 2: Select appropriate specialist agents based on task requirements
 */
async function selectAgentTeam(
  state: SwarmWorkflowState,
  _llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<SwarmWorkflowState> {
  // Small delay to ensure previous step's completion is processed
  await new Promise(resolve => setTimeout(resolve, 100));

  progressCallback?.(
    'Selecting agent team',
    1,
    'in_progress',
    'Choosing specialist agents based on requirements',
  );
  if (!state.taskAnalysis) {
    throw new Error('Task analysis required before agent selection');
  }

  const { content_types, goals } = state.taskAnalysis.requirements;
  const selectedAgents: AgentSpecialist[] = [];

  // Content creation agents based on content types
  if (
    content_types.includes('blog_post') ||
    content_types.includes('article') ||
    content_types.includes('blog') ||
    content_types.includes('content')
  ) {
    selectedAgents.push(SPECIALIST_AGENTS['blog_writer']!);
  }
  if (
    content_types.includes('social_media') ||
    content_types.includes('social') ||
    content_types.includes('campaign') ||
    content_types.includes('marketing')
  ) {
    selectedAgents.push(SPECIALIST_AGENTS['social_media_specialist']!);
  }
  if (content_types.includes('email') || content_types.includes('newsletter')) {
    selectedAgents.push(SPECIALIST_AGENTS['email_specialist']!);
  }

  // Always include evaluation agents for quality assurance
  selectedAgents.push(SPECIALIST_AGENTS['seo_specialist']!);
  selectedAgents.push(SPECIALIST_AGENTS['brand_voice_analyst']!);

  // Add conversion optimizer if goals include conversion/sales
  if (
    goals.some(
      (goal) =>
        goal.includes('conversion') ||
        goal.includes('sales') ||
        goal.includes('lead'),
    )
  ) {
    selectedAgents.push(SPECIALIST_AGENTS['conversion_optimizer']!);
  }

  // Ensure we always have at least one content creator for general marketing requests
  const hasContentCreator = selectedAgents.some(
    (agent) => agent.role === 'content_creator',
  );
  if (!hasContentCreator) {
    selectedAgents.push(SPECIALIST_AGENTS['blog_writer']!);
    selectedAgents.push(SPECIALIST_AGENTS['social_media_specialist']!);
  }

  // Ensure minimum team size
  if (selectedAgents.length < 3) {
    selectedAgents.push(
      SPECIALIST_AGENTS['blog_writer']!,
      SPECIALIST_AGENTS['seo_specialist']!,
    );
  }

  progressCallback?.(
    'Selecting agent team',
    1,
    'completed',
    `Selected ${selectedAgents.length} specialist agents: ${selectedAgents.map((a) => a.name).join(', ')}`,
  );

  return {
    ...state,
    selectedAgents,
    metadata: {
      ...state.metadata,
      agent_selection_step: 'completed',
      selected_agent_count: selectedAgents.length,
      agent_names: selectedAgents.map((a) => a.name),
    },
  };
}

/**
 * Step 3: Coordinate content creation across selected agents
 */
async function coordinateContentCreation(
  state: SwarmWorkflowState,
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<SwarmWorkflowState> {
  progressCallback?.(
    'Coordinating content creation',
    2,
    'in_progress',
    'Content creators generating specialized content',
  );
  const agentOutputs = new Map();
  const contentCreators = state.selectedAgents.filter(
    (agent) => agent.role === 'content_creator',
  );

  // Ensure we have content creators - if not, treat all agents as content creators
  const agentsToUse =
    contentCreators.length > 0 ? contentCreators : state.selectedAgents;

  for (const agent of agentsToUse) {
    try {
      const contentPrompt = `${state.originalRequest}

Task Requirements:
- Target Audience: ${state.taskAnalysis?.requirements.target_audience}
- Goals: ${state.taskAnalysis?.requirements.goals.join(', ')}
- Content Type: Focus on your specialty (${agent.specialties.join(', ')})

Create high-quality, actionable marketing content according to your expertise. Make it compelling and ready to use.`;

      const content = await llmService.generateResponse(
        agent.systemPrompt,
        contentPrompt,
        { 
          temperature: agent.temperature, 
          maxTokens: 1500,
          callerType: 'agent',
          callerName: 'marketing-swarm-agent',
          conversationId: state.metadata?.sessionId,
          dataClassification: 'marketing',
        },
      );

      agentOutputs.set(agent.name, {
        content,
        agent_role: agent.role,
        specialties: agent.specialties,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      agentOutputs.set(agent.name, {
        content: `Error generating content: ${error instanceof Error ? error.message : String(error)}`,
        agent_role: agent.role,
        error: true,
      });
    }
  }

  progressCallback?.(
    'Coordinating content creation',
    2,
    'completed',
    `Generated ${agentOutputs.size} content pieces from specialist agents`,
  );

  return {
    ...state,
    agentOutputs,
    metadata: {
      ...state.metadata,
      content_creation_step: 'completed',
      content_pieces_generated: agentOutputs.size,
    },
  };
}

/**
 * Step 4: Evaluate and optimize content through specialist agents
 */
async function evaluateAndOptimize(
  state: SwarmWorkflowState,
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<SwarmWorkflowState> {
  progressCallback?.(
    'Evaluating and optimizing',
    3,
    'in_progress',
    'Specialist agents analyzing and optimizing content',
  );
  const evaluationResults = new Map();
  const evaluators = state.selectedAgents.filter(
    (agent) => agent.role === 'evaluator' || agent.role === 'optimizer',
  );

  // Collect all content for evaluation
  const allContent = Array.from(state.agentOutputs.entries())
    .map(([agentName, output]) => `${agentName}:\n${output.content}`)
    .join('\n\n---\n\n');

  for (const evaluator of evaluators) {
    try {
      const evaluationPrompt = `Evaluate and provide optimization recommendations for this content:

${allContent}

Original Request: ${state.originalRequest}

As a ${evaluator.name}, focus on your specialties: ${evaluator.specialties.join(', ')}

Provide:
1. Overall assessment (score 1-10)
2. Specific strengths
3. Areas for improvement
4. Actionable optimization recommendations
5. Priority level for changes (high/medium/low)

Format as JSON:
{
  "score": 8,
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "recommendations": ["rec1", "rec2"],
  "priority": "high"
}`;

      const evaluation = await llmService.generateResponse(
        evaluator.systemPrompt,
        evaluationPrompt,
        { 
          temperature: evaluator.temperature, 
          maxTokens: 800,
          callerType: 'agent',
          callerName: 'marketing-swarm-agent',
          conversationId: state.metadata?.sessionId,
          dataClassification: 'marketing',
        },
      );

      const evaluationData = JSON.parse(evaluation);
      evaluationResults.set(evaluator.name, {
        ...evaluationData,
        evaluator_specialties: evaluator.specialties,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      evaluationResults.set(evaluator.name, {
        score: 5,
        error: error instanceof Error ? error.message : String(error),
        recommendations: [`Review needed due to evaluation error`],
      });
    }
  }

  const avgScore =
    Array.from(evaluationResults.values()).reduce(
      (acc, result) => acc + (result.score || 5),
      0,
    ) / evaluationResults.size;

  progressCallback?.(
    'Evaluating and optimizing',
    3,
    'completed',
    `Completed ${evaluationResults.size} evaluations with average score ${avgScore.toFixed(1)}/10`,
  );

  return {
    ...state,
    evaluationResults,
    metadata: {
      ...state.metadata,
      evaluation_step: 'completed',
      evaluations_completed: evaluationResults.size,
      average_score: avgScore,
    },
  };
}

/**
 * Step 5: Synthesize final optimized content package
 */
async function synthesizeFinalContent(
  state: SwarmWorkflowState,
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<SwarmWorkflowState> {
  progressCallback?.(
    'Synthesizing final content',
    4,
    'in_progress',
    'Creating comprehensive optimized content package',
  );
  const allContent = Array.from(state.agentOutputs.entries());
  const allEvaluations = Array.from(state.evaluationResults.entries());

  const synthesisPrompt = `Create a final, optimized content package for this marketing request:

ORIGINAL REQUEST:
"${state.originalRequest}"

AGENT OUTPUTS:
${allContent.map(([name, output]) => `${name}:\n${output.content}`).join('\n\n')}

EVALUATIONS:
${allEvaluations
  .map(
    ([name, evaluation]) =>
      `${name} (Score: ${evaluation.score}/10):\nRecommendations: ${evaluation.recommendations?.join(', ') || 'None'}`,
  )
  .join('\n\n')}

Create a comprehensive MARKETING CONTENT PACKAGE that directly addresses the original request:
1. Incorporates the best elements from each specialist agent
2. Implements evaluation recommendations for maximum impact
3. Provides ready-to-use marketing content that fulfills the specific request
4. Includes actionable recommendations and next steps

IMPORTANT: The content MUST be specifically about what was requested ("${state.originalRequest}"), not generic marketing examples.

Format the response as a well-structured marketing content package with clear sections for each content type. Include headlines, copy, and implementation guidance. Make it immediately useful for marketing execution.`;

  try {
    const finalPackage = await llmService.generateResponse(
      `You are a senior marketing coordinator. Synthesize agent outputs into a cohesive, optimized MARKETING CONTENT PACKAGE that directly addresses the user's specific request. Create ready-to-use marketing materials that fulfill the exact needs stated in the original request. Do not create generic examples - focus on the actual topic/product/service requested.`,
      synthesisPrompt,
      { 
        temperature: 0.4, 
        maxTokens: 2500,
        callerType: 'agent',
        callerName: 'marketing-swarm-agent',
        conversationId: state.metadata?.sessionId,
        dataClassification: 'marketing',
      },
    );

    // Try to parse as JSON, but if it fails, use the raw content
    let finalResult;
    try {
      const parsed = JSON.parse(finalPackage);
      // If the parsed result has a 'content' field (from LLM response wrapper), extract it
      if (parsed.content) {
        // Extract content pieces from agent outputs
        const contentPieces: Record<string, any> = {};
        state.agentOutputs.forEach((value, key) => {
          contentPieces[key] = typeof value === 'object' && value.content
            ? value.content
            : value;
        });

        finalResult = {
          marketing_content_package: parsed.content,
          content_pieces: contentPieces,
          evaluations: Object.fromEntries(state.evaluationResults),
          ready_to_use: true,
        };
      } else {
        finalResult = parsed;
      }
    } catch {
      // If JSON parsing fails, format the content as marketing package
      // Extract just the content strings from agent outputs
      const contentPieces: Record<string, any> = {};
      state.agentOutputs.forEach((value, key) => {
        contentPieces[key] = typeof value === 'object' && value.content
          ? value.content
          : value;
      });

      finalResult = {
        marketing_content_package: finalPackage,
        content_pieces: contentPieces,
        evaluations: Object.fromEntries(state.evaluationResults),
        ready_to_use: true,
      };
    }
    progressCallback?.(
      'Synthesizing final content',
      4,
      'completed',
      'Final optimized content package ready',
    );

    return {
      ...state,
      finalContent: finalResult,
      metadata: {
        ...state.metadata,
        synthesis_step: 'completed',
        workflow_status: 'completed',
      },
    };
  } catch (error) {
    // Fallback to organized raw outputs - ensure content is properly extracted
    const contentPieces: Record<string, any> = {};
    state.agentOutputs.forEach((value, key) => {
      // Extract just the content string if it's nested in an object
      contentPieces[key] = typeof value === 'object' && value.content
        ? value.content
        : value;
    });

    return {
      ...state,
      finalContent: {
        marketing_content_package:
          'Marketing content generation encountered an error, but here are the individual pieces created by our specialist agents:',
        content_pieces: contentPieces,
        evaluations: Object.fromEntries(state.evaluationResults),
        synthesis_error: error instanceof Error ? error.message : String(error),
        note: 'Each content piece above was created by a specialist agent and can be used individually for your marketing efforts.',
      },
      metadata: {
        ...state.metadata,
        synthesis_step: 'fallback',
        workflow_status: 'completed_with_errors',
      },
    };
  }
}

/**
 * Main Marketing Swarm Workflow
 */
async function executeMarketingSwarm(
  userMessage: string,
  llmService: any,
  sessionId?: string,
  llmPreferences?: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<{ response: string; metadata: Record<string, any> }> {
  let state: SwarmWorkflowState = {
    originalRequest: userMessage,
    taskAnalysis: null,
    selectedAgents: [],
    agentOutputs: new Map(),
    evaluationResults: new Map(),
    finalContent: null,
    metadata: {
      workflow_id: `swarm_${Date.now()}`,
      sessionId: sessionId || 'unknown',
      steps_completed: [],
      start_time: new Date().toISOString(),
    },
  };

  try {
    // Step 1: Analyze marketing task
    state = await analyzeMarketingTask(
      state,
      llmService,
      llmPreferences,
      progressCallback,
    );
    state.metadata.steps_completed.push('task_analysis');

    // Step 2: Select agent team
    state = await selectAgentTeam(state, llmService, progressCallback);
    state.metadata.steps_completed.push('agent_selection');

    // Step 3: Coordinate content creation
    state = await coordinateContentCreation(
      state,
      llmService,
      progressCallback,
    );
    state.metadata.steps_completed.push('content_creation');

    // Step 4: Evaluate and optimize
    state = await evaluateAndOptimize(state, llmService, progressCallback);
    state.metadata.steps_completed.push('evaluation');

    // Step 5: Synthesize final package
    state = await synthesizeFinalContent(state, llmService, progressCallback);
    state.metadata.steps_completed.push('synthesis');

    // Format the response in a user-friendly way instead of raw JSON
    const formattedResponse =
      typeof state.finalContent === 'object' &&
      state.finalContent.marketing_content_package
        ? `# 📋 Marketing Content Package

${(() => {
  const pkg = state.finalContent.marketing_content_package;
  // If it's an object with a 'content' field (from LLM response), extract just the content
  if (typeof pkg === 'object' && pkg.content) {
    return pkg.content;
  }
  // If it's already a string, use it directly
  if (typeof pkg === 'string') {
    return pkg;
  }
  // Otherwise format the object (but exclude metadata)
  if (typeof pkg === 'object') {
    const { metadata, ...contentOnly } = pkg;
    return JSON.stringify(contentOnly, null, 2);
  }
  return pkg;
})()}

## Individual Content Pieces

${Object.entries(state.finalContent.content_pieces || {})
  .map(
    ([agent, piece]: [string, any]) => {
      let content = piece;
      // Extract content if it's an object with a 'content' field
      if (typeof piece === 'object' && piece.content) {
        content = piece.content;
      } else if (typeof piece === 'object' && piece.metadata) {
        // If there's metadata, exclude it
        const { metadata, ...contentOnly } = piece;
        content = JSON.stringify(contentOnly, null, 2);
      } else if (typeof piece === 'object') {
        content = JSON.stringify(piece, null, 2);
      }
      return `### ${agent}
${content}
`;
    }
  )
  .join('\n')}`
        : JSON.stringify(state.finalContent, null, 2);

    return {
      response: formattedResponse,
      metadata: {
        ...state.metadata,
        workflow_status: 'completed',
        total_steps: 5,
        agents_utilized: state.selectedAgents.length,
        end_time: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      response: JSON.stringify(
        {
          error: 'Marketing swarm workflow failed',
          partial_results: {
            task_analysis: state.taskAnalysis,
            selected_agents: state.selectedAgents.map((a) => a.name),
            generated_content: Object.fromEntries(state.agentOutputs),
          },
        },
        null,
        2,
      ),
      metadata: {
        ...state.metadata,
        workflow_status: 'error',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main agent function export
 */
export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, llmService, metadata, progressCallback } =
    params;
  const startTime = Date.now();

  // Extract LLM preferences from metadata if available
  const llmPreferences = metadata?.llmPreferences;

  try {
    const { response, metadata: workflowMetadata } =
      await executeMarketingSwarm(
        userMessage,
        llmService,
        sessionId,
        llmPreferences,
        progressCallback,
      );

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      response,
      metadata: {
        agentName: 'marketing-swarm',
        processingType: 'multi-agent-orchestration',
        processingTime,
        sessionId,
        toolsUsed: ['llm-service', 'langgraph', 'agent-coordination'],
        responseType: 'comprehensive-content-package',
        swarm_workflow: workflowMetadata,
      },
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      response: `Marketing swarm orchestration failed: ${errorMessage}. The system attempted to coordinate multiple specialist agents for comprehensive content creation but encountered an error.`,
      metadata: {
        agentName: 'marketing-swarm',
        processingType: 'error-fallback',
        processingTime,
        sessionId,
        error: errorMessage,
        toolsUsed: ['llm-service'],
      },
    };
  }
}
