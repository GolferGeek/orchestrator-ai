import { Injectable, Logger, Inject as _Inject } from '@nestjs/common';
import { HttpService as _HttpService } from '@nestjs/axios';
import { A2AAgentBaseService } from '../a2a-base/a2a-agent-base.service';
import { LLMService as _LLMService } from '@/llms/llm.service';
import { AgentRegistrationService as _AgentRegistrationService } from '@agents/base/sub-services/agent-registration/agent-registration.service';
import { JsonRpcProtocolService as _JsonRpcProtocolService } from '@agents/base/sub-services/json-rpc-protocol/json-rpc-protocol.service';
import { LoggingService as _LoggingService } from '@agents/base/sub-services/logging/logging.service';
import { AuthService as _AuthService } from '@agents/base/sub-services/auth/auth.service';
import { ConfigurationService as _ConfigurationService } from '@agents/base/sub-services/configuration/configuration.service';
import { AgentContextService } from '../a2a-base/agent-context.service';
import { TaskStatusService as _TaskStatusService } from '@/tasks/task-status.service';
import { TasksService as _TasksService } from '@/tasks/tasks.service';
import { DeliverablesService as _DeliverablesService } from '@/deliverables/deliverables.service';
import { AgentServicesContext } from '@agents/base/services/agent-services-context';

/**
 * Context Agent Base Service that processes context-based requests using LLM
 * This provides context-aware processing with proper error handling and fallback capabilities
 */
@Injectable()
export class ContextAgentBaseService extends A2AAgentBaseService {
  protected readonly contextLogger = new Logger(ContextAgentBaseService.name);
  private contextData: string | null = null;
  protected readonly agentContextService = new AgentContextService();

  constructor(
    // Pure service container pattern - only accepts AgentServicesContext
    private readonly services: AgentServicesContext,
  ) {
    super(
      services.httpService,
      services.taskStatusService,
      services.deliverablesService,
      services.deliverableVersionsService,
      services.tasksService, // Context agents need TasksService for deliverable auto-persistence
      services.llmService,
      services.agentRegistrationService,
      services.jsonRpcProtocolService,
      services.loggingService,
      services.authService,
      services.configurationService,
    );
  }

  /**
   * Set context data for this agent (called by AgentDiscoveryService)
   */
  setContextData(contextData: string): void {
    this.contextData = contextData;
  }

  /**
   * Simple task execution using context and LLM
   */
  public async executeTask(method: string, params: any): Promise<any> {
    const agentName = this.getAgentName();

    // DEBUG: Log what the agent receives
    this.contextLogger.debug(
      `🔍 [AGENT-PARAMS-DEBUG] Agent received params keys:`,
      Object.keys(params),
    );
    this.contextLogger.debug(
      `🔍 [AGENT-PARAMS-DEBUG] params.piiMetadata exists:`,
      !!params.piiMetadata,
    );
    this.contextLogger.debug(
      `🔍 [AGENT-PARAMS-DEBUG] params.routingDecision exists:`,
      !!params.routingDecision,
    );
    this.contextLogger.debug(
      `🔍 [AGENT-PARAMS-DEBUG] params.metadata exists:`,
      !!params.metadata,
    );
    const agentType = this.getAgentType();

    try {
      // NEW ARCHITECTURE: Check for PII blocking first
      if (this.shouldBlockForPII(params)) {
        this.contextLogger.warn(
          `🛑 [${agentName}] Request blocked due to PII policy violation`,
        );
        return this.generatePIIBlockedResponse(params);
      }

      // Extract user message from params
      const userMessage = this.extractUserMessage(params);

      // Check for metadata-driven routing first

      if (params.metadata?.context && params.metadata?.method) {
        return await this.handleMetadataRouting(
          params.metadata,
          userMessage,
          params,
        );
      }

      // Check if this is a simple greeting request
      if (this.isGreeting(userMessage)) {
        const greeting = this.generatePersonalizedGreeting(agentName);
        const greetingResult = {
          success: true,
          response: greeting,
          metadata: {
            agentName: agentName,
            agentType: agentType,
            responseType: 'greeting',
            processedAt: new Date().toISOString(),
          },
        };
        // NEW ARCHITECTURE: Enrich greeting with PII metadata
        return this.enrichResponseWithPIIMetadata(greetingResult, params);
      }

      // If no context data available, use fallback
      if (!this.contextData) {
        this.contextLogger.warn(
          `🤖 [${agentName}] No context data available, using fallback processing`,
        );
        return this.processWithoutContext(method, params, agentName, agentType);
      }

      // Process with LLM using context
      const systemPrompt = this.buildSystemPrompt(agentName, agentType);

      // Check if conversation history is provided
      const conversationHistory = params.conversationHistory || [];
      let llmResult;

      if (conversationHistory.length > 0) {
        // Use conversation-aware LLM processing
        const formattedHistory = conversationHistory.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        }));

