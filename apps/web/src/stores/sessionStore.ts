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
      currentSessionMessages.value = [];
      return;
    }
    isLoadingMessages.value = true;
    messagesError.value = null;
    try {
      // TODO: Implement pagination for message loading if needed
      const response = await sessionService.getSessionMessages(currentSessionId.value, 0, 200); // Fetching last 200 messages for now
      currentSessionMessages.value = response.messages.sort((a, b) => a.order - b.order);
    } catch (e: any) {
      messagesError.value = e.message || 'Could not load messages for the session.';
      currentSessionMessages.value = []; // Clear on error
    } finally {
      isLoadingMessages.value = false;
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