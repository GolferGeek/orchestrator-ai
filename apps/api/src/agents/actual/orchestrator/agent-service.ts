import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '@agents/base/implementations/base-services/a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { SessionsService } from '../../../sessions/sessions.service';
import { SupabaseService } from '../../../supabase/supabase.service';

// Import the modular sub-services
import { ConversationContextService } from './services/conversation-context.service';
import { DelegationService } from './services/delegation.service';
import { ResponseGenerationService } from './services/response-generation.service';

interface AvailableAgent {
  name: string;
  description: string;
  path: string;
  url: string;
  type: string;
  capabilities: string[];
  metadata?: {
    name?: string;
    display_name?: string;
    description?: string;
  };
}

@Injectable()
export class OrchestratorService extends A2AAgentBaseService {
  private readonly orchestratorLogger = new Logger(OrchestratorService.name);
  private readonly baseApiUrl: string;
  private availableAgents: AvailableAgent[] = [];

  constructor(
    httpService: HttpService,
    private readonly llmService: LLMService,
    private readonly sessionsService: SessionsService,
    private readonly supabaseService: SupabaseService,
    // Inject the modular sub-services
    private readonly conversationContextService: ConversationContextService,
    private readonly delegationService: DelegationService,
    private readonly responseGenerationService: ResponseGenerationService,
  ) {
    super(httpService);
    // Get base API URL from environment variables
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '4000';
    this.baseApiUrl = `http://${apiHost}:${apiPort}`;

    // Debug dependency injection
    this.orchestratorLogger.log(
      `OrchestratorService constructor: sessionsService=${!!this.sessionsService}, llmService=${!!this.llmService}, supabaseService=${!!this.supabaseService}`,
    );
    this.orchestratorLogger.log(
      `OrchestratorService services: conversationContextService=${!!this.conversationContextService}, delegationService=${!!this.delegationService}, responseGenerationService=${!!this.responseGenerationService}`,
    );
  }

  /**
   * Initialize the orchestrator after module initialization
   */
  async onModuleInit() {
    this.orchestratorLogger.log('Orchestrator agent initializing...');

    // Postpone agent pool initialization to avoid circular startup dependencies
    // The server needs to be fully started before we can call its agent-pool endpoint
    setTimeout(async () => {
      try {
        await this.initializeAvailableAgents();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.orchestratorLogger.warn(
          'Failed to initialize agent pool during startup, will use fallback agents:',
          errorMessage,
        );
      }
    }, 2000); // Wait 2 seconds for server to be fully up

    this.orchestratorLogger.log(
      'Orchestrator agent initialization completed (agent pool will be loaded asynchronously)',
    );
  }

