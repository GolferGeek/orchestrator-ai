import { defineStore } from 'pinia';

export interface SessionState {
  currentSessionId: string | null;
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    currentSessionId: null,
  }),
  actions: {
    setCurrentSessionId(sessionId: string | null) {
      this.currentSessionId = sessionId;
      // console.log('Session ID set to:', sessionId);
    },
    clearSession() {
      this.currentSessionId = null;
      // console.log('Session ID cleared.');
    },
  },
  getters: {
    getCurrentSessionId: (state): string | null => state.currentSessionId,
    hasActiveSession: (state): boolean => state.currentSessionId !== null,
  },
}); 