        // Note: generateResponseWithHistory method not available, using generateResponse with history in prompt
        const historyPrompt = formattedHistory
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join('\n');
        const _fullPrompt = `${systemPrompt}\n\nConversation History:\n${historyPrompt}\n\nCurrent User Message: ${userMessage}`;

        const startTime = Date.now();

        // Always use frontend model selection - no backend override
        const llmOptions: any = {
          callerType: 'agent',
          callerName: agentName,
          conversationId: params.conversationId, // Use proper conversation ID, not legacy sessionId
          userId: this.extractUserId(params), // Add user ID for LLM usage tracking
          dataClassification: 'internal', // Default for context agents
          quick: params?.quick === true, // Fast local path in converse mode
          // Pass through the frontend model selection
          providerName: params.llmSelection?.providerName,
          modelName: params.llmSelection?.modelName,
          cidafmOptions: params.llmSelection?.cidafmOptions,
          temperature: params.llmSelection?.temperature,
        };

        llmResult = await this.services.llmService.generateResponse(
          systemPrompt,
          `${historyPrompt}\n\nCurrent User Message: ${userMessage}`,
          llmOptions,
        );
        const endTime = Date.now();
        const _duration = endTime - startTime;
      } else {
        // Use standard LLM processing for first message
        const extractedPiiMetadata = this.extractPIIMetadata(params);
        const extractedRoutingDecision = this.extractRoutingDecision(params);

        this.contextLogger.debug(
          `🔍 [AGENT-PII-DEBUG] extractPIIMetadata result:`,
          extractedPiiMetadata,
        );
        this.contextLogger.debug(
          `🔍 [AGENT-PII-DEBUG] extractRoutingDecision result:`,
          extractedRoutingDecision,
        );

        const llmOptions = {
          ...params,
          userId: this.extractUserId(params), // Add user ID for LLM usage tracking
          callerType: 'agent',
          callerName: agentName,
          conversationId: params.conversationId || params.taskId, // Use proper conversation ID
          dataClassification: 'internal', // Default for context agents
          quick: params?.quick === true, // Fast local path in converse mode
          // Extract provider info from llmSelection for both PII policy and routing decisions
          providerName: params.llmSelection?.providerName,
          modelName: params.llmSelection?.modelName, // LLM service expects 'modelName'
          provider: params.llmSelection?.providerName, // For routing service
          model: params.llmSelection?.modelName, // For routing service
          // NEW: Pass PII metadata from routing decision to LLM service
          piiMetadata: extractedPiiMetadata,
          routingDecision: extractedRoutingDecision,
        };

        this.contextLogger.debug(
          `🔍 [AGENT-PII-DEBUG] Final llmOptions.piiMetadata:`,
          llmOptions.piiMetadata,
        );

        llmResult = await this.services.llmService.generateResponse(
          systemPrompt,
          userMessage,
          llmOptions,
        );
      }

      // 🔍 DEBUG: Log LLM result structure
      this.contextLogger.log(
        `🔍 [AGENT-DEBUG] LLM result type: ${typeof llmResult}`,
      );
      this.contextLogger.log(
        `🔍 [AGENT-DEBUG] LLM result keys:`,
        typeof llmResult === 'object' ? Object.keys(llmResult) : 'N/A',
      );
      this.contextLogger.log(
        `🔍 [AGENT-DEBUG] LLM result sanitizationMetadata:`,
        typeof llmResult === 'object' ? llmResult.sanitizationMetadata : 'N/A',
      );

      // Extract response content and metadata
      const responseContent =
        typeof llmResult === 'string' ? llmResult : llmResult.content;
      const llmMetadata =
        typeof llmResult === 'object' ? llmResult.llmMetadata : undefined;
      const sanitizationMetadata =
        typeof llmResult === 'object'
          ? llmResult.sanitizationMetadata
          : undefined;
      // NEW ARCHITECTURE: Extract PII metadata from LLM response
      const llmPiiMetadata =
        typeof llmResult === 'object' ? llmResult.piiMetadata : undefined;

      const result = {
        success: true,
        response: responseContent,
        metadata: {
          agentName: agentName,
          agentType: agentType,
          contextUsed: true,
          contextLength: this.contextData.length,
          processedAt: new Date().toISOString(),
          // Include LLM information used for this response
          ...(llmMetadata && {
            llmUsed: llmMetadata,
            usage: typeof llmResult === 'object' ? llmResult.usage : undefined,
            costCalculation:
              typeof llmResult === 'object'
                ? llmResult.costCalculation
                : undefined,
          }),
          // Include sanitization metadata for frontend privacy indicators
          ...(sanitizationMetadata && {
            sanitizationMetadata: sanitizationMetadata,
          }),
          // NEW ARCHITECTURE: Include PII metadata from LLM processing
          ...(llmPiiMetadata && {
            llmPiiMetadata: llmPiiMetadata,
          }),
        },
      };

      // Report task completion to TaskStatusService for async execution modes

      if (params.taskId && params.currentUser?.id) {
        try {
          // Use completeTaskWithDeliverableContext to enable auto-deliverable creation
          await this.completeTaskWithDeliverableContext(
            params.taskId,
            params.currentUser.id,
            result,
            params,
          );
        } catch (error) {
          this.contextLogger.error(
            `Error reporting task completion for ${params.taskId}:`,
            error,
          );
          // Don't fail the task if reporting fails
        }
      }

      // NEW ARCHITECTURE: Enrich response with PII metadata
      return this.enrichResponseWithPIIMetadata(result, params);
    } catch (error) {
      this.contextLogger.error(`Error in executeTask for ${agentName}:`, error);

      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        response:
          'I apologize, but I encountered an error while processing your request.',
        metadata: {
          agentName: agentName,
          agentType: agentType,
          errorDetails: error instanceof Error ? error.message : String(error),
          processedAt: new Date().toISOString(),
        },
      };

      // Report task failure to TaskStatusService for async execution modes
      if (params.taskId && params.currentUser?.id) {
        try {
          await this.failTask(
            params.taskId,
            params.currentUser.id,
            error instanceof Error ? error.message : String(error),
          );
        } catch (_reportError) {
          this.contextLogger.error(
            `Error reporting task failure for ${params.taskId}:`,
            _reportError,
          );
          // Don't fail the task if reporting fails
        }
      }

      // NEW ARCHITECTURE: Enrich error response with PII metadata
      return this.enrichResponseWithPIIMetadata(errorResult, params);
    }
  }

  /**
   * Extract user message from parameters
   */
  private extractUserMessage(params: any): string {
    if (typeof params === 'string') {
      return params;
    }

    if (params && typeof params === 'object') {
      // Handle message.parts[0].text format (from frontend)
      if (params.message?.parts?.[0]?.text) {
        return params.message.parts[0].text;
      }

      // Handle direct message.text format
      if (params.message?.text) {
        return params.message.text;
      }

      const messageProps = [
        'userMessage',
        'message',
        'prompt',
        'input',
        'request',
        'content',
        'text',
      ];

      for (const prop of messageProps) {
        if (params[prop] && typeof params[prop] === 'string') {
          return params[prop];
        }
      }

      return JSON.stringify(params);
    }

    return String(params || '');
  }

  /**
   * Check if message is a greeting
   */
  private isGreeting(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return (
      lowerMessage === 'hello' ||
      lowerMessage === 'hi' ||
      lowerMessage.includes('can i talk to')
    );
  }

  /**
   * Build system prompt using context data
   */
  private buildSystemPrompt(agentName: string, agentType: string): string {
    // Debug logging to see what's happening with agent names
    this.contextLogger.debug(
      '🔍 [AGENT-DEBUG] buildSystemPrompt called with:',
      { agentName, agentType },
    );
    this.contextLogger.debug(
      '🔍 [AGENT-DEBUG] contextData available:',
      !!this.contextData,
    );
    this.contextLogger.debug(
      '🔍 [AGENT-DEBUG] contextData preview:',
      this.contextData?.substring(0, 100),
    );

    let prompt = `You are ${agentName}, a ${agentType} agent. Help the user with their request.`;

    if (this.contextData) {
      prompt += `\n\nHere is your context information:\n${this.contextData}`;
      prompt += `\n\nUse this context to provide accurate and helpful responses. If the user's question is not covered by the context, say so and provide general assistance.`;
    }

    this.contextLogger.debug(
      '🔍 [AGENT-DEBUG] Final system prompt:',
      prompt.substring(0, 200),
    );
    return prompt;
  }

  /**
   * Generate a personalized greeting based on the agent name
   */
  private generatePersonalizedGreeting(agentName: string): string {
    // For now, use a placeholder name - in a real system this would come from user session data
    const userName = 'Golfer Geek'; // This could be extracted from session/auth context in the future

    switch (agentName.toLowerCase()) {
      case 'blog post writer':
      case 'blog_post':
        return `Hi ${userName}! I'm your Blog Post Writer. I'm here to help you create engaging, professional blog posts on any topic you'd like. What can I write for you today?`;

      case 'metrics agent':
      case 'metrics':
        return `Hello ${userName}! I'm your Metrics Agent. I can help you analyze business data, create reports, and provide insights. What metrics would you like to explore?`;

      case 'chat support':
        return `Hi ${userName}! I'm your Chat Support specialist. I'm here to help resolve any issues or answer questions you might have. How can I assist you today?`;

      default:
        return `Hello ${userName}! I'm your ${agentName} agent. I'm ready to help you with whatever you need. What can I do for you today?`;
    }
  }

  /**
   * Fallback processing when no context is available
   */
  private async processWithoutContext(
    method: string,
    params: any,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    return {
      success: true,
      response: `Hello! I'm the ${agentName} agent. I'm ready to help, but my context data isn't loaded yet. Please check back soon!`,
      metadata: {
        agentName: agentName,
        agentType: agentType,
        contextUsed: false,
        reason: 'No context data available',
        method,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Set the discovered agent path (called by AgentDiscoveryService)
   */
  setDiscoveredPath(path: string): void {
    this.agentPath = path;
  }

  /**
   * Get agent card with context status and skills from YAML
   */
  async getAgentCard(): Promise<any> {
    const baseCard = await super.getAgentCard();

    // Include skills from AgentContextService if available
    const skills = this.agentContextService.isLoaded
      ? this.agentContextService.skills
      : [];
    const name = this.agentContextService.isLoaded
      ? this.agentContextService.name
      : baseCard.name;
    const description = this.agentContextService.isLoaded
      ? this.agentContextService.description
      : baseCard.description || '';

    return {
      ...baseCard,
      name,
      description,
      skills,
      contextStatus: this.contextData ? 'loaded' : 'not_loaded',
      contextLength: this.contextData?.length || 0,
      loadedAt: this.contextData ? new Date().toISOString() : null,
    };
  }

  /**
   * Initialize context from agent directory (called by AgentFactoryService)
   */
  async initializeContext(agentDirectory: string): Promise<void> {
    try {
      await this.agentContextService.initialize(agentDirectory);
    } catch (error) {
      this.contextLogger.error('Failed to initialize agent context:', error);
    }
  }

  /**
   * Save context task result using the same pattern as function agents
   */
  protected async saveContextTaskResult(
    taskId: string,
    userId: string,
    result: any,
  ): Promise<void> {
    if (!this.services.tasksService) {
      return;
    }

    try {
      const _updateData = {
        status: 'completed' as const,
        progress: 100,
        response: typeof result === 'string' ? result : JSON.stringify(result),
        responseMetadata: result.metadata || {},
      };

      await this.services.tasksService.updateTask(taskId, userId, updateData);
    } catch (error) {
      this.contextLogger.error(
        `Error saving task result for ${taskId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle metadata-driven routing for version management operations
   */
  private async handleMetadataRouting(
    metadata: any,
    userMessage: string,
    params: any,
  ): Promise<any> {
    const agentName = this.getAgentName();
    const agentType = this.getAgentType();

    try {
      // Extract userId from params
      const userId = this.extractUserId(params);

      // Route based on context
      switch (metadata.context) {
        case 'deliverable':
          return await this.handleDeliverableContext(
            metadata,
            userMessage,
            userId,
            agentName,
            agentType,
          );

        case 'project':
          return await this.handleProjectContext(
            metadata,
            userMessage,
            userId,
            agentName,
            agentType,
          );

        case 'conversation':
        default:
          // Fall back to normal conversation processing
          return await this.processRegularConversation(
            userMessage,
            params,
            agentName,
            agentType,
          );
      }
    } catch (error) {
      this.contextLogger.error('Metadata routing failed:', error);
      return {
        success: false,
        response: `I encountered an error processing your ${metadata.context} request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          agentName,
          agentType,
          error: true,
          context: metadata.context,
          method: metadata.method,
          processedAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle deliverable context operations
   */
  private async handleDeliverableContext(
    metadata: any,
    userMessage: string,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    if (!this.deliverableVersionsService) {
      return {
        success: false,
        response:
          'Deliverable version management is not available for this agent',
        metadata: { agentName, agentType, error: true },
      };
    }

    switch (metadata.method) {
      case 'delete':
        return await this.handleVersionDeletion(
          metadata,
          userId,
          agentName,
          agentType,
        );

      case 'newVersion':
        return await this.handleVersionCreation(
          metadata,
          userMessage,
          userId,
          agentName,
          agentType,
        );

      case 'merge':
        return await this.handleVersionMerge(
          metadata,
          userMessage,
          userId,
          agentName,
          agentType,
        );

      case 'create':
        return await this.handleNewDeliverableCreation(
          metadata,
          userMessage,
          userId,
          agentName,
          agentType,
        );

      default:
        return {
          success: false,
          response: `I don't understand the deliverable operation "${metadata.method}". I can help with delete, newVersion, merge, or create operations.`,
          metadata: {
            agentName,
            agentType,
            error: true,
            unknownMethod: metadata.method,
          },
        };
    }
  }

  /**
   * Handle version deletion
   */
  private async handleVersionDeletion(
    metadata: any,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    if (
      !metadata.versionIds ||
      !Array.isArray(metadata.versionIds) ||
      metadata.versionIds.length === 0
    ) {
      return {
        success: false,
        response:
          'I need version IDs to delete. Please specify which versions you want me to delete.',
        metadata: { agentName, agentType, error: true },
      };
    }

    try {
      const deleteResults = await Promise.all(
        metadata.versionIds.map((versionId: string) =>
          this.deliverableVersionsService!.deleteVersion(versionId, userId),
        ),
      );

      const successCount = deleteResults.filter((r) => r.success).length;
      const failureCount = deleteResults.length - successCount;

      if (failureCount === 0) {
        return {
          success: true,
          response: `I've successfully deleted ${successCount} version${successCount > 1 ? 's' : ''}.`,
          metadata: {
            agentName,
            agentType,
            deletedVersions: metadata.versionIds,
          },
        };
      } else {
        const failedVersions = deleteResults
          .map((result, index) => ({
            result,
            versionId: metadata.versionIds[index],
          }))
          .filter((item) => !item.result.success)
          .map((item) => `${item.versionId}: ${item.result.message}`);

        return {
          success: false,
          response: `I could delete ${successCount} version${successCount > 1 ? 's' : ''}, but ${failureCount} failed: ${failedVersions.join(', ')}`,
          metadata: {
            agentName,
            agentType,
            partialSuccess: true,
            failures: failedVersions,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        response: `I encountered an error while deleting versions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { agentName, agentType, error: true },
      };
    }
  }

  /**
   * Handle version creation from task
   */
  private async handleVersionCreation(
    metadata: any,
    userMessage: string,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    if (!metadata.deliverableId) {
      return {
        success: false,
        response: 'I need a deliverable ID to create a new version.',
        metadata: { agentName, agentType, error: true },
      };
    }

    try {
      const newVersion =
        await this.deliverableVersionsService!.createVersionFromTask(
          metadata.deliverableId,
          userMessage,
          userId,
          metadata.baseVersionId,
        );

      return {
        success: true,
        response: `I've created version ${newVersion.versionNumber} with your requested changes.`,
        metadata: {
          agentName,
          agentType,
          newVersionId: newVersion.id,
          versionNumber: newVersion.versionNumber,
        },
      };
    } catch (error) {
      return {
        success: false,
        response: `I couldn't create the new version: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { agentName, agentType, error: true },
      };
    }
  }

  /**
   * Handle version merging
   */
  private async handleVersionMerge(
    metadata: any,
    userMessage: string,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    if (
      !metadata.deliverableId ||
      !metadata.versionIds ||
      !Array.isArray(metadata.versionIds) ||
      metadata.versionIds.length < 2
    ) {
      return {
        success: false,
        response:
          'I need a deliverable ID and at least 2 version IDs to merge versions.',
        metadata: { agentName, agentType, error: true },
      };
    }

    try {
      const mergeResult = await this.deliverableVersionsService!.mergeVersions(
        metadata.deliverableId,
        metadata.versionIds,
        userMessage,
        userId,
      );

      const response = `I've created version ${mergeResult.newVersion.versionNumber} by merging ${metadata.versionIds.length} versions.`;

      if (mergeResult.conflictSummary) {
        response += ` ${mergeResult.conflictSummary}`;
      }

      return {
        success: true,
        response,
        metadata: {
          agentName,
          agentType,
          newVersionId: mergeResult.newVersion.id,
          versionNumber: mergeResult.newVersion.versionNumber,
          mergedVersions: metadata.versionIds,
          conflictSummary: mergeResult.conflictSummary,
        },
      };
    } catch (error) {
      return {
        success: false,
        response: `I couldn't merge the versions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { agentName, agentType, error: true },
      };
    }
  }

  /**
   * Handle new deliverable creation
   */
  private async handleNewDeliverableCreation(
    metadata: any,
    userMessage: string,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    if (!this.deliverablesService) {
      return {
        success: false,
        response: 'Deliverable creation is not available for this agent',
        metadata: { agentName, agentType, error: true },
      };
    }

    try {
      // Extract title from the user's prompt (simple heuristic)
      const title =
        this.extractTitleFromPrompt(userMessage) || 'New Deliverable';

      // For now, use the user's prompt as initial content
      // TODO: Generate content using agent's LLM processing
      const initialContent = userMessage;

      // Create the deliverable with the user's prompt as initial content
      const createDeliverableDto = {
        title,
        type: metadata.deliverableType || 'document',
        conversationId: metadata.conversationId, // Will be provided by frontend
        initialContent,
        initialFormat: metadata.deliverableFormat || 'markdown',
        initialCreationType: 'conversation_task' as any, // TODO: Import proper enum
        initialMetadata: {
          agentName,
          agentType,
          originalPrompt: userMessage,
          createdAt: new Date().toISOString(),
        },
      };

      const newDeliverable = await this.deliverablesService.create(
        createDeliverableDto,
        userId,
      );

      return {
        success: true,
        response: `I've created a new deliverable: "${title}". You can find it in your deliverables list.`,
        metadata: {
          agentName,
          agentType,
          deliverableId: newDeliverable.id,
          deliverableTitle: title,
        },
      };
    } catch (error) {
      return {
        success: false,
        response: `I couldn't create the deliverable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { agentName, agentType, error: true },
      };
    }
  }

  /**
   * Extract a title from the user's prompt
   */
  private extractTitleFromPrompt(prompt: string): string {
    // Simple heuristic to extract title from prompts like:
    // "Write a blog post about AI trends" -> "Blog Post About AI Trends"
    // "Create a market analysis" -> "Market Analysis"

    const cleanPrompt = prompt.trim();

    // Remove common prefixes
    let title = cleanPrompt
      .replace(
        /^(write|create|draft|generate|make|build)\s+(a|an|the)?\s*/i,
        '',
      )
      .replace(/^(please\s+)?(can\s+you\s+)?(help\s+me\s+)?/i, '');

    // Capitalize first letter of each word
    title = title.replace(/\b\w/g, (l) => l.toUpperCase());

    // Limit length
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    return title || 'New Deliverable';
  }

  /**
   * Handle project context operations
   */
  private async handleProjectContext(
    metadata: any,
    userMessage: string,
    userId: string,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    // TODO: Implement project context operations
    return {
      success: false,
      response: 'Project operations are not yet implemented.',
      metadata: { agentName, agentType, notImplemented: true },
    };
  }

  /**
   * Process regular conversation (fallback for conversation context or no metadata)
   */
  private async processRegularConversation(
    userMessage: string,
    params: any,
    agentName: string,
    agentType: string,
  ): Promise<any> {
    // Continue with existing conversation processing logic
    if (!this.contextData) {
      return this.processWithoutContext(
        'process',
        params,
        agentName,
        agentType,
      );
    }

    // Process with LLM using context
    const systemPrompt = this.buildSystemPrompt(agentName, agentType);
    const conversationHistory = params.conversationHistory || [];

    if (conversationHistory.length > 0) {
      const formattedHistory = conversationHistory.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

      // Note: generateResponseWithHistory method not available, using generateResponse with history in prompt
      const historyPrompt = formattedHistory
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');
      const fullPrompt = `${systemPrompt}\n\nConversation History:\n${historyPrompt}\n\nCurrent User Message: ${userMessage}`;

      return await this.services.llmService.generateResponse(fullPrompt, '', {
        // Ensure we preserve LLM metadata (PII, tokens, timing)
        includeMetadata: true,
        // Honor explicit provider/model if provided by UI selection
        providerName: params?.llmSelection?.providerName,
        modelName: params?.llmSelection?.modelName,
        // Caller/context info
        callerType: 'agent',
        callerName: this.getAgentName(),
        userId: this.extractUserId(params),
        conversationId: params?.conversationId,
        dataClassification: 'internal',
      });
    } else {
      return await this.services.llmService.generateResponse(
        systemPrompt,
        userMessage,
        {
          // Ensure we preserve LLM metadata (PII, tokens, timing)
          includeMetadata: true,
          // Honor explicit provider/model if provided by UI selection
          providerName: params?.llmSelection?.providerName,
          modelName: params?.llmSelection?.modelName,
          // Caller/context info
          callerType: 'agent',
          callerName: this.getAgentName(),
          userId: this.extractUserId(params),
          conversationId: params?.conversationId,
          dataClassification: 'internal',
        },
      );
    }
  }

  /**
   * Extract user ID from params
   */
  private extractUserId(params: any): string {
    // Try various possible locations for userId
    return (
      params.userId ||
      params.user?.id ||
      params.user?.sub ||
      params.currentUser?.id ||
      'unknown'
    );
  }
}
