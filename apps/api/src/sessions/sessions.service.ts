import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import { HttpService } from '@nestjs/axios';
import {
  SessionCreateDto,
  SessionResponseDto,
  SessionListResponseDto,
  MessageResponseDto,
  MessageListResponseDto,
} from './dto/session.dto';
import {
  EnhancedMessageCreateDto,
  EnhancedMessageResponseDto,
} from '../dto/llm-evaluation.dto';
import { mapEnhancedMessageFromDb } from '../utils/case-converter';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly httpService: HttpService,
  ) {}

  async createSession(
    sessionCreate: SessionCreateDto,
    currentUser: SupabaseAuthUserDto,
    token: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Creating session for user ${currentUser.id}`);

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const sessionData = {
        user_id: currentUser.id,
        name: sessionCreate.name,
      };

      const { data, error } = await authenticatedClient
        .from('sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error || !data) {
        this.logger.error(
          `Failed to create session for user ${currentUser.id}. Error: ${error?.message}`,
        );
        throw new HttpException(
          error?.message || 'Could not create chat session.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error creating session for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async listSessions(
    currentUser: SupabaseAuthUserDto,
    token: string,
    skip: number = 0,
    limit: number = 100,
  ): Promise<SessionListResponseDto> {
    this.logger.log(`Listing sessions for user ${currentUser.id}`);

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { data, error, count } = await authenticatedClient
        .from('sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .range(skip, skip + limit - 1);

      if (error) {
        this.logger.error(
          `Error listing sessions for user ${currentUser.id}: ${error.message}`,
        );
        throw new HttpException(
          error.message || 'Error listing sessions.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const sessions = (data || []).map((session) => ({
        id: session.id,
        userId: session.user_id,
        name: session.name,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }));

      return {
        sessions,
        count: count || 0,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error listing sessions for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSession(
    sessionId: string,
    currentUser: SupabaseAuthUserDto,
    token: string,
  ): Promise<SessionResponseDto> {
    this.logger.log(`Getting session ${sessionId} for user ${currentUser.id}`);

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      const { data, error } = await authenticatedClient
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', currentUser.id)
        .single();

      if (error || !data) {
        this.logger.warn(
          `Session ${sessionId} not found for user ${currentUser.id} or access denied`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error getting session ${sessionId} for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSessionMessages(
    sessionId: string,
    currentUser: SupabaseAuthUserDto,
    token: string,
    skip: number = 0,
    limit: number = 50,
  ): Promise<MessageListResponseDto> {
    this.logger.log(
      `Getting messages for session ${sessionId}, user ${currentUser.id}`,
    );

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      // First, verify the user owns the session
      const { data: sessionData, error: sessionError } =
        await authenticatedClient
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('user_id', currentUser.id)
          .single();

      if (sessionError || !sessionData) {
        this.logger.warn(
          `User ${currentUser.id} attempted to access messages for session ${sessionId} they don't own or doesn't exist`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      // Fetch messages for the session
      const { data, error, count } = await authenticatedClient
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('session_id', sessionId)
        .order('order', { ascending: true })
        .range(skip, skip + limit - 1);

      if (error) {
        this.logger.error(
          `Error listing messages for session ${sessionId}, user ${currentUser.id}: ${error.message}`,
        );
        throw new HttpException(
          error.message || 'Error listing messages.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const messages = (data || []).map((message) => ({
        id: message.id,
        sessionId: message.session_id,
        userId: message.user_id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        order: message.order,
        metadata: message.metadata,
      }));

      return {
        messages,
        sessionId: sessionId,
        count: count || 0,
        skip,
        limit,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error listing messages for session ${sessionId}, user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addMessage(
    sessionId: string,
    messageData: {
      role: 'user' | 'assistant' | 'system' | 'tool';
      content?: string;
      metadata?: any;
    },
    currentUser?: SupabaseAuthUserDto,
    token?: string,
  ): Promise<MessageResponseDto> {
    this.logger.log(
      `Adding message to session ${sessionId}${currentUser ? ` for user ${currentUser.id}` : ''}`,
    );

    try {
      const authenticatedClient = token
        ? this.supabaseService.createAuthenticatedClient(token)
        : this.supabaseService.getServiceClient();

      // If we have a user, verify they own the session
      if (currentUser) {
        const { data: sessionData, error: sessionError } =
          await authenticatedClient
            .from('sessions')
            .select('id, user_id')
            .eq('id', sessionId)
            .eq('user_id', currentUser.id)
            .single();

        if (sessionError || !sessionData) {
          this.logger.warn(
            `User ${currentUser.id} attempted to add message to session ${sessionId} they don't own or doesn't exist`,
          );
          throw new NotFoundException('Session not found or access denied.');
        }
      }

      const insertData = {
        session_id: sessionId,
        user_id: currentUser?.id || null,
        role: messageData.role,
        content: messageData.content,
        metadata: messageData.metadata,
      };

      const { data, error } = await authenticatedClient
        .from('messages')
        .insert(insertData)
        .select()
        .single();

      if (error || !data) {
        this.logger.error(
          `Failed to add message to session ${sessionId}. Error: ${error?.message}`,
        );
        throw new HttpException(
          error?.message || 'Could not add message.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        id: data.id,
        sessionId: data.session_id,
        userId: data.user_id,
        role: data.role,
        content: data.content,
        timestamp: data.timestamp,
        order: data.order,
        metadata: data.metadata,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error adding message to session ${sessionId}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteSession(
    sessionId: string,
    currentUser: SupabaseAuthUserDto,
    token: string,
  ): Promise<void> {
    this.logger.log(`Deleting session ${sessionId} for user ${currentUser.id}`);

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      // First, verify the user owns the session
      const { data: sessionData, error: sessionError } =
        await authenticatedClient
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('user_id', currentUser.id)
          .single();

      if (sessionError || !sessionData) {
        this.logger.warn(
          `User ${currentUser.id} attempted to delete session ${sessionId} they don't own or doesn't exist`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      // Delete the session (messages will be cascade deleted)
      const { error } = await authenticatedClient
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', currentUser.id);

      if (error) {
        this.logger.error(
          `Error deleting session ${sessionId} for user ${currentUser.id}: ${error.message}`,
        );
        throw new HttpException(
          error.message || 'Error deleting session.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(
        `Successfully deleted session ${sessionId} for user ${currentUser.id}`,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error deleting session ${sessionId} for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendMessage(
    sessionId: string,
    messageCreateDto: EnhancedMessageCreateDto,
    currentUser: SupabaseAuthUserDto,
    token: string,
  ): Promise<EnhancedMessageResponseDto> {
    this.logger.log(
      `Sending enhanced message to session ${sessionId} for user ${currentUser.id}`,
    );

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      // Verify user owns the session
      const { data: sessionData, error: sessionError } =
        await authenticatedClient
          .from('sessions')
          .select('id, user_id')
          .eq('id', sessionId)
          .eq('user_id', currentUser.id)
          .single();

      if (sessionError || !sessionData) {
        this.logger.warn(
          `User ${currentUser.id} attempted to send message to session ${sessionId} they don't own or doesn't exist`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      // Add user message to database
      await this.addMessage(
        sessionId,
        {
          role: 'user',
          content: messageCreateDto.content,
          metadata: {
            llmSelection: messageCreateDto.llmSelection,
            clientSentAt: new Date().toISOString(),
          },
        },
        currentUser,
        token,
      );

      // Process message through orchestrator with LLM preferences
      const apiHost = process.env.API_HOST || 'localhost';
      const apiPort = process.env.API_PORT || '4000';
      const orchestratorUrl = `http://${apiHost}:${apiPort}/agents/orchestrator/orchestrator/tasks`;

      try {
        this.logger.log(
          `Calling orchestrator at ${orchestratorUrl} with LLM preferences`,
        );

        // Prepare orchestrator request with LLM preferences
        const orchestratorPayload = {
          jsonrpc: '2.0',
          method: 'processTask',
          params: {
            message: messageCreateDto.content,
            userMessage: messageCreateDto.content,
            sessionId: sessionId,
            currentUser: currentUser,
            authToken: token,
            // Pass LLM preferences
            providerId: messageCreateDto.llmSelection?.providerId,
            provider_id: messageCreateDto.llmSelection?.providerId,
            modelId: messageCreateDto.llmSelection?.modelId,
            model_id: messageCreateDto.llmSelection?.modelId,
            cidafmOptions: messageCreateDto.llmSelection?.cidafmOptions,
            // Skip message persistence since we're handling it in sessions service
            skipMessagePersistence: true,
          },
          id: `sessions-orchestrator-${Date.now()}`,
        };

        this.logger.log(
          `Orchestrator payload: ${JSON.stringify(orchestratorPayload, null, 2)}`,
        );

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };

        const orchestratorResponse = await this.httpService.axiosRef.post(
          orchestratorUrl,
          orchestratorPayload,
          { headers, timeout: 30000 },
        );

        this.logger.log(
          `Orchestrator response status: ${orchestratorResponse.status}`,
        );
        this.logger.log(
          `Orchestrator response data: ${JSON.stringify(orchestratorResponse.data)?.substring(0, 200)}...`,
        );

        // Handle JSON-RPC response format
        const result =
          orchestratorResponse.data?.result || orchestratorResponse.data;
        const assistantContent =
          result?.response ||
          'I apologize, but I was unable to process your request.';

        const assistantMessage = await this.addMessage(
          sessionId,
          {
            role: 'assistant',
            content: assistantContent,
            metadata: {
              processedBy: 'orchestrator_via_sessions',
              llmPreferences: messageCreateDto.llmSelection,
              orchestratorMetadata: result?.metadata,
              processedAt: new Date().toISOString(),
            },
          },
          currentUser,
          token,
        );

        // Return enhanced message response with orchestrator data
        const enhancedResponse: EnhancedMessageResponseDto = {
          ...assistantMessage,
          providerId: messageCreateDto.llmSelection?.providerId,
          modelId: messageCreateDto.llmSelection?.modelId,
          cidafmOptions: messageCreateDto.llmSelection?.cidafmOptions,
          // Include any LLM usage data from orchestrator metadata if available
          inputTokens: result?.metadata?.llmUsage?.input_tokens,
          outputTokens: result?.metadata?.llmUsage?.output_tokens,
          totalCost: result?.metadata?.costCalculation?.total_cost,
          responseTimeMs: result?.metadata?.llmUsage?.response_time_ms,
          langsmithRunId: result?.metadata?.langsmithRunId,
        };

        return enhancedResponse;
      } catch (orchestratorError) {
        this.logger.error(
          'Error calling orchestrator service:',
          orchestratorError,
        );

        // Fallback: create a simple assistant message
        const assistantMessage = await this.addMessage(
          sessionId,
          {
            role: 'assistant',
            content: `I received your message: "${messageCreateDto.content}". The orchestrator service is currently unavailable, but I've noted your LLM preferences.`,
            metadata: {
              processedBy: 'sessions_service_fallback',
              llmPreferences: messageCreateDto.llmSelection,
              orchestratorError:
                orchestratorError instanceof Error
                  ? orchestratorError.message
                  : String(orchestratorError),
              processedAt: new Date().toISOString(),
            },
          },
          currentUser,
          token,
        );

        // Return enhanced message response
        const enhancedResponse: EnhancedMessageResponseDto = {
          ...assistantMessage,
          providerId: messageCreateDto.llmSelection?.providerId,
          modelId: messageCreateDto.llmSelection?.modelId,
          cidafmOptions: messageCreateDto.llmSelection?.cidafmOptions,
        };

        return enhancedResponse;
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error sending message to session ${sessionId} for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getEnhancedSessionMessages(
    sessionId: string,
    currentUser: SupabaseAuthUserDto,
    token: string,
    options: {
      skip: number;
      limit: number;
      includeEvaluations: boolean;
      includeLlmData: boolean;
    },
  ): Promise<EnhancedMessageResponseDto[]> {
    this.logger.log(
      `Getting enhanced messages for session ${sessionId}, user ${currentUser.id}`,
    );

    try {
      const authenticatedClient =
        this.supabaseService.createAuthenticatedClient(token);

      // Verify user owns the session
      const { data: sessionData, error: sessionError } =
        await authenticatedClient
          .from('sessions')
          .select('id')
          .eq('id', sessionId)
          .eq('user_id', currentUser.id)
          .single();

      if (sessionError || !sessionData) {
        this.logger.warn(
          `User ${currentUser.id} attempted to access enhanced messages for session ${sessionId} they don't own or doesn't exist`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      // Build query with optional joins
      const selectQuery = `
        *
        ${options.includeLlmData ? ', provider:providers(*), model:models(*)' : ''}
      `;

      // Fetch enhanced messages
      const { data, error } = await authenticatedClient
        .from('messages')
        .select(selectQuery)
        .eq('session_id', sessionId)
        .order('order', { ascending: true })
        .range(options.skip, options.skip + options.limit - 1);

      if (error) {
        this.logger.error(
          `Error listing enhanced messages for session ${sessionId}, user ${currentUser.id}: ${error.message}`,
        );
        throw new HttpException(
          error.message || 'Error listing enhanced messages.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Transform to enhanced message format using case converter
      const enhancedMessages: EnhancedMessageResponseDto[] = (data || []).map(
        (message: any) => mapEnhancedMessageFromDb(message),
      );

      return enhancedMessages;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error getting enhanced messages for session ${sessionId}, user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
