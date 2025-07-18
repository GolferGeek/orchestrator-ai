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

interface WorkflowStepEvent {
  taskId: string;
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  metadata?: Record<string, any>;
}

interface DeliverableEvent {
  taskId: string;
  title: string;
  content: string;
  deliverableType: 'document' | 'analysis' | 'report' | 'plan' | 'requirements';
  format: 'markdown' | 'text' | 'json' | 'html';
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
  public workflowSteps = reactive<Map<string, WorkflowStepEvent[]>>(new Map());
  public deliverables = reactive<Map<string, DeliverableEvent[]>>(new Map());
  public subscribedTasks = reactive<Set<string>>(new Set());

  // Event callbacks
  private progressCallbacks = new Map<string, Array<(event: TaskProgressEvent) => void>>();
  private taskEventCallbacks = new Map<string, Array<(event: TaskEvent) => void>>();
  private workflowStepCallbacks = new Map<string, Array<(event: WorkflowStepEvent) => void>>();
  private deliverableCallbacks = new Map<string, Array<(event: DeliverableEvent) => void>>();
  
  // Global event callbacks (for all tasks)
  private globalWorkflowStepCallbacks: Array<(event: WorkflowStepEvent) => void> = [];
  private globalTaskEventCallbacks: Array<(event: TaskEvent) => void> = [];