  /**
   * Execute task using the centralized LLM service
   * The orchestrator determines whether to delegate to specialists or respond conversationally
   */
  public async executeTask(method: string, params: any): Promise<any> {
    this.orchestratorLogger.log(
      `Orchestrator processing request with method: ${method}`,
    );
    this.orchestratorLogger.log(
      `Full params object:`,
      JSON.stringify(params, null, 2),
    );

    // Extract user message and conversation history from params
    // Handle both direct params and nested params structure
    let actualParams = params;
    if (params.params) {
      // If we have a nested params structure, use the inner params
      actualParams = params.params;
    }

    // Handle both userMessage (from direct requests) and message (from frontend)
    const userMessage =
      actualParams.userMessage ||
      actualParams.message ||
      params.userMessage ||
      params.message ||
      '';
    const sessionId =
      actualParams.sessionId ||
      actualParams.session_id ||
      params.sessionId ||
      params.session_id ||
      null;
    const conversationHistory =
      actualParams.conversationHistory ||
      actualParams.conversation_history ||
      params.conversationHistory ||
      params.conversation_history ||
      [];

    // Extract LLM preferences for enhanced response generation
    const llmPreferences = {
      providerId:
        actualParams.providerId ||
        actualParams.provider_id ||
        params.providerId ||
        params.provider_id,
      modelId:
        actualParams.modelId ||
        actualParams.model_id ||
        params.modelId ||
        params.model_id,
      cidafmOptions:
        actualParams.cidafmOptions ||
        actualParams.cidafm_options ||
        params.cidafmOptions ||
        params.cidafm_options,
      temperature: actualParams.temperature || params.temperature,
      maxTokens:
        actualParams.maxTokens ||
        actualParams.max_tokens ||
        params.maxTokens ||
        params.max_tokens,
    };

    // Extract user authentication context - check both levels
    const currentUser = params.currentUser || actualParams.currentUser || null;
    const authToken = params.authToken || actualParams.authToken || null;

    this.orchestratorLogger.log(
      `Processing message: "${userMessage}" with ${conversationHistory.length} history messages`,
    );
    this.orchestratorLogger.log(
      `LLM preferences: provider=${llmPreferences.providerId || 'default'}, model=${llmPreferences.modelId || 'default'}, CIDAFM=${!!llmPreferences.cidafmOptions}`,
    );
    if (conversationHistory.length > 0) {
      this.orchestratorLogger.log(
        `Conversation history:`,
        JSON.stringify(conversationHistory, null, 2),
      );
    }
    this.orchestratorLogger.log(
      `Auth context received: currentUser=${!!currentUser}, authToken=${!!authToken}`,
    );
    if (authToken) {
      this.orchestratorLogger.log(
        `Auth token length: ${authToken.length}, first 20 chars: ${authToken.substring(0, 20)}...`,
      );
    } else {
      this.orchestratorLogger.warn(
        'No auth token received in orchestrator params',
      );
    }

    // Refresh available agents with current auth token
    if (authToken) {
      this.orchestratorLogger.log(
        '🔄 Refreshing agent pool with current auth token...',
      );
      await this.initializeAvailableAgents(authToken);
    } else {
      this.orchestratorLogger.warn(
        '⚠️ No auth token available - using cached agent pool',
      );
    }

    // Save the user message to the database first
    let userMessageId = null;
    // Only save user message if not handling persistence elsewhere
    const skipMessagePersistence = params?.skipMessagePersistence === true;
    if (
      sessionId &&
      userMessage &&
      currentUser &&
      authToken &&
      !skipMessagePersistence
    ) {
      try {
        const userMessageRecord = await this.sessionsService.addMessage(
          sessionId,
          {
            role: 'user',
            content: userMessage,
            metadata: {
              processedBy: 'orchestrator',
              receivedAt: new Date().toISOString(),
              // User information
              userId: currentUser.id,
              userEmail: currentUser.email,
              userName:
                currentUser.user_metadata?.full_name ||
                currentUser.user_metadata?.name ||
                currentUser.email?.split('@')[0] ||
                'Unknown User',
              // Processing agent information
              processingAgentId: `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}`,
              processingAgentName: this.getAgentName(),
              processingAgentType: this.getAgentType(),
              processingAgentDisplayName: this.getAgentName(),
              // Message type
              messageType: 'user_input',
            },
          },
          currentUser,
          authToken,
        );
        userMessageId = userMessageRecord.id;
        this.orchestratorLogger.log(
          `User message saved to database with ID: ${userMessageId} for user ${currentUser.id}`,
        );
      } catch (error) {
        this.orchestratorLogger.error(
          'Failed to save user message to database:',
          error,
        );
        // Continue processing even if database save fails
      }
    } else if (sessionId && userMessage) {
      this.orchestratorLogger.warn(
        'Missing user authentication context - cannot save message to database with proper RLS',
      );
    }

    // Check for UI commands that should trigger modals
    if (userMessage.startsWith('__UI_COMMAND__:')) {
      return this.handleUICommand(userMessage);
    }

    // Check if this is a conversational capability request (typed by user)
    const lowerMessage = userMessage.toLowerCase();
    const isCapabilityRequest =
      lowerMessage.includes('what can you do') ||
      lowerMessage.includes('what can') ||
      lowerMessage.includes('capabilities') ||
      lowerMessage.includes('what you specialize in') ||
      lowerMessage.includes('introduce yourself') ||
      (lowerMessage.includes('show me') && lowerMessage.includes('agents')) ||
      (lowerMessage.includes('view') && lowerMessage.includes('agents')) ||
      lowerMessage.includes('available agents') ||
      lowerMessage.includes('list agents') ||
      lowerMessage.includes('tell me what agents');

    if (isCapabilityRequest) {
      // For conversational requests, return text responses for chat
      const continuityCheck =
        this.conversationContextService.shouldContinueWithSameAgent(
          userMessage,
          conversationHistory,
        );
      const stickyAgent = continuityCheck.shouldContinue
        ? continuityCheck.agentName
        : null;

      if (stickyAgent) {
        // Return text-based agent capabilities for chat
        return this.createStickyAgentCapabilitiesResponse(stickyAgent);
      } else {
        // Return text-based agent list for chat
        return this.createAgentListResponse();
      }
    }

    // Check if this is a return to orchestrator request
    const isReturnToOrchestratorRequest =
      lowerMessage.includes('return to orchestrator') ||
      lowerMessage.includes('back to orchestrator') ||
      lowerMessage.includes('switch to orchestrator') ||
      lowerMessage === 'orchestrator';

    if (isReturnToOrchestratorRequest) {
      return this.responseGenerationService.generateDirectResponse(
        userMessage,
        this.availableAgents,
        conversationHistory,
        'Welcome back!',
      );
    }

    // Enhanced sticky agent context check
    const continuityDecision =
      this.conversationContextService.shouldContinueWithSameAgent(
        userMessage,
        conversationHistory,
      );
    this.orchestratorLogger.log(
      `🔄 Sticky agent continuity check: shouldContinue=${continuityDecision.shouldContinue}, agent=${continuityDecision.agentName}, confidence=${continuityDecision.confidence}, reason="${continuityDecision.reason}"`,
    );

    // Use LLM to decide whether to delegate or respond directly
    let response;
    try {
      // First priority: Check for sticky agent continuation with high confidence
      if (
        continuityDecision.shouldContinue &&
        continuityDecision.confidence &&
        continuityDecision.confidence > 0.7
      ) {
        this.orchestratorLogger.log(
          `🎯 High-confidence sticky agent continuation to ${continuityDecision.agentName}: "${userMessage}"`,
        );

        // Generate context handoff for seamless transition
        const agentInteractions =
          this.conversationContextService.analyzeAgentInteractions(
            conversationHistory,
          );

        response = await this.delegateToAgent(
          continuityDecision.agentName!,
          userMessage,
          sessionId,
          authToken,
          llmPreferences, // User preferences for content processing
          {
            stickyContext: true,
            continuityReason: continuityDecision.reason,
            confidence: continuityDecision.confidence,
            agentContext: agentInteractions.currentAgentContext,
          },
        );
      }
      // Second priority: Check if this is a content creation request and if Hiverarchy is available
      else if (this.isContentCreationRequest(userMessage)) {
        const hiverarchyAgent = this.availableAgents.find(
          (agent) => agent.name === 'hiverarchy',
        );

        if (hiverarchyAgent) {
          this.orchestratorLogger.log(
            `🎯 Content creation request detected, delegating to Hiverarchy: "${userMessage}"`,
          );
          response = await this.delegateToAgent(
            'hiverarchy',
            userMessage,
            sessionId,
            authToken,
            llmPreferences,
          );
        } else {
          // Use enhanced delegation service with hybrid rule-based + LLM analysis
          const analysis = await this.delegationService.analyzeAndSelectAgent(
            userMessage,
            this.availableAgents,
            conversationHistory,
          );

          if (analysis) {
            if (analysis.action === 'delegate' && analysis.selectedAgent) {
              response = await this.delegateToAgent(
                analysis.selectedAgent.name,
                userMessage,
                sessionId,
                authToken,
                llmPreferences, // User preferences for content processing
                {
                  selectionReasoning: analysis.reasoning,
                  systemSelection: true,
                },
              );
            } else if (analysis.action === 'clarify') {
              response =
                this.responseGenerationService.generateClarificationRequest(
                  userMessage,
                  this.availableAgents,
                  analysis.reasoning,
                );
            } else {
              // respond_directly
              response =
                await this.responseGenerationService.generateDirectResponse(
                  userMessage,
                  this.availableAgents,
                  conversationHistory,
                );
            }
          } else {
            // Fallback if analysis fails
            response =
              await this.responseGenerationService.generateDirectResponse(
                userMessage,
                this.availableAgents,
                conversationHistory,
              );
          }
        }
      }
      // Third priority: Check for medium-confidence sticky agent continuation
      else if (
        continuityDecision.shouldContinue &&
        continuityDecision.confidence &&
        continuityDecision.confidence > 0.5
      ) {
        this.orchestratorLogger.log(
          `🎯 Medium-confidence sticky agent continuation to ${continuityDecision.agentName}: "${userMessage}"`,
        );

        response = await this.delegateToAgent(
          continuityDecision.agentName!,
          userMessage,
          sessionId,
          authToken,
          llmPreferences, // User preferences for content processing
          {
            stickyContext: true,
            continuityReason: continuityDecision.reason,
            confidence: continuityDecision.confidence,
          },
        );
      }
      // Default: Use enhanced delegation service with hybrid analysis
      else {
        const analysis = await this.delegationService.analyzeAndSelectAgent(
          userMessage,
          this.availableAgents,
          conversationHistory,
        );

        if (analysis) {
          if (analysis.action === 'delegate' && analysis.selectedAgent) {
            response = await this.delegateToAgent(
              analysis.selectedAgent.name,
              userMessage,
              sessionId,
              authToken,
              llmPreferences, // User preferences for content processing
              {
                selectionReasoning: analysis.reasoning,
                systemSelection: true,
              },
            );
          } else if (analysis.action === 'clarify') {
            response =
              this.responseGenerationService.generateClarificationRequest(
                userMessage,
                this.availableAgents,
                analysis.reasoning,
              );
          } else {
            // respond_directly
            response =
              await this.responseGenerationService.generateDirectResponse(
                userMessage,
                this.availableAgents,
                conversationHistory,
              );
          }
        } else {
          // Fallback if analysis fails
          response =
            await this.responseGenerationService.generateDirectResponse(
              userMessage,
              this.availableAgents,
              conversationHistory,
            );
        }
      }
    } catch (error) {
      this.orchestratorLogger.error('Error processing with LLM:', error);
      // Fallback: simple keyword-based routing
      response = await this.handleFallbackRouting(
        userMessage,
        sessionId,
        authToken,
      );
    }

    // Save the assistant response to the database
    if (
      sessionId &&
      response?.response &&
      currentUser &&
      authToken &&
      !skipMessagePersistence
    ) {
      try {
        // Determine the responding agent information
        const isResponseFromOrchestrator = !response.metadata?.delegatedTo;
        const respondingAgentName = isResponseFromOrchestrator
          ? this.getAgentName()
          : response.metadata?.agentName ||
            response.metadata?.delegatedTo ||
            'Unknown Agent';
        const respondingAgentType = isResponseFromOrchestrator
          ? this.getAgentType()
          : 'specialists';
        const respondingAgentId = isResponseFromOrchestrator
          ? `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}`
          : `specialists_${(response.metadata?.delegatedTo || 'unknown').toLowerCase().replace(/\s+/g, '_')}`;

        // Extract LLM options from response metadata
        const llmOptions = response.metadata?.llmOptions || null;
        const userRequestedLLM =
          llmPreferences.providerId || llmPreferences.modelId;

        const assistantMessageRecord = await this.sessionsService.addMessage(
          sessionId,
          {
            role: 'assistant',
            content: response.response,
            metadata: {
              ...response.metadata,
              processedBy: 'orchestrator',
              respondedAt: new Date().toISOString(),
              userMessageId: userMessageId,
              // User information
              userId: currentUser.id,
              userEmail: currentUser.email,
              userName:
                currentUser.user_metadata?.full_name ||
                currentUser.user_metadata?.name ||
                currentUser.email?.split('@')[0] ||
                'Unknown User',
              // Responding agent information
              respondingAgentId: respondingAgentId,
              respondingAgentName: respondingAgentName,
              respondingAgentType: respondingAgentType,
              respondingAgentDisplayName: respondingAgentName,
              // Processing orchestrator information (always the orchestrator since it handles all routing)
              processingAgentId: `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}`,
              processingAgentName: this.getAgentName(),
              processingAgentType: this.getAgentType(),
              processingAgentDisplayName: this.getAgentName(),
              // Message type
              messageType: isResponseFromOrchestrator
                ? 'orchestrator_response'
                : 'delegated_agent_response',
              isDelegated: !isResponseFromOrchestrator,
              // LLM information - ensure it's always present
              llmOptions: llmOptions || {
                provider: 'unknown',
                model: 'unknown',
                note: 'LLM metadata not available from response',
              },
              // User's requested LLM preferences (if any)
              ...(userRequestedLLM && {
                userLLMPreferences: {
                  providerId: llmPreferences.providerId,
                  modelId: llmPreferences.modelId,
                  temperature: llmPreferences.temperature,
                  maxTokens: llmPreferences.maxTokens,
                  hasCidafmOptions: !!llmPreferences.cidafmOptions,
                },
              }),
            },
          },
          currentUser,
          authToken,
        );
        this.orchestratorLogger.log(
          `Assistant message saved to database with ID: ${assistantMessageRecord.id} for user ${currentUser.id}`,
        );
      } catch (error) {
        this.orchestratorLogger.error(
          'Failed to save assistant message to database:',
          error,
        );
        // Continue even if database save fails
      }
    } else if (sessionId && response?.response) {
      this.orchestratorLogger.warn(
        'Missing user authentication context - cannot save assistant message to database with proper RLS',
      );
    }

    // Mark task as completed if we have the required context
    const taskId = params.taskId || params.params?.taskId;
    const taskUser = params.currentUser || params.params?.currentUser;
    
    if (taskId && taskUser?.id && response) {
      try {
        await this.completeTask(taskId, taskUser.id, response);
        this.orchestratorLogger.debug(`Task ${taskId} marked as completed`);
      } catch (error) {
        this.orchestratorLogger.warn(`Failed to mark task ${taskId} as completed:`, error);
      }
    } else {
      this.orchestratorLogger.debug('Missing taskId or currentUser context - cannot mark task as completed', {
        hasTaskId: !!taskId,
        hasCurrentUser: !!taskUser,
        hasResponse: !!response
      });
    }

    return response;
  }

