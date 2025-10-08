import { defineStore } from 'pinia';

export interface UiState {
  isAppLoading: boolean;
  isPttRecording: boolean;
  isConversationalMode: boolean;
  // Add other UI related states here, e.g., theme, modal visibility
  // isDarkMode: boolean;
  // activeModal: string | null;
}
export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    isAppLoading: false,
    isPttRecording: false,
    isConversationalMode: false,
    // isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    // activeModal: null,
  }),
  actions: {
    setAppLoading(isLoading: boolean) {
      this.isAppLoading = isLoading;
    },
    setPttRecording(isRecording: boolean) {
      this.isPttRecording = isRecording;
    },
    setConversationalMode(isConversational: boolean) {
      this.isConversationalMode = isConversational;
    },
    // toggleDarkMode() {
    //   this.isDarkMode = !this.isDarkMode;
    //   // Optionally, save preference to localStorage and apply to body class
    //   document.body.classList.toggle('dark', this.isDarkMode);
    //   localStorage.setItem('darkMode', this.isDarkMode.toString());
    // },
    // setActiveModal(modalName: string | null) {
    //   this.activeModal = modalName;
    // }
  },
  getters: {
    getIsAppLoading: (state): boolean => state.isAppLoading,
    getIsPttRecording: (state): boolean => state.isPttRecording,
    getIsConversationalMode: (state): boolean => state.isConversationalMode,
    getShowSpeechDevMode: (state): boolean => state.showSpeechDevMode,
    getSpeechMode: (state): SpeechMode => state.speechMode,
    // getIsDarkMode: (state): boolean => state.isDarkMode,
    // getActiveModal: (state): string | null => state.activeModal,
  },
}); 