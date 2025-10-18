import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { getTableName } from '../../supabase/supabase.config';
// No AgentType import needed - we treat agent_type as a simple string

/**
 * Database record type for conversations table
 */
interface ConversationDbRecord {
  id: string;
  user_id: string;
  agent_name: string;
  agent_type: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Database record type for tasks table
 */
interface TaskDbRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  status: string;
  params: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * LLM Selection configuration interface
 */
export interface LlmSelection {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

/**
 * Conversation history message interface
 */
export interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Task parameters interface
 */
export interface TaskParams {
  method: string;
  prompt: string;
  conversationId?: string;
  metadata?: {
    protocol?: string;
    llmSelection?: LlmSelection;
    conversationHistory?: ConversationMessage[];
    [key: string]: unknown;
  };
}

/**
 * Task data for database insertion
 */
interface TaskData {
  id?: string;
  user_id: string;
  conversation_id: string;
  method: string;
  prompt: string;
  status: string;
  params: TaskParams;
}

/**
 * Task record from database
 */
export interface TaskRecord {
  id: string;
  user_id: string;
  conversation_id: string;
  method: string;
  prompt: string;
  status: string;
  params: TaskParams;
  result?: Record<string, unknown>;
  error?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Agent2Agent-specific Tasks Service
 * Handles task creation and management for A2A Google protocol agents
 * Isolated from legacy file-based agent system
 */
@Injectable()
export class Agent2AgentTasksService {
  private readonly logger = new Logger(Agent2AgentTasksService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Create a task for an A2A agent
   * Conforms to A2A Google protocol standards
   */
  async createTask(
    userId: string,
    agentName: string,
    agentType: string, // Simple string - no enum validation needed
    params: {
      method: string;
      prompt: string;
      conversationId?: string;
      taskId?: string;
      metadata?: Record<string, unknown>;
      llmSelection?: LlmSelection;
      conversationHistory?: ConversationMessage[];
    },
  ): Promise<{
    id: string;
    userId: string;
    agentName: string;
    namespace: string | null; // Organization slug from conversation (null for global agents)
    agentConversationId: string | null;
    status: string;
    params: TaskParams;
    createdAt: Date;
  }> {
    this.logger.debug(
      `🚨 [Agent2AgentTasksService.createTask] Received agentType: "${agentType}" for agent: ${agentName}`,
    );

    try {
      // If conversationId provided, validate it exists
      let conversationId = params.conversationId || null;
      if (conversationId) {
        const { data } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('conversations'))
          .select('id')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .single();

        const existingConv = data as Pick<ConversationDbRecord, 'id'> | null;

        if (!existingConv) {
          this.logger.warn(
            `Conversation ${conversationId} not found, will create new one`,
          );
          conversationId = null;
        }
      }

      // Create conversation if needed
      if (!conversationId) {
        this.logger.log(
          `🚨 [Agent2AgentTasksService] Creating conversation with agentType: "${agentType}"`,
        );

        const now = new Date().toISOString();
        const conversationData = {
          user_id: userId,
          agent_name: agentName,
          agent_type: agentType,
          started_at: now,
          last_active_at: now,
          metadata: {
            source: 'agent2agent',
            method: params.method,
            protocol: 'a2a-google',
            title: `${agentName} - ${new Date().toLocaleDateString()}`, // Store title in metadata
          },
        };

        this.logger.log(
          `🚨 [Agent2AgentTasksService] Conversation data:`,
          JSON.stringify(conversationData),
        );

        const { data: newConv, error: convError } = await this.supabaseService
          .getServiceClient()
          .from(getTableName('conversations'))
          .insert([conversationData])
          .select('id')
          .single();

        if (convError) {
          throw new Error(
            `Failed to create conversation: ${convError.message}`,
          );
        }

        conversationId = newConv.id;
        this.logger.debug(
          `✅ Created new A2A conversation ${conversationId} for agent ${agentName}`,
        );
      }

      // At this point, conversationId is guaranteed to be a string
      if (!conversationId) {
        throw new Error('Conversation ID is required but was not created');
      }

      // Create task record (agent info is stored in the linked conversation)
      const taskData: TaskData = {
        user_id: userId,
        conversation_id: conversationId,
        method: params.method,
        prompt: params.prompt,
        status: 'pending',
        params: {
          method: params.method,
          prompt: params.prompt,
          conversationId,
          metadata: {
            ...params.metadata,
            protocol: 'a2a-google',
            llmSelection: params.llmSelection,
            conversationHistory: params.conversationHistory,
          },
        },
      };

      // Only include id if taskId is provided (otherwise let DB generate it)
      if (params.taskId) {
        taskData.id = params.taskId;
      }

      const { data: task, error: taskError } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .insert([taskData])
        .select('*')
        .single();

      if (taskError) {
        throw new Error(`Failed to create task: ${taskError.message}`);
      }

      this.logger.debug(
        `✅ Created A2A task ${task.id} in conversation ${conversationId}`,
      );

      return {
        id: task.id,
        userId: task.user_id,
        agentName: agentName, // Use the parameter since it's not in the task record
        namespace: null, // Conversation was created without organization_slug, so it's null
        agentConversationId: task.conversation_id,
        status: task.status,
        params: task.params,
        createdAt: new Date(task.created_at as string),
      };
    } catch (error) {
      this.logger.error('Failed to create A2A task:', error);
      throw error;
    }
  }

  /**
   * Get a task by ID
   * A2A protocol: task tracking and status queries
   */
  async getTaskById(
    taskId: string,
    userId: string,
  ): Promise<{
    id: string;
    userId: string;
    agentName: string;
    namespace: string | null; // Organization slug from conversation (null for global agents)
    agentConversationId: string | null;
    status: string;
    params: TaskParams;
    result?: Record<string, unknown>;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      const { data: task, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .select(
          `
          *,
          conversations!inner(agent_name, agent_type)
        `,
        )
        .eq('id', taskId)
        .eq('user_id', userId)
        .single();

      if (error || !task) {
        return null;
      }

      return {
        id: task.id,
        userId: task.user_id,
        agentName: task.conversations?.agent_name || 'unknown',
        namespace: task.conversations?.organization_slug || null,
        agentConversationId: task.conversation_id,
        status: task.status,
        params: task.params,
        result: task.result,
        error: task.error,
        createdAt: new Date(task.created_at as string),
        updatedAt: new Date(task.updated_at as string),
      };
    } catch (error) {
      this.logger.error(`Failed to get A2A task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get all tasks for a conversation
   * A2A protocol: conversation history and context
   */
  async getTasksByConversation(
    conversationId: string,
    userId: string,
  ): Promise<TaskRecord[]> {
    try {
      const { data: tasks, error } = await this.supabaseService
        .getServiceClient()
        .from(getTableName('tasks'))
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get conversation tasks: ${error.message}`);
      }

      return tasks || [];
    } catch (error) {
      this.logger.error(
        `Failed to get tasks for conversation ${conversationId}:`,
        error,
      );
      return [];
    }
  }
}
