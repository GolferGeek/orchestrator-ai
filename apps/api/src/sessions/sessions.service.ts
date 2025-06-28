import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthUserDto } from '../auth/dto/auth.dto';
import {
  SessionCreateDto,
  SessionResponseDto,
  SessionListResponseDto,
  MessageResponseDto,
  MessageListResponseDto,
} from './dto/session.dto';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

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
        profile_id: currentUser.id,
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
        user_id: data.profile_id,
        name: data.name,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
        .eq('profile_id', currentUser.id)
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
        user_id: session.profile_id,
        name: session.name,
        created_at: session.created_at,
        updated_at: session.updated_at,
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
        .eq('profile_id', currentUser.id)
        .single();

      if (error || !data) {
        this.logger.warn(
          `Session ${sessionId} not found for user ${currentUser.id} or access denied`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      return {
        id: data.id,
        user_id: data.profile_id,
        name: data.name,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
          .eq('profile_id', currentUser.id)
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
        session_id: message.session_id,
        user_id: message.profile_id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        order: message.order,
        metadata: message.metadata,
      }));

      return {
        messages,
        session_id: sessionId,
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
        'An unexpected error occurred while listing messages.',
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
      `Adding message to session ${sessionId}, user: ${currentUser?.id}, hasToken: ${!!token}`,
    );

    try {
      const authenticatedClient = token
        ? this.supabaseService.createAuthenticatedClient(token)
        : this.supabaseService.getAnonClient();

      // Verify session exists and get owner if currentUser is provided
      if (currentUser) {
        const { data: sessionData, error: sessionError } =
          await authenticatedClient
            .from('sessions')
            .select('id, profile_id')
            .eq('id', sessionId)
            .eq('profile_id', currentUser.id)
            .single();

        if (sessionError || !sessionData) {
          this.logger.warn(
            `Session ${sessionId} not found for user ${currentUser.id} or access denied`,
          );
          throw new NotFoundException('Session not found or access denied.');
        }
      }

      // Get current message count to determine order
      const { count: messageCount } = await authenticatedClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);

      const order = (messageCount || 0) + 1;

      // Prepare message data
      const messageToInsert = {
        session_id: sessionId,
        profile_id: currentUser?.id || null,
        role: messageData.role,
        content: messageData.content || null,
        order: order,
        metadata: messageData.metadata || null,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        `Attempting to insert message: ${JSON.stringify(messageToInsert)}`,
      );

      const { data, error } = await authenticatedClient
        .from('messages')
        .insert(messageToInsert)
        .select()
        .single();

      if (error || !data) {
        this.logger.error(
          `Failed to add message to session ${sessionId}. Error: ${error?.message}, Code: ${error?.code}, Details: ${error?.details}`,
        );
        throw new HttpException(
          error?.message || 'Could not add message.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`Successfully added message with ID: ${data.id}`);

      return {
        id: data.id,
        session_id: data.session_id,
        user_id: data.profile_id,
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
        'An unexpected error occurred while adding message.',
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
          .eq('profile_id', currentUser.id)
          .single();

      if (sessionError || !sessionData) {
        this.logger.warn(
          `User ${currentUser.id} attempted to delete session ${sessionId} they don't own or doesn't exist`,
        );
        throw new NotFoundException('Session not found or access denied.');
      }

      // Delete the session
      const { error } = await authenticatedClient
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('profile_id', currentUser.id);

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
        `Session ${sessionId} deleted successfully for user ${currentUser.id}`,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error deleting session ${sessionId} for user ${currentUser.id}: ${error}`,
      );
      throw new HttpException(
        'An unexpected error occurred while deleting session.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
