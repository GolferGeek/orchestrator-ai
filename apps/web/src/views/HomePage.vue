<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar :class="{ 'ios-header-style': isIOS }">
        <ion-title>Orchestrator Chat</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <MessageListComponent />
    </ion-content>

    <ion-footer>
      <ChatInputComponent @send-message="handleSendMessage" />
      <!-- Optional: Display a spinner based on uiStore.isLoading -->
      <div v-if="uiStore.getIsAppLoading" class="loading-indicator ion-padding-start ion-padding-bottom">
        <ion-spinner name="dots" color="primary"></ion-spinner>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTitle, 
  IonToolbar, 
  IonFooter,
  IonSpinner,
  isPlatform
} from '@ionic/vue';
import { onMounted, onUnmounted, computed } from 'vue';
import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useMessagesStore } from '../stores/messagesStore';
// import { useAgentsStore } from '../stores/agentsStore'; // Not directly used here for now
import { useUiStore } from '../stores/uiStore';
// import { postMessageToOrchestrator } from '../services/apiService'; // No longer needed here

import MessageListComponent from '../components/MessageList.vue';
import ChatInputComponent from '../components/ChatInput.vue';

const messagesStore = useMessagesStore();
const uiStore = useUiStore(); // Still needed for v-if on spinner
// const agentsStore = useAgentsStore();

const isIOS = computed(() => isPlatform('ios'));

const handleSendMessage = (text: string) => {
  // All logic is now in the store's action
  messagesStore.submitMessageToOrchestrator(text);
};

// Keyboard event handling
const keyboardWillShowHandler = (info: KeyboardInfo) => {
  console.log('Keyboard will show, height:', info.keyboardHeight);
  // Add any UI adjustments needed, e.g., adjust bottom padding of ion-content
  // const ionContent = document.querySelector('ion-content');
  // if (ionContent) {
  //   ionContent.style.setProperty('--keyboard-offset', `${info.keyboardHeight}px`);
  // }
};

const keyboardWillHideHandler = () => {
  console.log('Keyboard will hide');
  // Remove UI adjustments
  // const ionContent = document.querySelector('ion-content');
  // if (ionContent) {
  //   ionContent.style.removeProperty('--keyboard-offset');
  // }
};

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    Keyboard.addListener('keyboardWillShow', keyboardWillShowHandler);
    Keyboard.addListener('keyboardWillHide', keyboardWillHideHandler);
  }
});

onUnmounted(() => {
  if (Capacitor.isNativePlatform()) {
    Keyboard.removeAllListeners();
  }
});

</script>

<style scoped>
ion-content {
  /* ion-padding is applied via class */
}

.loading-indicator {
  display: flex;
  justify-content: flex-start; /* Align to the start of the footer, near input */
  align-items: center;
  padding-top: 4px; /* Some space above spinner */
}

/* Ensure footer can accommodate spinner if shown */
ion-footer {
  /* padding-bottom to make space if spinner is outside toolbar */
}

/* Potential style for keyboard offset */
/* ion-content {
  --padding-bottom: calc(env(safe-area-inset-bottom) + var(--keyboard-offset, 0px));
  transition: padding-bottom 0.2s ease-in-out;
} */

.ios-header-style {
  --border-width: 0 0 0.55px 0; /* Add a bottom border for iOS header */
  --border-color: var(--ion-color-step-250, #c8c7cc); /* Standard iOS border color */
  --background: var(--ion-toolbar-background-ios, var(--ion-background-color, #fff)); /* Ensure iOS specific background if translucent is tricky */
}

/* Example for MD if needed 
.md-header-style {
  --background: var(--ion-toolbar-background-md, var(--ion-color-primary));
  --color: var(--ion-toolbar-color-md, var(--ion-color-primary-contrast));
}
*/
</style>
