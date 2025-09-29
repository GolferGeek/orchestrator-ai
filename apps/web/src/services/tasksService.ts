import { apiService } from './apiService';
import { useApiSanitization } from '@/composables/useApiSanitization';
interface Task {
  id: string;
  agentConversationId: string;
  userId: string;
  method: string;
  prompt: string;
  params?: Record<string, any>;
  response?: string;
  responseMetadata?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string;
  evaluation?: Record<string, any>;
  llmMetadata?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  errorData?: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  timeoutSeconds: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
interface LLMSelection {
  providerName?: string;
  modelName?: string;
  cidafmOptions?: {
    activeStateModifiers?: string[];
    responseModifiers?: string[];
    executedCommands?: string[];
    customOptions?: Record<string, any>;
  };
  temperature?: number;
  maxTokens?: number;
}
interface CreateTaskDto {
  method: string;
  prompt: string;
  params?: Record<string, any>;
  conversationId?: string;
  taskId?: string; // Optional, pre-generated task ID from frontend
  timeoutSeconds?: number;
  llmSelection?: LLMSelection;
  executionMode?: 'immediate' | 'polling' | 'websocket'; // Execution mode for backend processing
  conversationHistory?: Array<{
    role: string;
    content: string;
    timestamp: string;
    taskId?: string;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>; // Context metadata for deliverable/project operations
}
interface UpdateTaskDto {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  progressMessage?: string;
  response?: string;
  responseMetadata?: Record<string, any>;
  evaluation?: Record<string, any>;
  llmMetadata?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  errorData?: Record<string, any>;
}
interface TaskQueryParams {
  conversationId?: string;
  userId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
interface ListTasksResponse {
  tasks: Task[];
  total: number;
}
interface TaskProgressEvent {
  taskId: string;
  progress: number;
  message?: string;
  status?: string;
  metadata?: Record<string, any>;
}
class TasksService {
  private readonly baseUrl = '/tasks';
  private apiSanitization = useApiSanitization();
  /**
   * List tasks
   */
  async listTasks(params?: TaskQueryParams): Promise<ListTasksResponse> {
    const queryParams = new URLSearchParams();
    if (params?.conversationId) queryParams.append('conversationId', params.conversationId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    const url = queryParams.toString() 
      ? `${this.baseUrl}?${queryParams.toString()}`
      : this.baseUrl;
    const response = await apiService.get(url);
    return response;
  }
  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await apiService.get(`${this.baseUrl}/${taskId}`);
    return response;
  }
  /**
   * Update task
   */
  async updateTask(taskId: string, updates: UpdateTaskDto): Promise<Task> {
    const response = await apiService.put(`${this.baseUrl}/${taskId}`, updates);
    return response;
  }
  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete(`${this.baseUrl}/${taskId}`);
    return response;
  }
  /**
   * Get active tasks
   */
  async getActiveTasks(): Promise<Task[]> {
    const response = await apiService.get(`${this.baseUrl}/active`);
    return response;
  }
  /**
   * Get real-time task status (optimized for polling)
   */
  async getTaskStatus(taskId: string): Promise<{
    taskId: string;
    status: string;
    progress: number;
    progressMessage?: string;
    data?: any;
  }> {
    const response = await apiService.get(`${this.baseUrl}/${taskId}/status`);
    return response;
  }
  /**
   * Get accumulated task messages (for polling clients)
   */
  async getTaskMessages(taskId: string): Promise<Array<{
    id: string;
    taskId: string;
    content: string;
    messageType: 'progress' | 'status' | 'info' | 'warning' | 'error';
    progressPercentage?: number;
    metadata?: Record<string, any>;
    createdAt: string;
  }>> {
    const response = await apiService.get(`${this.baseUrl}/${taskId}/messages`);
    return response;
  }
  /**
   * Update task progress
   */
  async updateTaskProgress(taskId: string, progress: number, message?: string): Promise<{ success: boolean }> {
    const response = await apiService.put(`${this.baseUrl}/${taskId}/progress`, {
      progress,
      message,
    });
    return response;
  }
  /**
   * Stream task progress via SSE
   */
  async *streamTaskProgress(taskId: string): AsyncGenerator<TaskProgressEvent> {
    const response = await fetch(`${apiService.getBaseUrl()}${this.baseUrl}/${taskId}/progress`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        'Accept': 'text/event-stream',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to stream task progress: ${response.statusText}`);
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              yield data as TaskProgressEvent;
              // Stop if task is completed
              if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
                return;
              }
            } catch (error) {
              // Error parsing SSE data - skip this line
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  /**
   * Create task via direct agent call
   */
  async createAgentTask(
    agentType: string,
    agentName: string,
    taskData: CreateTaskDto,
    options?: { namespace?: string | null }
  ): Promise<{
    taskId: string;
    conversationId: string;
    status: string;
    result?: any;
  }> {
    // Validate routing inputs early – never fall back silently
    if (!agentType || !agentName) {
      throw new Error('Cannot create agent task: missing agentType or agentName');
    }

    // Normalize agentType to match backend discovery paths
    // Backend discovers specialists under "specialists/<name>"
    const normalizedAgentType = agentType === 'specialist' ? 'specialists' : agentType;
    const url = `/agents/${normalizedAgentType}/${agentName}/tasks`;
    // Sanitize the task data before sending
    const sanitizedTaskData = this.apiSanitization.sanitizeTaskRequest(taskData);

    // Debug: Log what's being sent to the backend
    console.log('🚀 Sending task to backend:', {
      url,
      llmSelection: sanitizedTaskData.llmSelection,
      hasLlmSelection: !!sanitizedTaskData.llmSelection,
      method: sanitizedTaskData.method
    });

    const response = await apiService.post(url, sanitizedTaskData);
    return response;
  }
  /**
   * Get task by ID (alias for getTask)
   */
  async getTaskById(taskId: string): Promise<Task> {
    return this.getTask(taskId);
  }
  /**
   * Evaluate task
   */
  async evaluateTask(taskId: string, evaluation: any): Promise<Task> {
    const response = await apiService.post(`/evaluation/tasks/${taskId}`, evaluation);
    return response;
  }
  /**
   * Get task evaluation
   */
  async getTaskEvaluation(taskId: string): Promise<Task> {
    const response = await apiService.get(`/evaluation/tasks/${taskId}`);
    return response;
  }
  /**
   * Update task evaluation
   */
  async updateTaskEvaluation(taskId: string, evaluation: any): Promise<Task> {
    const response = await apiService.put(`/evaluation/tasks/${taskId}`, evaluation);
    return response;
  }
  /**
   * Get conversation task evaluations
   */
  async getConversationTaskEvaluations(
    conversationId: string,
    filters?: { minRating?: number; hasNotes?: boolean }
  ): Promise<Task[]> {
    const queryParams = new URLSearchParams();
      if (filters?.minRating) queryParams.append('minRating', filters.minRating.toString());
  if (filters?.hasNotes) queryParams.append('hasNotes', filters.hasNotes.toString());
    const url = queryParams.toString() 
      ? `/evaluation/conversations/${conversationId}/tasks?${queryParams.toString()}`
      : `/evaluation/conversations/${conversationId}/tasks`;
    const response = await apiService.get(url);
    return response;
  }
}
export const tasksService = new TasksService();
export default tasksService;