  /**
   * Create formatted agent list response for the frontend
   */
  private createAgentListResponse(): any {
    if (!this.availableAgents || this.availableAgents.length === 0) {
      return this.createResponse(
        'No specialist agents are currently available.',
      );
    }

    // Filter out orchestrator agents and remove duplicates based on name
    const uniqueAgents = new Map();

    this.availableAgents.forEach((agent) => {
      // Skip orchestrator agents
      if (agent.name.toLowerCase().includes('orchestrator')) {
        return;
      }

      // Extract the display name from agent metadata or use the directory name
      let displayName = agent.name;

      // Try to get a more user-friendly name from the agent's metadata
      if (agent.metadata) {
        displayName =
          agent.metadata.name || agent.metadata.display_name || agent.name;
      }

      // Clean up the name - remove underscores, capitalize properly
      const cleanName = displayName
        .replace(/_/g, ' ')
        .split(' ')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(' ');

      // Use the clean name as the key to avoid duplicates
      if (!uniqueAgents.has(cleanName)) {
        uniqueAgents.set(cleanName, {
          name: cleanName,
          description: agent.description || `${cleanName} specialist agent`, // Use agent.description directly from YAML
          originalAgent: agent,
        });
      }
    });

    if (uniqueAgents.size === 0) {
      return this.createResponse(
        'No specialist agents are currently available.',
      );
    }

    // Format the response for the frontend to create clickable links
    // The frontend expects "Agent Name: <name>, Description: <desc>" format to make names clickable
    let agentListText = 'Here are the agents I can work with:\n\n';

    uniqueAgents.forEach((agentInfo, cleanName) => {
      agentListText += `- Agent Name: ${cleanName}, Description: ${agentInfo.description}\n`;
    });

    // Mark this as an agent list response for the frontend to process
    return {
      success: true,
      response: agentListText,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        contentType: 'agentListFromOrchestrator',
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle UI commands that should trigger modals instead of conversational responses
   */
  private handleUICommand(userMessage: string): any {
    this.orchestratorLogger.log(`Handling UI command: ${userMessage}`);

    if (userMessage === '__UI_COMMAND__:SHOW_AGENT_LIST_MODAL') {
      // UI click for agent list modal
      return this.createAgentListModalResponse();
    }

    if (
      userMessage.startsWith('__UI_COMMAND__:SHOW_AGENT_CAPABILITIES_MODAL:')
    ) {
      // UI click for specific agent capabilities modal
      const agentName = userMessage
        .replace('__UI_COMMAND__:SHOW_AGENT_CAPABILITIES_MODAL:', '')
        .trim();
      this.orchestratorLogger.log(
        `UI command for agent capabilities: ${agentName}`,
      );
      return this.createAgentCapabilitiesModalResponse(agentName);
    }

    // Unknown UI command, fallback to agent list modal
    this.orchestratorLogger.warn(`Unknown UI command: ${userMessage}`);
    return this.createAgentListModalResponse();
  }

  /**
   * Create structured agent list response for modal
   */
  private createAgentListModalResponse(): any {
    if (!this.availableAgents || this.availableAgents.length === 0) {
      return {
        success: true,
        response: 'No specialist agents are currently available.',
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator Agent',
          contentType: 'message',
          processedAt: new Date().toISOString(),
        },
      };
    }

    // Filter and format agents for modal
    const agentList = this.availableAgents
      .filter((agent) => !agent.name.toLowerCase().includes('orchestrator'))
      .map((agent) => {
        // Clean up the name - remove underscores, capitalize properly
        const cleanName = agent.name
          .replace(/_/g, ' ')
          .split(' ')
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(' ');

        return {
          name: cleanName,
          description: agent.description || `${cleanName} specialist agent`,
          originalName: agent.name,
          type: agent.type,
          capabilities: agent.capabilities || [],
        };
      });

    return {
      success: true,
      response: 'Here are the specialists I can connect you with:', // Fallback text
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        contentType: 'agentListModal',
        processedAt: new Date().toISOString(),
        agentList: agentList, // Structured data for modal
      },
    };
  }

