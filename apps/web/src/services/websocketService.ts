import { io, Socket } from 'socket.io-client';
import { ref, reactive } from 'vue';
import { useAuthStore } from '@/stores/authStore';

interface TaskProgressEvent {
  taskId: string;
  progress: number;
  message?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  metadata?: Record<string, any>;
}

interface TaskEvent {
  taskId: string;
  conversationId?: string;
  userId?: string;
  agentName?: string;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;

  // Reactive state
  public connected = ref(false);
  public connecting = ref(false);
  public error = ref<string | null>(null);
  public taskProgress = reactive<Map<string, TaskProgressEvent>>(new Map());
  public subscribedTasks = reactive<Set<string>>(new Set());

  // Event callbacks
  private progressCallbacks = new Map<string, Array<(event: TaskProgressEvent) => void>>();
  private taskEventCallbacks = new Map<string, Array<(event: TaskEvent) => void>>();

  constructor() {
    this.initializeConnection();
  }

  /**
   * Initialize WebSocket connection
   */
  private async initializeConnection() {
    if (this.socket?.connected) {
      return;
    }

    this.connecting.value = true;
    this.error.value = null;

    try {
      const authStore = useAuthStore();
      const token = authStore.token;
      if (!token) {
        throw new Error('No authentication token available');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const wsUrl = apiUrl.replace(/^http/, 'ws');

      this.socket = io(`${wsUrl}/task-progress`, {
        auth: {
          token,
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectInterval,
      });

      this.setupEventListeners();
    } catch (error) {
      this.error.value = error instanceof Error ? error.message : 'Connection failed';
      this.connecting.value = false;
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected.value = true;
      this.connecting.value = false;
      this.error.value = null;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connected.value = false;
      this.connecting.value = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.error.value = error.message;
      this.connecting.value = false;
      
      // Exponential backoff for reconnection
      this.reconnectAttempts++;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectInterval *= 2;
          this.initializeConnection();
        }, this.reconnectInterval);
      }
    });

    // Task progress events
    this.socket.on('task_progress', (event: TaskProgressEvent) => {
      console.log('Task progress update:', event);
      this.taskProgress.set(event.taskId, event);
      
      // Call registered callbacks
      const callbacks = this.progressCallbacks.get(event.taskId) || [];
      callbacks.forEach(callback => callback(event));
    });

    // Task lifecycle events
    this.socket.on('task_created', (event: TaskEvent) => {
      console.log('Task created:', event);
      this.emitTaskEvent('created', event);
    });

    this.socket.on('task_completed', (event: TaskEvent) => {
      console.log('Task completed:', event);
      this.emitTaskEvent('completed', event);
      this.subscribedTasks.delete(event.taskId);
    });

    this.socket.on('task_failed', (event: TaskEvent) => {
      console.log('Task failed:', event);
      this.emitTaskEvent('failed', event);
      this.subscribedTasks.delete(event.taskId);
    });

    this.socket.on('task_cancelled', (event: TaskEvent) => {
      console.log('Task cancelled:', event);
      this.emitTaskEvent('cancelled', event);
      this.subscribedTasks.delete(event.taskId);
    });

    // Subscription confirmations
    this.socket.on('subscription_confirmed', (data: { taskId: string }) => {
      console.log('Subscription confirmed for task:', data.taskId);
      this.subscribedTasks.add(data.taskId);
    });

    this.socket.on('subscription_error', (data: { taskId: string; message: string }) => {
      console.error('Subscription error for task:', data.taskId, data.message);
      this.subscribedTasks.delete(data.taskId);
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error.message);
      this.error.value = error.message;
    });
  }

  /**
   * Subscribe to task progress updates
   */
  public subscribeToTask(taskId: string, callback?: (event: TaskProgressEvent) => void): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected, queuing subscription');
      // Queue subscription for when connection is ready
      this.socket?.on('connect', () => this.subscribeToTask(taskId, callback));
      return;
    }

    this.socket.emit('subscribe_task', { taskId });

    if (callback) {
      if (!this.progressCallbacks.has(taskId)) {
        this.progressCallbacks.set(taskId, []);
      }
      this.progressCallbacks.get(taskId)!.push(callback);
    }
  }

  /**
   * Unsubscribe from task progress updates
   */
  public unsubscribeFromTask(taskId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('unsubscribe_task', { taskId });
    this.progressCallbacks.delete(taskId);
    this.taskProgress.delete(taskId);
    this.subscribedTasks.delete(taskId);
  }

  /**
   * Subscribe to task events (created, completed, failed, cancelled)
   */
  public onTaskEvent(event: string, callback: (event: TaskEvent) => void): void {
    const key = `task_${event}`;
    if (!this.taskEventCallbacks.has(key)) {
      this.taskEventCallbacks.set(key, []);
    }
    this.taskEventCallbacks.get(key)!.push(callback);
  }

  /**
   * Emit task events to registered callbacks
   */
  private emitTaskEvent(event: string, data: TaskEvent): void {
    const key = `task_${event}`;
    const callbacks = this.taskEventCallbacks.get(key) || [];
    callbacks.forEach(callback => callback(data));
  }

  /**
   * Get current progress for a task
   */
  public getTaskProgress(taskId: string): TaskProgressEvent | undefined {
    return this.taskProgress.get(taskId);
  }

  /**
   * Reconnect to WebSocket
   */
  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.reconnectInterval = 1000;
    this.initializeConnection();
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected.value = false;
    this.connecting.value = false;
    this.taskProgress.clear();
    this.subscribedTasks.clear();
    this.progressCallbacks.clear();
    this.taskEventCallbacks.clear();
  }

  /**
   * Get connection status
   */
  public getStatus() {
    return {
      connected: this.connected.value,
      connecting: this.connecting.value,
      error: this.error.value,
      subscribedTasks: Array.from(this.subscribedTasks),
    };
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;