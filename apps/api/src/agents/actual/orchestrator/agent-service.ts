import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '@agents/base/implementations/base-services/a2a-base/a2a-agent-base.service';
import { LLMService } from '@/llms/llm.service';
import { SessionsService } from '../../../sessions/sessions.service';
import { SupabaseService } from '../../../supabase/supabase.service';

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

interface ConversationContext {
  sessionId?: string;
  userId?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    agentName?: string;
  }>;
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
    if (sessionId && userMessage && currentUser && authToken) {
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

    // Check if this is a capability request
    const lowerMessage = userMessage.toLowerCase();
    const isCapabilityRequest =
      lowerMessage.includes('what can you do') ||
      lowerMessage.includes('view all that i can do for you') ||
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
      // Check if there's a sticky agent from conversation history
      let stickyAgent = null;
      if (conversationHistory.length > 0) {
        const lastAssistantMessage = [...conversationHistory]
          .reverse()
          .find((msg: any) => msg.role === 'assistant');

        if (lastAssistantMessage?.metadata?.agentName) {
          const agentName = lastAssistantMessage.metadata.agentName;
          // Only treat as sticky agent if it's NOT an orchestrator agent
          const isOrchestratorAgent =
            agentName.toLowerCase().includes('orchestrator') ||
            agentName === 'Orchestrator Agent' ||
            agentName === 'Orchestrator AI' ||
            lastAssistantMessage.metadata?.agentType === 'orchestrator';

          if (!isOrchestratorAgent) {
            stickyAgent = agentName;
          }
        }
      }

      if (stickyAgent) {
        // Return specific agent capabilities
        return this.createStickyAgentCapabilitiesResponse(stickyAgent);
      } else {
        // Return agent list for modal
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
      return this.createResponse(
        "Welcome back! I'm the Orchestrator and I'm here to help coordinate your requests. I can either assist you directly with general questions or connect you with specialist agents for specific tasks. What would you like to work on?",
      );
    }

    // Check if user is continuing conversation with a specific agent
    let agentContinuityContext = '';
    if (conversationHistory.length > 0) {
      const lastAssistantMessage = [...conversationHistory]
        .reverse()
        .find((msg: any) => msg.role === 'assistant');

      if (
        lastAssistantMessage?.metadata?.agentName &&
        lastAssistantMessage.metadata.agentName !== 'Orchestrator Agent'
      ) {
        this.orchestratorLogger.log(
          `User appears to be continuing conversation with: ${lastAssistantMessage.metadata.agentName}`,
        );
        agentContinuityContext = `\n\nNote: User was previously talking to ${lastAssistantMessage.metadata.agentName}. Unless they want to switch topics, continue with that agent.`;
      }
    }

    // Use LLM to decide whether to delegate or respond directly
    let response;
    try {
      // Check if this is a content creation request and if Hiverarchy is available
      const isContentRequest = this.isContentCreationRequest(userMessage);
      const hiverarchyAgent = this.availableAgents.find(
        (agent) => agent.name === 'hiverarchy',
      );

      if (isContentRequest && hiverarchyAgent) {
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
        // Pass full agent objects with descriptions to the LLM for better decision making
        const agentObjects = this.availableAgents.map((agent) => ({
          name: agent.name,
          description: agent.description,
          type: agent.type,
        }));
        // Use the enhanced orchestration decision method with conversation history
        const decision =
          await this.llmService.generateOrchestrationDecisionWithHistory(
            userMessage,
            agentObjects,
            conversationHistory,
            agentContinuityContext,
          );

        if (decision.action === 'delegate' && decision.agent) {
          response = await this.delegateToAgent(
            decision.agent,
            userMessage,
            sessionId,
            authToken,
            llmPreferences,
          );
        } else if (
          decision.action === 'respond_directly' &&
          decision.response
        ) {
          // Check if user has LLM preferences for enhanced response generation
          if (
            llmPreferences.providerId ||
            llmPreferences.modelId ||
            llmPreferences.cidafmOptions
          ) {
            try {
              this.orchestratorLogger.log(
                '🚀 Using enhanced LLM service for direct response with user preferences',
              );
              const enhancedResponse =
                await this.llmService.generateEnhancedResponse(
                  currentUser?.id || 'anonymous',
                  'You are a helpful AI assistant orchestrator. Provide direct assistance to the user.',
                  userMessage,
                  {
                    providerId: llmPreferences.providerId,
                    modelId: llmPreferences.modelId,
                    cidafmOptions: llmPreferences.cidafmOptions,
                    sessionId: sessionId,
                    temperature: llmPreferences.temperature,
                    maxTokens: llmPreferences.maxTokens,
                  },
                );

              response = this.createResponse(enhancedResponse.content, {
                llmUsage: enhancedResponse.usage,
                costCalculation: enhancedResponse.costCalculation,
                processedPrompt: enhancedResponse.processedPrompt,
                cidafmState: enhancedResponse.cidafmState,
                langsmithRunId: enhancedResponse.langsmithRunId,
                usedEnhancedLLM: true,
              });
            } catch (enhancedError) {
              this.orchestratorLogger.warn(
                'Enhanced LLM service failed, falling back to standard response:',
                enhancedError,
              );
              response = this.createResponse(decision.response);
            }
          } else {
            response = this.createResponse(decision.response);
          }
        } else {
          // For clarification requests, also use enhanced LLM if preferences are provided
          const clarificationMessage =
            decision.response ||
            `I understand you said: "${userMessage}". How can I help you further?`;

          if (
            llmPreferences.providerId ||
            llmPreferences.modelId ||
            llmPreferences.cidafmOptions
          ) {
            try {
              this.orchestratorLogger.log(
                '🚀 Using enhanced LLM service for clarification with user preferences',
              );
              const enhancedResponse =
                await this.llmService.generateEnhancedResponse(
                  currentUser?.id || 'anonymous',
                  'You are a helpful AI assistant orchestrator. Ask for clarification to better assist the user.',
                  userMessage,
                  {
                    providerId: llmPreferences.providerId,
                    modelId: llmPreferences.modelId,
                    cidafmOptions: llmPreferences.cidafmOptions,
                    sessionId: sessionId,
                    temperature: llmPreferences.temperature,
                    maxTokens: llmPreferences.maxTokens,
                  },
                );

              response = this.createResponse(enhancedResponse.content, {
                llmUsage: enhancedResponse.usage,
                costCalculation: enhancedResponse.costCalculation,
                processedPrompt: enhancedResponse.processedPrompt,
                cidafmState: enhancedResponse.cidafmState,
                langsmithRunId: enhancedResponse.langsmithRunId,
                usedEnhancedLLM: true,
              });
            } catch (enhancedError) {
              this.orchestratorLogger.warn(
                'Enhanced LLM service failed for clarification, using standard response:',
                enhancedError,
              );
              response = this.createResponse(clarificationMessage);
            }
          } else {
            response = this.createResponse(clarificationMessage);
          }
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
    if (sessionId && response?.response && currentUser && authToken) {
      try {
        // Determine the responding agent information
        const isResponseFromOrchestrator = !response.metadata?.delegatedTo;
        const respondingAgentName = isResponseFromOrchestrator
          ? this.getAgentName()
          : response.metadata?.responding_agent_name ||
            response.metadata?.delegatedTo ||
            'Unknown Agent';
        const respondingAgentType = isResponseFromOrchestrator
          ? this.getAgentType()
          : 'specialists';
        const respondingAgentId = isResponseFromOrchestrator
          ? `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}`
          : `specialists_${(response.metadata?.delegatedTo || 'unknown').toLowerCase().replace(/\s+/g, '_')}`;

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
   * Delegate request to a specific agent
   */
  private async delegateToAgent(
    agentName: string,
    request: string,
    sessionId?: string,
    authToken?: string,
    llmPreferences?: any,
  ): Promise<any> {
    try {
      this.orchestratorLogger.log(
        `Attempting to delegate to agent: ${agentName}`,
      );
      this.orchestratorLogger.log(
        `Available agents: ${this.availableAgents.map((a) => a.name).join(', ')}`,
      );

      // Find the agent in the available agents list
      const agent = this.availableAgents.find(
        (a) =>
          a.name.toLowerCase().includes(agentName.toLowerCase()) ||
          agentName.toLowerCase().includes(a.name.toLowerCase()) ||
          (agentName.toLowerCase().includes('blog') &&
            a.name.toLowerCase().includes('blog')),
      );

      if (!agent) {
        this.orchestratorLogger.warn(
          `Agent not found: ${agentName}. Available agents: ${this.availableAgents.map((a) => a.name).join(', ')}`,
        );
        return this.createResponse(
          'I could not find the appropriate specialist agent for your request.',
        );
      }

      const agentUrl = agent.url;
      this.orchestratorLogger.log(
        `Found agent: ${agent.name} at URL: ${agentUrl}`,
      );

      // Check if this is a "Can I talk to [agent] agent?" request
      const isGreetingRequest =
        request.toLowerCase().includes('can i talk to') &&
        request.toLowerCase().includes('agent');

      // For greeting requests, send a simple hello message so the agent can respond with a personalized greeting
      const messageToAgent = isGreetingRequest ? 'Hello' : request;

      // Use the processTask method that all agents understand from our A2A architecture
      const payload = {
        jsonrpc: '2.0',
        method: 'processTask',
        params: {
          userMessage: messageToAgent,
          sessionId: sessionId || `orchestrator-delegation-${Date.now()}`,
          // Pass LLM preferences to the delegated agent
          ...(llmPreferences && {
            providerId: llmPreferences.providerId,
            provider_id: llmPreferences.providerId,
            modelId: llmPreferences.modelId,
            model_id: llmPreferences.modelId,
            cidafmOptions: llmPreferences.cidafmOptions,
            cidafm_options: llmPreferences.cidafmOptions,
            temperature: llmPreferences.temperature,
            maxTokens: llmPreferences.maxTokens,
            max_tokens: llmPreferences.maxTokens,
          }),
        },
        id: `orchestrator-delegation-${Date.now()}`,
      };

      this.orchestratorLogger.log(
        `Delegating to agent at: ${agentUrl} with message: "${messageToAgent}"`,
      );
      if (
        llmPreferences &&
        (llmPreferences.providerId || llmPreferences.modelId)
      ) {
        this.orchestratorLogger.log(
          `🚀 Passing LLM preferences to delegated agent: provider=${llmPreferences.providerId || 'default'}, model=${llmPreferences.modelId || 'default'}`,
        );
      }
      this.orchestratorLogger.log(`Payload: ${JSON.stringify(payload)}`);

      // Prepare headers with authentication if available
      const headers: any = { 'Content-Type': 'application/json' };
      this.orchestratorLogger.log(
        `Auth token received in delegateToAgent: ${authToken ? 'YES (length: ' + authToken.length + ')' : 'NO'}`,
      );
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        this.orchestratorLogger.log(
          'Including authorization header in delegation request',
        );
        this.orchestratorLogger.log(
          `Authorization header value: Bearer ${authToken.substring(0, 20)}...`,
        );
      } else {
        this.orchestratorLogger.warn(
          'No auth token available for delegation - specialist agent may reject request',
        );
      }

      this.orchestratorLogger.log(
        `Final headers to be sent: ${JSON.stringify(headers)}`,
      );

      const response = await this.httpService.axiosRef.post(agentUrl, payload, {
        headers,
        timeout: 30000,
      });

      this.orchestratorLogger.log(
        `Response status: ${response.status}, data: ${JSON.stringify(response.data)?.substring(0, 200)}...`,
      );

      // Handle JSON-RPC response format where actual response is in 'result' field
      const agentResponse = response.data?.result || response.data;

      if (agentResponse?.success) {
        return {
          success: true,
          response: agentResponse.response,
          metadata: {
            delegatedTo: agent.name,
            originalAgent: agentResponse.metadata || {},
            processedAt: new Date().toISOString(),
            responding_agent_name: `${agent.name} Agent`,
          },
        };
      } else if (response.data?.error || agentResponse?.error) {
        this.orchestratorLogger.error(
          'Delegated agent error:',
          response.data?.error || agentResponse?.error,
        );
        return this.createResponse(
          'I attempted to delegate your request to a specialist, but encountered an error. Let me try to help you directly instead.',
        );
      }

      return this.createResponse(
        'I successfully delegated your request, but received an unexpected response format.',
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

    // Check for "Can I talk to [agent] agent?" pattern
    const talkToAgentMatch = lowerMessage.match(
      /can i talk to (?:the )?(.+?)\s*agent/,
    );
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

    // Default response for unmatched requests
    return this.createResponse(
      `I received your message: "${userMessage}". I'm here to help coordinate with various specialist agents, but I'm currently unable to determine the best way to assist you. Could you be more specific about what you need?`,
    );
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

      this.orchestratorLogger.log(
        `🔍 Agent pool response status: ${response.status}`,
      );
      this.orchestratorLogger.log(
        `🔍 Agent pool response data:`,
        JSON.stringify(response.data, null, 2),
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