  constructor() {
    // Don't initialize connection immediately - wait for user to need it
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
      // Try to get auth token, but don't require it
      let token: string | null = null;
      try {
        const authStore = useAuthStore();
        token = authStore.token;
        if (token) {
          console.log('🔑 Using authenticated WebSocket connection');
        } else {
          console.log('🔓 Using anonymous WebSocket connection');
        }
      } catch (error) {
        console.log('🔓 Auth store not available, using anonymous WebSocket connection');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const wsUrl = apiUrl.replace(/^http/, 'ws');

      this.socket = io(`${wsUrl}/task-progress`, {
        auth: token ? { token } : undefined,
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
      console.log('🔗 WebSocket connected successfully!');
      this.connected.value = true;
      this.connecting.value = false;
      this.error.value = null;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.connected.value = false;
      this.connecting.value = false;
    });

    this.socket.on('connect_error', (error) => {
      console.log('🚫 WebSocket connection error:', error);
      this.error.value = error.message;
      this.connecting.value = false;
      
      // Exponential backoff for reconnection
      this.reconnectAttempts++;
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log(`🔄 Retrying WebSocket connection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.reconnectInterval *= 2;
          this.initializeConnection();
        }, this.reconnectInterval);
      }
    });

    // Task progress events
    this.socket.on('task_progress', (event: TaskProgressEvent) => {
      console.log('📊 Task progress event:', event);
      this.taskProgress.set(event.taskId, event);
      
      // Call registered callbacks
      const callbacks = this.progressCallbacks.get(event.taskId) || [];
      callbacks.forEach(callback => callback(event));
    });

    // Workflow step events
    this.socket.on('workflow_step_started', (event: WorkflowStepEvent) => {
      console.log('🎬 Workflow step started:', event);
      this.handleWorkflowStepEvent(event);
    });

    this.socket.on('workflow_step_completed', (event: WorkflowStepEvent) => {
      console.log('✅ Workflow step completed:', event);
      this.handleWorkflowStepEvent(event);
    });

    this.socket.on('workflow_step_failed', (event: WorkflowStepEvent) => {
      console.log('❌ Workflow step failed:', event);
      this.handleWorkflowStepEvent(event);
    });

    // Workflow step progress events (for real-time step updates)
    this.socket.on('workflow_step_progress', (event: WorkflowStepEvent) => {
      console.log('🔧 Workflow step progress:', event);
      this.handleWorkflowStepEvent(event);
    });

    // Subscription confirmation events
    this.socket.on('subscription_confirmed', (data) => {
      console.log('✅ Subscription confirmed for task:', data.taskId);
    });

    // Deliverable events
    this.socket.on('deliverable_generated', (event: DeliverableEvent) => {
      this.handleDeliverableEvent(event);
    });

    this.socket.on('deliverable_updated', (event: DeliverableEvent) => {
      this.handleDeliverableEvent(event);
    });

    // Task lifecycle events
    this.socket.on('task_created', (event: TaskEvent) => {
      console.log('🆕 Task created:', event);
      this.emitTaskEvent('created', event);
    });

    this.socket.on('task_completed', (event: TaskEvent) => {
      console.log('🎉 Task completed:', event);
      this.emitTaskEvent('completed', event);
      this.subscribedTasks.delete(event.taskId);
    });

    this.socket.on('task_failed', (event: TaskEvent) => {
      console.log('💥 Task failed:', event);
      this.emitTaskEvent('failed', event);
      this.subscribedTasks.delete(event.taskId);
    });

    this.socket.on('task_cancelled', (event: TaskEvent) => {
      console.log('🚫 Task cancelled:', event);
      this.emitTaskEvent('cancelled', event);
      this.subscribedTasks.delete(event.taskId);
    });

    // Subscription confirmations
    this.socket.on('subscription_confirmed', (data: { taskId: string }) => {
      console.log('✅ Subscription confirmed for task:', data.taskId);
      this.subscribedTasks.add(data.taskId);
    });

    this.socket.on('subscription_error', (data: { taskId: string; message: string }) => {
      console.log('❌ Subscription error for task:', data.taskId, data.message);
      this.subscribedTasks.delete(data.taskId);
    });

    this.socket.on('error', (error: { message: string }) => {
      this.error.value = error.message;
    });
  }

  /**
   * Ensure WebSocket connection is established (called when user actually needs WebSocket)
   */
  public async ensureConnection(): Promise<void> {
    if (!this.socket?.connected && !this.connecting.value) {
      console.log('🔌 User action requires WebSocket - initializing connection...');
      await this.initializeConnection();
    }
  }

  /**
   * Subscribe to task progress updates
   */
  public subscribeToTask(taskId: string, callback?: (event: TaskProgressEvent) => void): void {
    // Ensure connection is established first
    this.ensureConnection();
    
    if (!this.socket?.connected) {
      console.log('⚠️ WebSocket not connected, queuing subscription for:', taskId);
      // Queue subscription for when connection is ready
      this.socket?.on('connect', () => this.subscribeToTask(taskId, callback));
      return;
    }

    console.log('📡 Emitting subscribe_task for:', taskId);
    console.log('📡 WebSocket connected status:', this.socket.connected);
    console.log('📡 WebSocket ID:', this.socket.id);
    
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
    
    // Call global callbacks
    this.globalTaskEventCallbacks.forEach(callback => callback(data));
  }

  /**
   * Handle workflow step events
   */
  private handleWorkflowStepEvent(event: WorkflowStepEvent): void {
    const existingSteps = this.workflowSteps.get(event.taskId) || [];
    
    // Update or add the step
    const existingStepIndex = existingSteps.findIndex(step => step.stepName === event.stepName);
    if (existingStepIndex >= 0) {
      existingSteps[existingStepIndex] = event;
    } else {
      existingSteps.push(event);
    }
    
    // Sort by step index
    existingSteps.sort((a, b) => a.stepIndex - b.stepIndex);
    
    this.workflowSteps.set(event.taskId, existingSteps);
    
    // Call registered callbacks for specific task
    const callbacks = this.workflowStepCallbacks.get(event.taskId) || [];
    callbacks.forEach(callback => callback(event));
    
    // Call global callbacks
    this.globalWorkflowStepCallbacks.forEach(callback => callback(event));
  }

  /**
   * Handle deliverable events
   */
  private handleDeliverableEvent(event: DeliverableEvent): void {
    const existingDeliverables = this.deliverables.get(event.taskId) || [];
    
    // Add or update the deliverable
    const existingDeliverableIndex = existingDeliverables.findIndex(d => d.title === event.title);
    if (existingDeliverableIndex >= 0) {
      existingDeliverables[existingDeliverableIndex] = event;
    } else {
      existingDeliverables.push(event);
    }
    
    this.deliverables.set(event.taskId, existingDeliverables);
    
    // Call registered callbacks
    const callbacks = this.deliverableCallbacks.get(event.taskId) || [];
    callbacks.forEach(callback => callback(event));
  }

  /**
   * Get current progress for a task
   */
  public getTaskProgress(taskId: string): TaskProgressEvent | undefined {
    return this.taskProgress.get(taskId);
  }

  /**
   * Get workflow steps for a task
   */
  public getWorkflowSteps(taskId: string): WorkflowStepEvent[] {
    return this.workflowSteps.get(taskId) || [];
  }

  /**
   * Get deliverables for a task
   */
  public getDeliverables(taskId: string): DeliverableEvent[] {
    return this.deliverables.get(taskId) || [];
  }

  /**
   * Subscribe to workflow step events
   */
  public onWorkflowStep(taskId: string, callback: (event: WorkflowStepEvent) => void): void {
    if (!this.workflowStepCallbacks.has(taskId)) {
      this.workflowStepCallbacks.set(taskId, []);
    }
    this.workflowStepCallbacks.get(taskId)!.push(callback);
  }

  /**
   * Subscribe to deliverable events
   */
  public onDeliverable(taskId: string, callback: (event: DeliverableEvent) => void): void {
    if (!this.deliverableCallbacks.has(taskId)) {
      this.deliverableCallbacks.set(taskId, []);
    }
    this.deliverableCallbacks.get(taskId)!.push(callback);
  }

  /**
   * Subscribe to all workflow step events (global)
   */
  public onAllWorkflowSteps(callback: (event: WorkflowStepEvent) => void): void {
    this.globalWorkflowStepCallbacks.push(callback);
  }

  /**
   * Subscribe to all task events (global)
   */
  public onAllTaskEvents(callback: (event: TaskEvent) => void): void {
    this.globalTaskEventCallbacks.push(callback);
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
    this.workflowSteps.clear();
    this.deliverables.clear();
    this.subscribedTasks.clear();
    this.progressCallbacks.clear();
    this.taskEventCallbacks.clear();
    this.workflowStepCallbacks.clear();
    this.deliverableCallbacks.clear();
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