  /**
   * Create structured agent capabilities response for modal
   */
  private createAgentCapabilitiesModalResponse(stickyAgentName: string): any {
    // Find the agent in the available agents list
    const agent = this.availableAgents.find(
      (a) =>
        a.name.toLowerCase() === stickyAgentName.toLowerCase() ||
        a.name.toLowerCase().includes(stickyAgentName.toLowerCase()) ||
        stickyAgentName.toLowerCase().includes(a.name.toLowerCase()),
    );

    if (!agent) {
      return {
        success: true,
        response: `I don't have detailed information about the ${stickyAgentName} agent available right now.`,
        metadata: {
          agentType: 'orchestrator',
          agentName: 'Orchestrator Agent',
          contentType: 'message',
          processedAt: new Date().toISOString(),
        },
      };
    }

    // Create a clean agent name
    const cleanName = agent.name
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const capabilities =
      agent.capabilities && agent.capabilities.length > 0
        ? agent.capabilities
        : [
            `I specialize in helping you with ${cleanName.toLowerCase()} related tasks and questions.`,
          ];

    return {
      success: true,
      response: `Hello! I'm the ${cleanName}. ${agent.description || `${cleanName} specialist agent`}`, // Fallback text
      metadata: {
        agentType: 'specialists',
        agentName: `${cleanName} Agent`,
        contentType: 'agentCapabilitiesModal',
        processedAt: new Date().toISOString(),
        agentCapabilities: {
          name: cleanName,
          description: agent.description || `${cleanName} specialist agent`,
          capabilities: capabilities,
          originalName: agent.name,
          type: agent.type,
        },
      },
    };
  }

