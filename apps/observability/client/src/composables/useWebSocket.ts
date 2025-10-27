import { ref, onMounted, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { HookEvent, WebSocketMessage } from '../types';

export function useWebSocket(url: string) {
  const events = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);

  let socket: Socket | null = null;
  let reconnectTimeout: number | null = null;

  // Get max events from environment variable or use default
  const maxEvents = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '300');

  const connect = () => {
    try {
      // Extract base URL (remove /stream path)
      const baseUrl = url.replace('/stream', '').replace('ws://', 'http://').replace('wss://', 'https://');

      socket = io(baseUrl, {
        path: '/stream',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 3000,
      });

      socket.on('connect', () => {
        console.log('Socket.IO connected');
        isConnected.value = true;
        error.value = null;
      });

      socket.on('message', (data: string) => {
        try {
          const message: WebSocketMessage = JSON.parse(data);

          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            // Only keep the most recent events up to maxEvents
            events.value = initialEvents.slice(-maxEvents);
          } else if (message.type === 'event') {
            const newEvent = message.data as HookEvent;
            events.value.push(newEvent);

            // Limit events array to maxEvents, removing the oldest when exceeded
            if (events.value.length > maxEvents) {
              // Remove the oldest events (first 10) when limit is exceeded
              events.value = events.value.slice(events.value.length - maxEvents + 10);
            }
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
        error.value = 'Connection error';
      });

      socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
        isConnected.value = false;
      });
    } catch (err) {
      console.error('Failed to connect:', err);
      error.value = 'Failed to connect to server';
    }
  };

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (socket) {
      socket.close();
      socket = null;
    }
  };
  
  onMounted(() => {
    connect();
  });
  
  onUnmounted(() => {
    disconnect();
  });

  const clearEvents = () => {
    events.value = [];
  };

  return {
    events,
    isConnected,
    error,
    clearEvents
  };
}