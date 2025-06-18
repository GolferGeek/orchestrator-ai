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
    private readonly supabaseService: SupabaseService
  ) {
    super(httpService);
    // Get base API URL from environment variables
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '4000';
    this.baseApiUrl = `http://${apiHost}:${apiPort}`;
    
    // Debug dependency injection
    this.orchestratorLogger.log(`OrchestratorService constructor: sessionsService=${!!this.sessionsService}, llmService=${!!this.llmService}, supabaseService=${!!this.supabaseService}`);
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.orchestratorLogger.warn('Failed to initialize agent pool during startup, will use fallback agents:', errorMessage);
      }
    }, 2000); // Wait 2 seconds for server to be fully up
    
    this.orchestratorLogger.log('Orchestrator agent initialization completed (agent pool will be loaded asynchronously)');
  }

  /**
   * Execute task using the centralized LLM service
   * The orchestrator determines whether to delegate to specialists or respond conversationally
   */
  public async executeTask(method: string, params: any): Promise<any> {
    this.orchestratorLogger.log(`Orchestrator processing request with method: ${method}`);
    this.orchestratorLogger.log(`Full params object:`, JSON.stringify(params, null, 2));

    // Extract user message and conversation history from params
    // Handle both userMessage (from direct requests) and message (from frontend)
    const userMessage = params.userMessage || params.message || '';
    const sessionId = params.sessionId || params.session_id || null;
    const conversationHistory = params.conversationHistory || params.conversation_history || [];
    
    // Extract user authentication context if available
    const currentUser = params.currentUser || null;
    const authToken = params.authToken || null;

    this.orchestratorLogger.log(`Processing message: "${userMessage}" with ${conversationHistory.length} history messages`);
    if (conversationHistory.length > 0) {
      this.orchestratorLogger.log(`Conversation history:`, JSON.stringify(conversationHistory, null, 2));
    }
    this.orchestratorLogger.log(`Auth context received: currentUser=${!!currentUser}, authToken=${!!authToken}`);
    if (authToken) {
      this.orchestratorLogger.log(`Auth token length: ${authToken.length}, first 20 chars: ${authToken.substring(0, 20)}...`);
    } else {
      this.orchestratorLogger.warn('No auth token received in orchestrator params');
    }

    // Refresh available agents with current auth token
    if (authToken) {
      this.orchestratorLogger.log('🔄 Refreshing agent pool with current auth token...');
      await this.initializeAvailableAgents(authToken);
    } else {
      this.orchestratorLogger.warn('⚠️ No auth token available - using cached agent pool');
    }

    // Save the user message to the database first
    let userMessageId = null;
    if (sessionId && userMessage && currentUser && authToken) {
      try {
        const userMessageRecord = await this.sessionsService.addMessage(sessionId, {
          role: 'user',
          content: userMessage,
          metadata: {
            processedBy: 'orchestrator',
            receivedAt: new Date().toISOString(),
            // User information
            userId: currentUser.id,
            userEmail: currentUser.email,
            userName: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Unknown User',
            // Processing agent information  
            processingAgentId: `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}`,
            processingAgentName: this.getAgentName(),
            processingAgentType: this.getAgentType(),
            processingAgentDisplayName: this.getAgentName(),
            // Message type
            messageType: 'user_input'
          }
        }, currentUser, authToken);
        userMessageId = userMessageRecord.id;
        this.orchestratorLogger.log(`User message saved to database with ID: ${userMessageId} for user ${currentUser.id}`);
      } catch (error) {
        this.orchestratorLogger.error('Failed to save user message to database:', error);
        // Continue processing even if database save fails
      }
    } else if (sessionId && userMessage) {
      this.orchestratorLogger.warn('Missing user authentication context - cannot save message to database with proper RLS');
    }

    // Check if this is an agent listing request
    const lowerMessage = userMessage.toLowerCase();
    const isAgentListRequest = 
      lowerMessage.includes('what can you do') ||
      lowerMessage.includes('view all that i can do for you') ||
      lowerMessage.includes('show me') && lowerMessage.includes('agents') ||
      lowerMessage.includes('view') && lowerMessage.includes('agents') ||
      lowerMessage.includes('available agents') ||
      lowerMessage.includes('list agents') ||
      lowerMessage.includes('tell me what agents');

    if (isAgentListRequest) {
      return this.createAgentListResponse();
    }

    // Check if user is continuing conversation with a specific agent
    let agentContinuityContext = '';
    if (conversationHistory.length > 0) {
      const lastAssistantMessage = [...conversationHistory]
        .reverse()
        .find((msg: any) => msg.role === 'assistant');
      
      if (lastAssistantMessage?.metadata?.agentName && lastAssistantMessage.metadata.agentName !== 'Orchestrator Agent') {
        this.orchestratorLogger.log(`User appears to be continuing conversation with: ${lastAssistantMessage.metadata.agentName}`);
        agentContinuityContext = `\n\nNote: User was previously talking to ${lastAssistantMessage.metadata.agentName}. Unless they want to switch topics, continue with that agent.`;
      }
    }

    // Use LLM to decide whether to delegate or respond directly
    let response;
    try {
      const agentNames = this.availableAgents.map(agent => agent.name);
      // Use the enhanced orchestration decision method with conversation history
      const decision = await this.llmService.generateOrchestrationDecisionWithHistory(userMessage, agentNames, conversationHistory, agentContinuityContext);

      if (decision.action === 'delegate' && decision.agent) {
        response = await this.delegateToAgent(decision.agent, userMessage, sessionId, authToken);
      } else if (decision.action === 'respond_directly' && decision.response) {
        response = this.createResponse(decision.response);
      } else {
        response = this.createResponse(decision.response || `I understand you said: "${userMessage}". How can I help you further?`);
      }
    } catch (error) {
      this.orchestratorLogger.error('Error processing with LLM:', error);
      // Fallback: simple keyword-based routing
      response = await this.handleFallbackRouting(userMessage, sessionId, authToken);
    }

    // Save the assistant response to the database
    if (sessionId && response?.response && currentUser && authToken) {
      try {
        // Determine the responding agent information
        const isResponseFromOrchestrator = !response.metadata?.delegatedTo;
        const respondingAgentName = isResponseFromOrchestrator ? this.getAgentName() : (response.metadata?.responding_agent_name || response.metadata?.delegatedTo || 'Unknown Agent');
        const respondingAgentType = isResponseFromOrchestrator ? this.getAgentType() : 'specialists';
        const respondingAgentId = isResponseFromOrchestrator ? 
          `${this.getAgentType()}_${this.getAgentName().toLowerCase().replace(/\s+/g, '_')}` :
          `specialists_${(response.metadata?.delegatedTo || 'unknown').toLowerCase().replace(/\s+/g, '_')}`;
        
        const assistantMessageRecord = await this.sessionsService.addMessage(sessionId, {
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
            userName: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Unknown User',
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
            messageType: isResponseFromOrchestrator ? 'orchestrator_response' : 'delegated_agent_response',
            isDelegated: !isResponseFromOrchestrator
          }
        }, currentUser, authToken);
        this.orchestratorLogger.log(`Assistant message saved to database with ID: ${assistantMessageRecord.id} for user ${currentUser.id}`);
      } catch (error) {
        this.orchestratorLogger.error('Failed to save assistant message to database:', error);
        // Continue even if database save fails
      }
    } else if (sessionId && response?.response) {
      this.orchestratorLogger.warn('Missing user authentication context - cannot save assistant message to database with proper RLS');
    }

    return response;
  }

  /**
   * Create formatted agent list response for the frontend
   */
  private createAgentListResponse(): any {
    if (!this.availableAgents || this.availableAgents.length === 0) {
      return this.createResponse('No specialist agents are currently available.');
    }

    // Filter out orchestrator agents and remove duplicates based on name
    const uniqueAgents = new Map();
    
    this.availableAgents.forEach(agent => {
      // Skip orchestrator agents
      if (agent.name.toLowerCase().includes('orchestrator')) {
        return;
      }
      
      // Extract the display name from agent metadata or use the directory name
      let displayName = agent.name;
      
      // Try to get a more user-friendly name from the agent's metadata
      if (agent.metadata) {
        displayName = agent.metadata.name || agent.metadata.display_name || agent.name;
      }
      
      // Clean up the name - remove underscores, capitalize properly
      const cleanName = displayName
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      // Use the clean name as the key to avoid duplicates
      if (!uniqueAgents.has(cleanName)) {
        uniqueAgents.set(cleanName, {
          name: cleanName,
          description: agent.metadata?.description || `${cleanName} specialist agent`,
          originalAgent: agent
        });
      }
    });

    if (uniqueAgents.size === 0) {
      return this.createResponse('No specialist agents are currently available.');
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
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Delegate request to a specific agent
   */
  private async delegateToAgent(agentName: string, request: string, sessionId?: string, authToken?: string): Promise<any> {
    try {
      this.orchestratorLogger.log(`Attempting to delegate to agent: ${agentName}`);
      this.orchestratorLogger.log(`Available agents: ${this.availableAgents.map(a => a.name).join(', ')}`);
      
      // Find the agent in the available agents list
      const agent = this.availableAgents.find(a => 
        a.name.toLowerCase().includes(agentName.toLowerCase()) ||
        agentName.toLowerCase().includes(a.name.toLowerCase()) ||
        (agentName.toLowerCase().includes('blog') && a.name.toLowerCase().includes('blog'))
      );
      
      if (!agent) {
        this.orchestratorLogger.warn(`Agent not found: ${agentName}. Available agents: ${this.availableAgents.map(a => a.name).join(', ')}`);
        return this.createResponse('I could not find the appropriate specialist agent for your request.');
      }

      const agentUrl = agent.url;
      this.orchestratorLogger.log(`Found agent: ${agent.name} at URL: ${agentUrl}`);
      
      // Check if this is a "Can I talk to [agent] agent?" request
      const isGreetingRequest = request.toLowerCase().includes('can i talk to') && request.toLowerCase().includes('agent');
      
      // For greeting requests, send a simple hello message so the agent can respond with a personalized greeting
      const messageToAgent = isGreetingRequest ? 'Hello' : request;
      
      // Use the processTask method that all agents understand from our A2A architecture
      const payload = {
        jsonrpc: '2.0',
        method: 'processTask',
        params: { 
          userMessage: messageToAgent,
          sessionId: sessionId || `orchestrator-delegation-${Date.now()}`
        },
        id: `orchestrator-delegation-${Date.now()}`
      };

      this.orchestratorLogger.log(`Delegating to agent at: ${agentUrl} with message: "${messageToAgent}"`);
      this.orchestratorLogger.log(`Payload: ${JSON.stringify(payload)}`);
      
      // Prepare headers with authentication if available
      const headers: any = { 'Content-Type': 'application/json' };
      this.orchestratorLogger.log(`Auth token received in delegateToAgent: ${authToken ? 'YES (length: ' + authToken.length + ')' : 'NO'}`);
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        this.orchestratorLogger.log('Including authorization header in delegation request');
        this.orchestratorLogger.log(`Authorization header value: Bearer ${authToken.substring(0, 20)}...`);
      } else {
        this.orchestratorLogger.warn('No auth token available for delegation - specialist agent may reject request');
      }
      
      this.orchestratorLogger.log(`Final headers to be sent: ${JSON.stringify(headers)}`);
      
      const response = await this.httpService!.axiosRef!.post(agentUrl, payload, {
        headers,
        timeout: 30000
      });
      
      this.orchestratorLogger.log(`Response status: ${response.status}, data: ${JSON.stringify(response.data)?.substring(0, 200)}...`);

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
            responding_agent_name: `${agent.name} Agent`
          }
        };
      } else if (response.data?.error || agentResponse?.error) {
        this.orchestratorLogger.error('Delegated agent error:', response.data?.error || agentResponse?.error);
        return this.createResponse('I attempted to delegate your request to a specialist, but encountered an error. Let me try to help you directly instead.');
      }

      return this.createResponse('I successfully delegated your request, but received an unexpected response format.');
      
    } catch (error) {
      this.orchestratorLogger.error('Error delegating to agent:', error);
      return this.createResponse('I attempted to delegate your request to a specialist, but the service is currently unavailable. Let me try to help you directly instead.');
    }
  }

  /**
   * Create a standard response format
   */
  private createResponse(responseText: string): any {
    return {
      success: true,
      response: responseText,
      metadata: {
        agentType: 'orchestrator',
        agentName: 'Orchestrator Agent',
        processedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Fallback routing when LLM is unavailable
   */
  private async handleFallbackRouting(userMessage: string, sessionId?: string, authToken?: string): Promise<any> {
    // Simple keyword-based routing as fallback
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for "Can I talk to [agent] agent?" pattern
    const talkToAgentMatch = lowerMessage.match(/can i talk to (?:the )?(.+?)\s*agent/);
    if (talkToAgentMatch && talkToAgentMatch[1]) {
      const requestedAgent = talkToAgentMatch[1].trim();
      this.orchestratorLogger.log(`Detected "talk to agent" request for: ${requestedAgent}`);
      return await this.delegateToAgent(requestedAgent, userMessage, sessionId, authToken);
    }
    
    if (lowerMessage.includes('blog') || lowerMessage.includes('write') || lowerMessage.includes('article')) {
      return await this.delegateToAgent('blog_post', userMessage, sessionId, authToken);
    }
    
    // Default response for unmatched requests
    return this.createResponse(`I received your message: "${userMessage}". I'm here to help coordinate with various specialist agents, but I'm currently unable to determine the best way to assist you. Could you be more specific about what you need?`);
  }

  /**
   * Initialize available agents from agent pool
   */
  async initializeAvailableAgents(authToken?: string): Promise<void> {
    try {
      this.orchestratorLogger.log('🔄 Initializing available agents from agent pool...');
      
      // Prepare headers for authentication
      const headers: any = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        this.orchestratorLogger.log('Using auth token for agent pool request');
      } else {
        this.orchestratorLogger.warn('No auth token available for agent pool request');
      }
      
      const response = await this.httpService!.axiosRef!.get(`${this.baseApiUrl}/agent-pool/agents`, {
        headers
      });
      
      this.orchestratorLogger.log(`🔍 Agent pool response status: ${response.status}`);
      this.orchestratorLogger.log(`🔍 Agent pool response data:`, JSON.stringify(response.data, null, 2));
      
      if (response?.data && Array.isArray(response.data)) {
        this.availableAgents = response.data;
        this.orchestratorLogger.log(`✅ Initialized with ${this.availableAgents.length} available agents from pool`);
        
        // Log the agents we found for debugging
        this.orchestratorLogger.log('🎯 Available agent names:', this.availableAgents.map(a => a.name));
        this.orchestratorLogger.log('🎯 Available agent paths:', this.availableAgents.map(a => a.path));
      } else {
        this.orchestratorLogger.warn('No agents found in agent pool, using fallback agents');
        // Add fallback agents if we couldn't get any from the pool
        this.availableAgents = [
          {
            name: 'blog_post',
            description: 'Blog Post Writer',
            path: 'specialists/blog_post',
            url: `${this.baseApiUrl}/agents/specialists/blog_post/tasks`,
            type: 'specialists',
            capabilities: ['blog_writing', 'content_creation']
          },
          {
            name: 'hr_assistant',
            description: 'HR Assistant',
            path: 'specialists/hr_assistant',
            url: `${this.baseApiUrl}/agents/specialists/hr_assistant/tasks`,
            type: 'specialists',
            capabilities: ['hr_policies', 'employee_onboarding']
          },
          {
            name: 'marketing_swarm',
            description: 'Marketing Swarm',
            path: 'specialists/marketing_swarm',
            url: `${this.baseApiUrl}/agents/specialists/marketing_swarm/tasks`,
            type: 'specialists',
            capabilities: ['marketing_campaigns', 'product_promotion']
          },
          {
            name: 'requirements_writer',
            description: 'Requirements Writer',
            path: 'specialists/requirements_writer',
            url: `${this.baseApiUrl}/agents/specialists/requirements_writer/tasks`,
            type: 'specialists',
            capabilities: ['technical_requirements', 'documentation']
          }
        ];
      }
      
      this.orchestratorLogger.log(`🎯 Total available agents: ${this.availableAgents.length}`);
    } catch (error: any) {
      this.orchestratorLogger.error('❌ Error initializing available agents:', error.message);
      this.orchestratorLogger.error('❌ Full error:', error);
      
      // Add fallback agents on error
      this.orchestratorLogger.log('🔄 Using fallback agents due to error');
      this.availableAgents = [
        {
          name: 'blog_post',
          description: 'Blog Post Writer',
          path: 'specialists/blog_post',
          url: `${this.baseApiUrl}/agents/specialists/blog_post/tasks`,
          type: 'specialists',
          capabilities: ['blog_writing', 'content_creation']
        },
        {
          name: 'hr_assistant',
          description: 'HR Assistant',
          path: 'specialists/hr_assistant',
          url: `${this.baseApiUrl}/agents/specialists/hr_assistant/tasks`,
          type: 'specialists',
          capabilities: ['hr_policies', 'employee_onboarding']
        },
        {
          name: 'marketing_swarm',
          description: 'Marketing Swarm',
          path: 'specialists/marketing_swarm',
          url: `${this.baseApiUrl}/agents/specialists/marketing_swarm/tasks`,
          type: 'specialists',
          capabilities: ['marketing_campaigns', 'product_promotion']
        },
        {
          name: 'requirements_writer',
          description: 'Requirements Writer',
          path: 'specialists/requirements_writer',
          url: `${this.baseApiUrl}/agents/specialists/requirements_writer/tasks`,
          type: 'specialists',
          capabilities: ['technical_requirements', 'documentation']
        }
      ];
    }
  }
}