  /**
   * Create specific agent capabilities response for sticky agent
   */
  private createStickyAgentCapabilitiesResponse(stickyAgentName: string): any {
    // Find the agent in the available agents list
    const agent = this.availableAgents.find(
      (a) =>
        a.name.toLowerCase() === stickyAgentName.toLowerCase() ||
        a.name.toLowerCase().includes(stickyAgentName.toLowerCase()) ||
        stickyAgentName.toLowerCase().includes(a.name.toLowerCase()),
    );

    if (!agent) {
      return this.createResponse(
        `I don't have detailed information about the ${stickyAgentName} agent available right now.`,
      );
    }

    // Create a personalized capabilities response
    const cleanName = agent.name
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const description = agent.description || `${cleanName} specialist agent`;

    let capabilitiesText = `Hello! I'm the ${cleanName}.\n\n`;
    capabilitiesText += `${description}\n\n`;

    if (agent.capabilities && agent.capabilities.length > 0) {
      capabilitiesText += `My specific capabilities include:\n`;
      agent.capabilities.forEach((capability, index) => {
        capabilitiesText += `${index + 1}. ${capability}\n`;
      });
    } else {
      capabilitiesText += `I specialize in helping you with ${cleanName.toLowerCase()} related tasks and questions.`;
    }

    return {
      success: true,
      response: capabilitiesText,
      metadata: {
        agentType: 'specialists',
        agentName: `${cleanName} Agent`,
        contentType: 'agentCapabilities',
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle agent discovery decision with enhanced context
   */
  private async handleAgentDiscoveryDecision(
    decision: any,
    userMessage: string,
    sessionId?: string,
    authToken?: string,
    llmPreferences?: any,
    conversationHistory?: any[],
  ): Promise<any> {
    if (decision.action === 'delegate' && decision.agent) {
      return await this.delegateToAgent(
        decision.agent.name,
        userMessage,
        sessionId,
        authToken,
        llmPreferences,
      );
    } else if (decision.action === 'respond_directly') {
      return await this.responseGenerationService.generateDirectResponse(
        userMessage,
        this.availableAgents,
        conversationHistory || [],
      );
    } else if (decision.action === 'clarify') {
      return this.responseGenerationService.generateClarificationRequest(
        userMessage,
        this.availableAgents,
        decision.reasoning,
      );
    } else {
      // Fallback - use response generation service for any unhandled cases
      return await this.responseGenerationService.generateDirectResponse(
        userMessage,
        this.availableAgents,
        conversationHistory || [],
      );
    }
  }

  /**
   * Delegate request to a specific agent
   */
  private async delegateToAgent(
    agentName: string,
    request: string,
    sessionId?: string,
    authToken?: string,
    llmPreferences?: any,
    contextOptions?: {
      stickyContext?: boolean;
      continuityReason?: string;
      confidence?: number;
      agentContext?: any;
      selectionReasoning?: string;
      systemSelection?: boolean;
    },
  ): Promise<any> {
    try {
      this.orchestratorLogger.log(
        `Attempting to delegate to agent: ${agentName}`,
      );
      this.orchestratorLogger.log(
        `Available agents: ${this.availableAgents.map((a) => a.name).join(', ')}`,
      );

      // Find the agent in the available agents list with more flexible matching
      const agent = this.availableAgents.find((a) => {
        const agentNameLower = a.name.toLowerCase();
        const requestedNameLower = agentName.toLowerCase();

        // Direct name match
        if (agentNameLower === requestedNameLower) return true;

        // Check if either name contains the other
        if (
          agentNameLower.includes(requestedNameLower) ||
          requestedNameLower.includes(agentNameLower)
        )
          return true;

        // Check metadata display names if available
        if (
          a.metadata?.display_name &&
          a.metadata.display_name.toLowerCase() === requestedNameLower
        )
          return true;
        if (
          a.metadata?.name &&
          a.metadata.name.toLowerCase() === requestedNameLower
        )
          return true;

        // Remove common words and check for matches (e.g., "hiverarchy ai orchestrator" -> "hiverarchy")
        const cleanAgentName = agentNameLower
          .replace(/\s+(agent|ai|orchestrator|specialist)\s*/g, '')
          .trim();
        const cleanRequestedName = requestedNameLower
          .replace(/\s+(agent|ai|orchestrator|specialist)\s*/g, '')
          .trim();
        if (cleanAgentName === cleanRequestedName) return true;

        return false;
      });

      if (!agent) {
        this.orchestratorLogger.warn(
          `Agent not found: ${agentName}. Available agents: ${this.availableAgents.map((a) => a.name).join(', ')}`,
        );
        return this.createResponse(
          'I could not find the appropriate specialist agent for your request.',
        );
      }

      // Log sticky context information if provided
      if (contextOptions?.stickyContext) {
        this.orchestratorLogger.log(
          `🔗 Sticky context delegation: reason="${contextOptions.continuityReason}", confidence=${contextOptions.confidence}`,
        );
      }

      // Use DelegationService for cleaner delegation logic with enhanced metadata
      const enhancedLlmPreferences = {
        ...llmPreferences,
        delegationContext: contextOptions
          ? {
              stickyContext: contextOptions.stickyContext,
              continuityReason: contextOptions.continuityReason,
              confidence: contextOptions.confidence,
              agentContext: contextOptions.agentContext,
            }
          : undefined,
      };

      return await this.delegationService.delegateToAgent(
        agent,
        request,
        sessionId,
        authToken,
        enhancedLlmPreferences,
      );
    } catch (error) {
      this.orchestratorLogger.error('Error delegating to agent:', error);
      return this.createResponse(
        'I attempted to delegate your request to a specialist, but the service is currently unavailable. Let me try to help you directly instead.',
      );
    }
  }

  /**
   * Create a standard response format
   */
  private createResponse(responseText: string, additionalMetadata?: any): any {
    return {
      success: true,
      response: responseText,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString(),
        ...additionalMetadata,
      },
    };
  }

  /**
   * Check if the user message is requesting content creation
   */
  private isContentCreationRequest(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    const contentKeywords = [
      'write a blog',
      'create a blog',
      'blog post',
      'write an article',
      'create an article',
      'write content',
      'create content',
      'content creation',
      'write about',
      'article about',
      'blog about',
      'copywriting',
      'creative writing',
      'content writing',
      'draft a post',
      'compose an article',
      'develop content',
    ];

    return contentKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Fallback routing when LLM is unavailable
   */
  private async handleFallbackRouting(
    userMessage: string,
    sessionId?: string,
    authToken?: string,
  ): Promise<any> {
    // Simple keyword-based routing as fallback
    const lowerMessage = userMessage.toLowerCase();

    // Check for various "talk to agent" patterns
    let talkToAgentMatch = lowerMessage.match(
      /can i talk to (?:the )?(.+?)\s*agent/,
    );

    // Also check for "I would like to talk with [agent] agent" pattern from frontend
    if (!talkToAgentMatch) {
      talkToAgentMatch = lowerMessage.match(
        /i would like to talk with (?:the )?(.+?)\s*agent/,
      );
    }

    // Also check for "talk to [agent]" or "connect me with [agent]" patterns
    if (!talkToAgentMatch) {
      talkToAgentMatch = lowerMessage.match(
        /(?:talk to|connect me with|switch to) (?:the )?(.+?)(?:\s*agent)?(?:\.|$)/,
      );
    }

    if (talkToAgentMatch && talkToAgentMatch[1]) {
      const requestedAgent = talkToAgentMatch[1].trim();
      this.orchestratorLogger.log(
        `Detected "talk to agent" request for: ${requestedAgent}`,
      );
      return await this.delegateToAgent(
        requestedAgent,
        userMessage,
        sessionId,
        authToken,
      );
    }

    if (
      lowerMessage.includes('blog') ||
      lowerMessage.includes('write') ||
      lowerMessage.includes('article')
    ) {
      return await this.delegateToAgent(
        'blog_post',
        userMessage,
        sessionId,
        authToken,
      );
    }

    // Check for golf-related queries
    if (
      lowerMessage.includes('golf') ||
      lowerMessage.includes('rules of golf') ||
      lowerMessage.includes('penalty') ||
      lowerMessage.includes('usga') ||
      lowerMessage.includes('r&a') ||
      lowerMessage.includes('handicap') ||
      lowerMessage.includes('golf rules') ||
      lowerMessage.includes('golf rule') ||
      lowerMessage.includes('water hazard') ||
      lowerMessage.includes('unplayable') ||
      lowerMessage.includes('relief') ||
      lowerMessage.includes('drop') ||
      lowerMessage.includes('bunker') ||
      lowerMessage.includes('green') ||
      lowerMessage.includes('fairway') ||
      lowerMessage.includes('tee box') ||
      lowerMessage.includes('golf course')
    ) {
      return await this.delegateToAgent(
        'rules_of_golf',
        userMessage,
        sessionId,
        authToken,
      );
    }

    // Default response for unmatched requests
    return this.createResponse(
      `I received your message: "${userMessage}". I'm here to help coordinate with various specialist agents, but I'm currently unable to determine the best way to assist you. Could you be more specific about what you need?`,
    );
  }

  /**
   * Public method to get agent list data for modal (UI endpoint)
   */
  public getAgentListForModal(): any {
    return this.createAgentListModalResponse();
  }

  /**
   * Public method to get agent capabilities data for modal (UI endpoint)
   */
  public getAgentCapabilitiesForModal(agentName: string): any {
    return this.createAgentCapabilitiesModalResponse(agentName);
  }

  /**
   * Initialize available agents from agent pool HTTP endpoint
   */
  async initializeAvailableAgents(authToken?: string): Promise<void> {
    try {
      this.orchestratorLogger.log(
        '🔄 Initializing available agents from agent pool...',
      );

      // Prepare headers for authentication
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        this.orchestratorLogger.log('Using auth token for agent pool request');
      } else {
        this.orchestratorLogger.warn(
          'No auth token available for agent pool request',
        );
      }

      const response = await this.httpService.axiosRef.get(
        `${this.baseApiUrl}/agent-pool/agents`,
        {
          headers,
        },
      );

      this.orchestratorLogger.debug(
        `Agent pool refreshed: ${response.data?.length || 0} agents found`,
      );

      if (response?.data && Array.isArray(response.data)) {
        // Filter out orchestrator agents and ensure external agents are properly handled
        this.availableAgents = response.data
          .filter((agent: any) => agent.type !== 'orchestrator')
          .map((agent: any) => ({
            name: agent.name,
            description: agent.description,
            path: agent.path,
            url: agent.url,
            type: agent.type,
            capabilities: agent.capabilities || [],
            metadata: agent.metadata,
          }));

        this.orchestratorLogger.log(
          `✅ Initialized with ${this.availableAgents.length} available agents from pool`,
        );

        // Log the agents we found for debugging
        if (this.availableAgents.length > 0) {
          this.orchestratorLogger.log(
            '🎯 Available agent names:',
            this.availableAgents.map((a) => a.name).join(', '),
          );
          this.orchestratorLogger.log(
            '🎯 Available agent types:',
            this.availableAgents.map((a) => `${a.name}(${a.type})`).join(', '),
          );
          this.orchestratorLogger.log(
            '🎯 Available agent paths:',
            this.availableAgents.map((a) => a.path).join(', '),
          );
        } else {
          this.orchestratorLogger.warn(
            'No agents found in agent pool - this may be normal during startup',
          );
        }
      } else {
        this.orchestratorLogger.warn('No agents found in agent pool response');
        this.availableAgents = [];
      }

      this.orchestratorLogger.log(
        `🎯 Total available agents: ${this.availableAgents.length}`,
      );
    } catch (error: any) {
      this.orchestratorLogger.error(
        '❌ Error initializing available agents:',
        error.message,
      );
      this.orchestratorLogger.error('❌ Full error:', error);

      // Initialize with empty array on error - agents will be registered as they come online
      this.availableAgents = [];
    }
  }
}
