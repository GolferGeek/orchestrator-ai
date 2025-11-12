import { ref, onUnmounted, computed } from 'vue';
import { useAuthStore } from '@/stores/authStore';

export interface ObservabilityEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  user_id: string | null;
  username: string | null;
  conversation_id: string | null;
  task_id: string;
  agent_slug: string | null;
  organization_slug: string | null;
  mode: string | null;
  status: string;
  message: string | null;
  progress: number;
  step: string;
  payload: Record<string, unknown>;
  timestamp: number;
  created_at?: string;
  eventType?: string;
}

export interface AgentActivity {
  agentSlug: string;
  lastEvent: ObservabilityEvent;
  events: ObservabilityEvent[];
  status: 'active' | 'idle' | 'error';
}

/**
 * Composable for connecting to the admin observability SSE stream
 * Provides real-time monitoring of all agent executions
 */
export function useAdminObservabilityStream() {
  const authStore = useAuthStore();
  
  // Connection state
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const error = ref<string | null>(null);
  const lastHeartbeat = ref<Date | null>(null);
  
  // Events storage
  const allEvents = ref<ObservabilityEvent[]>([]);
  const recentEvents = computed(() => allEvents.value.slice(-100)); // Last 100 events
  
  // Agent activities (grouped by agent slug)
  const agentActivities = computed<Record<string, AgentActivity>>(() => {
    const activities: Record<string, AgentActivity> = {};
    
    for (const event of allEvents.value) {
      if (!event.agent_slug) continue;
      
      if (!activities[event.agent_slug]) {
        activities[event.agent_slug] = {
          agentSlug: event.agent_slug,
          lastEvent: event,
          events: [],
          status: 'idle',
        };
      }
      
      const activity = activities[event.agent_slug];
      activity.events.push(event);
      activity.lastEvent = event;
      
      // Determine status based on most recent event
      if (event.hook_event_type === 'agent.failed') {
        activity.status = 'error';
      } else if (
        event.hook_event_type === 'agent.started' ||
        event.hook_event_type === 'agent.progress'
      ) {
        activity.status = 'active';
      } else if (event.hook_event_type === 'agent.completed') {
        activity.status = 'idle';
      }
    }
    
    return activities;
  });
  
  // Filter helpers
  const eventsByConversation = computed(() => {
    const byConv: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      if (!event.conversation_id) continue;
      if (!byConv[event.conversation_id]) {
        byConv[event.conversation_id] = [];
      }
      byConv[event.conversation_id].push(event);
    }
    return byConv;
  });
  
  const eventsByTask = computed(() => {
    const byTask: Record<string, ObservabilityEvent[]> = {};
    for (const event of allEvents.value) {
      if (!event.task_id) continue;
      if (!byTask[event.task_id]) {
        byTask[event.task_id] = [];
      }
      byTask[event.task_id].push(event);
    }
    return byTask;
  });
  
  // SSE connection
  let eventSource: EventSource | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  /**
   * Connect to the admin observability SSE stream
   */
  async function connect(): Promise<void> {
    if (isConnecting.value || isConnected.value) {
      return;
    }
    
    // Ensure we have an auth token
    const token = authStore.token;
    if (!token) {
      error.value = 'Authentication token required';
      return;
    }
    
    try {
      isConnecting.value = true;
      error.value = null;
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:7100';
      const url = `${apiUrl}/observability/stream`;
      
      // Create EventSource with authorization header (via query param as workaround)
      // Note: EventSource doesn't support custom headers, so we'd need to send token as query param
      // OR implement a different auth strategy for SSE. For now, using query param:
      const urlWithAuth = `${url}?token=${encodeURIComponent(token)}`;
      
      eventSource = new EventSource(urlWithAuth);
      
      eventSource.onopen = () => {
        isConnected.value = true;
        isConnecting.value = false;
        reconnectAttempts = 0;
        lastHeartbeat.value = new Date();
        console.log('✅ Connected to admin observability stream');
      };
      
      eventSource.onmessage = (event: MessageEvent) => {
        try {
          // Handle heartbeat
          if (event.data === ': heartbeat') {
            lastHeartbeat.value = new Date();
            return;
          }
          
          const data = JSON.parse(event.data) as ObservabilityEvent;
          allEvents.value.push(data);
          lastHeartbeat.value = new Date();
          
          // Limit stored events to prevent memory issues
          if (allEvents.value.length > 1000) {
            allEvents.value = allEvents.value.slice(-500);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };
      
      eventSource.onerror = () => {
        console.error('SSE connection error');
        disconnect();
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          error.value = `Connection lost. Reconnecting in ${delay / 1000}s...`;
          
          reconnectTimeout = setTimeout(() => {
            connect();
          }, delay);
        } else {
          error.value = 'Connection lost. Maximum reconnection attempts reached.';
        }
      };
    } catch (err) {
      isConnecting.value = false;
      error.value = err instanceof Error ? err.message : 'Connection failed';
      console.error('Failed to connect to observability stream:', err);
    }
  }
  
  /**
   * Disconnect from the SSE stream
   */
  function disconnect(): void {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    isConnected.value = false;
    isConnecting.value = false;
  }
  
  /**
   * Clear all stored events
   */
  function clearEvents(): void {
    allEvents.value = [];
  }
  
  /**
   * Get events for a specific conversation
   */
  function getConversationEvents(conversationId: string): ObservabilityEvent[] {
    return eventsByConversation.value[conversationId] || [];
  }
  
  /**
   * Get events for a specific task
   */
  function getTaskEvents(taskId: string): ObservabilityEvent[] {
    return eventsByTask.value[taskId] || [];
  }
  
  /**
   * Get events for a specific agent
   */
  function getAgentEvents(agentSlug: string): ObservabilityEvent[] {
    return allEvents.value.filter(e => e.agent_slug === agentSlug);
  }
  
  // Auto-disconnect on unmount
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    // Connection state
    isConnected,
    isConnecting,
    error,
    lastHeartbeat,
    
    // Events
    allEvents,
    recentEvents,
    agentActivities,
    
    // Filtered views
    eventsByConversation,
    eventsByTask,
    
    // Actions
    connect,
    disconnect,
    clearEvents,
    getConversationEvents,
    getTaskEvents,
    getAgentEvents,
  };
}

