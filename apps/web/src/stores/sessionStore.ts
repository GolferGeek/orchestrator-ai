import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { sessionService, Message } from '@/services/sessionService';
import { useAuthStore } from './authStore';

const CURRENT_SESSION_ID_KEY = 'currentSessionId';

export const useSessionStore = defineStore('session', () => {
  const authStore = useAuthStore();
  const currentSessionId = ref<string | null>(localStorage.getItem(CURRENT_SESSION_ID_KEY));
  const currentSessionMessages = ref<Message[]>([]);
  const isLoadingMessages = ref(false);
  const messagesError = ref<string | null>(null);

  const setCurrentSessionId = (sessionId: string | null) => {
    currentSessionId.value = sessionId;
    if (sessionId) {
      localStorage.setItem(CURRENT_SESSION_ID_KEY, sessionId);
      fetchMessagesForCurrentSession(); // Fetch messages when session changes
    } else {
      localStorage.removeItem(CURRENT_SESSION_ID_KEY);
      currentSessionMessages.value = []; // Clear messages if no session
    }
  };

  const fetchMessagesForCurrentSession = async () => {
    if (!currentSessionId.value || !authStore.isAuthenticated) {
      console.log('[SessionStore] fetchMessagesForCurrentSession: No session ID or not authenticated, clearing messages');
      currentSessionMessages.value = [];
      return;
    }
    console.log('[SessionStore] fetchMessagesForCurrentSession: Starting fetch for session', currentSessionId.value);
    isLoadingMessages.value = true;
    messagesError.value = null;
    try {
      // TODO: Implement pagination for message loading if needed
      const response = await sessionService.getSessionMessages(currentSessionId.value, 0, 200); // Fetching last 200 messages for now
      console.log('[SessionStore] fetchMessagesForCurrentSession: Received', response.messages.length, 'messages from server');
      currentSessionMessages.value = response.messages.sort((a, b) => a.order - b.order);
      console.log('[SessionStore] fetchMessagesForCurrentSession: Set currentSessionMessages to', currentSessionMessages.value.length, 'messages');
    } catch (e: any) {
      // Handle specific error cases
      if (e.message?.includes('Request failed with status code 404') || e.message?.includes('Session not found')) {
        // Session doesn't exist or user doesn't have access - clear the invalid session
        console.warn('[SessionStore] Session not found or access denied. Clearing invalid session ID:', currentSessionId.value);
        setCurrentSessionId(null); // This will clear localStorage and messages
        messagesError.value = 'Session not found. Please select or create a new session.';
      } else {
        console.error('[SessionStore] fetchMessagesForCurrentSession: Error fetching messages:', e.message);
        messagesError.value = e.message || 'Could not load messages for the session.';
        currentSessionMessages.value = []; // Clear on error
      }
    } finally {
      isLoadingMessages.value = false;
      console.log('[SessionStore] fetchMessagesForCurrentSession: Finished, isLoadingMessages set to false');
    }
  };
  
  // When a new message is sent/received by the orchestrator, it should be added here.
  // This is called by the orchestrator interaction logic (e.g., in HomePage.vue)
  const addMessageToCurrentSession = (message: Message) => {
    console.log("[SessionStore] addMessageToCurrentSession called with message:", JSON.parse(JSON.stringify(message)));
    const oldMessagesCount = currentSessionMessages.value.length;
    console.log("[SessionStore] Current messages count BEFORE add:", oldMessagesCount);
    
    const existingMessage = currentSessionMessages.value.find(m => m.id === message.id);
    
    if (existingMessage) {
      console.warn("[SessionStore] Message with ID", message.id, "already exists. Not adding again. Existing:", JSON.parse(JSON.stringify(existingMessage)));
    } else {
      // Create a new array with the new message, then sort
      const updatedMessages = [...currentSessionMessages.value, message];
      updatedMessages.sort((a, b) => a.order - b.order);
      currentSessionMessages.value = updatedMessages; // Assign new array to trigger reactivity more explicitly
      console.log("[SessionStore] Message with ID", message.id, "added. New array assigned.");
    }
    console.log("[SessionStore] Current messages count AFTER add attempt:", currentSessionMessages.value.length);
    if (currentSessionMessages.value.length > oldMessagesCount) {
      console.log("[SessionStore] Message was successfully added and count increased.");
    } else if (!existingMessage && currentSessionMessages.value.length === oldMessagesCount) {
      console.error("[SessionStore] Message was not found (existingMessage was false), but array length did not increase. This indicates an issue!");
    }
  };



  // Watch for auth changes to clear session if user logs out
  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (!isAuth) {
      setCurrentSessionId(null); // Clear session ID and messages on logout
    }
  });

  // Initial fetch if a session ID exists from previous load
  if (currentSessionId.value && authStore.isAuthenticated) {
    fetchMessagesForCurrentSession();
  }

  return {
    currentSessionId,
    currentSessionMessages,
    isLoadingMessages,
    messagesError,
    setCurrentSessionId,
    fetchMessagesForCurrentSession,
    addMessageToCurrentSession
  };
}); 