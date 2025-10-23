<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            fill="clear" 
            @click="toggleDarkMode"
            :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <ion-icon 
              :icon="isDarkMode ? sunnyOutline : moonOutline" 
              slot="icon-only"
            />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ pageTitle }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <!-- Authentication Check -->
      <div v-if="!auth.isAuthenticated" class="auth-required">
        <ion-icon :icon="lockClosedOutline" class="auth-icon"></ion-icon>
        <h2>Authentication Required</h2>
        <p>Please <router-link to="/login">log in</router-link> to access your conversations and projects.</p>
      </div>
      <!-- Agent Conversation View or Deliverable View -->
      <div v-else-if="chatUiStore.hasActiveConversation || route.query.deliverableId" class="conversation-container">
        <ConversationTabs />
      </div>
      <!-- Welcome/Empty State -->
      <div v-else class="welcome-container">
        <div class="welcome-content">
          <ion-icon :icon="chatbubblesOutline" class="welcome-icon"></ion-icon>
          <h2>Welcome to Orchestrator AI</h2>
          <p>Start a conversation with any agent from the sidebar, or create a new project to begin orchestrated workflows.</p>
          <div class="quick-nav">
            <ion-button 
              @click="navigateToProjects"
              fill="solid"
              size="large"
            >
              <ion-icon :icon="folderOutline" slot="start"></ion-icon>
              View Projects
            </ion-button>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonButton,
  IonIcon,
} from '@ionic/vue';
import {
  lockClosedOutline,
  chatbubblesOutline,
  folderOutline,
  moonOutline,
  sunnyOutline,
} from 'ionicons/icons';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { conversation } from '@/services/conversationHelpers';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import ConversationTabs from '@/components/ConversationTabs.vue';
const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const userPreferencesStore = useUserPreferencesStore();
// Computed properties
const pageTitle = computed(() => {
  const activeConvId = chatUiStore.activeConversationId;
  if (activeConvId) {
    const activeConversation = conversationsStore.conversationById(activeConvId);
    if (activeConversation) {
      return activeConversation.title || `Chat with ${activeConversation.agentName}`;
    }
  }
  return 'Orchestrator AI';
});
// Dark mode state and functionality
// Handle conversation opening from query parameters
const handleConversationFromQuery = async () => {
  const conversationId = route.query.conversationId as string;
  if (conversationId && auth.isAuthenticated) {
    try {
      // Check if conversation is already loaded with messages
      const existingConversation = conversationsStore.conversationById(conversationId);
      const existingMessages = conversationsStore.messagesByConversation(conversationId);

      if (existingConversation && existingMessages && existingMessages.length > 0) {
        // Just switch to it
        chatUiStore.setActiveConversation(conversationId);
      } else {
        // Load conversation metadata and messages from backend
        const backendConversation = await conversation.getBackendConversation(conversationId);
        const messages = await conversation.loadConversationMessages(conversationId);

        // Get agent details from the agents store
        const { useAgentsStore } = await import('@/stores/agentsStore');
        const agentsStore = useAgentsStore();

        // Ensure agents are loaded
        if (!agentsStore.availableAgents || agentsStore.availableAgents.length === 0) {
          await agentsStore.ensureAgentsLoaded();
        }

        const agent = agentsStore.availableAgents?.find(a => a.name === backendConversation.agentName);

        if (!agent) {
          console.error('Agent not found for conversation:', backendConversation.agentName);
          return;
        }

        // Create the conversation object with proper date
        const createdAt = backendConversation.createdAt ? new Date(backendConversation.createdAt) : new Date();
        const loadedConversation = conversation.createConversationObject(agent, createdAt);
        loadedConversation.id = conversationId; // Override the generated ID with the actual backend ID
        loadedConversation.title = backendConversation.title || loadedConversation.title;

        // Add conversation to the store
        if (existingConversation) {
          conversationsStore.updateConversation(conversationId, loadedConversation);
        } else {
          conversationsStore.setConversation(loadedConversation);
        }

        // Set messages separately (the store manages messages in a separate Map)
        console.log('💾 [HomePage] Setting messages in store for conversation', conversationId, ':', messages.length);
        conversationsStore.setMessages(conversationId, messages);

        // Verify messages were set
        const verifyMessages = conversationsStore.messagesByConversation(conversationId);
        console.log('✅ [HomePage] Messages set in store, verified count:', verifyMessages.length);

        chatUiStore.setActiveConversation(conversationId);
      }
      // Clear the query parameter to avoid re-opening on refresh
      router.replace({
        name: route.name as string,
        params: route.params,
        query: { ...route.query, conversationId: undefined }
      });
    } catch (error) {
      console.error('Failed to load conversation from query:', error);
    }
  }
};
// Watch for query parameter changes
watch(() => route.query.conversationId, handleConversationFromQuery, { immediate: true });

// Initialize user preferences store
onMounted(async () => {
  await userPreferencesStore.initializePreferences();
});

// Cleanup function to clear conversation flag when leaving the page
onUnmounted(() => {
  // Clear the active conversation flag when leaving the home page
  // This allows admin users to be redirected back to admin settings when appropriate
  sessionStorage.removeItem('activeConversation');
});

// Reactive theme functionality
const isDarkMode = computed(() => userPreferencesStore.effectiveTheme === 'dark');

const toggleDarkMode = () => {
  const currentTheme = userPreferencesStore.preferences.theme;
  let newTheme: 'light' | 'dark' | 'auto';
  
  if (currentTheme === 'auto') {
    // If auto, switch to the opposite of current effective theme
    newTheme = isDarkMode.value ? 'light' : 'dark';
  } else {
    // If manual, toggle between light and dark
    newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  }
  
  // Just update the preference - let the store's reactivity handle theme application
  userPreferencesStore.setTheme(newTheme);
};

// Methods
const navigateToProjects = () => {
  router.push('/app/projects');
};
</script>
<style scoped>
.auth-required,
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
}
.welcome-content {
  max-width: 500px;
}
.auth-icon,
.welcome-icon {
  font-size: 4rem;
  color: var(--ion-color-primary);
  margin-bottom: 1.5rem;
}
.auth-required h2,
.welcome-content h2 {
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
  font-size: 2rem;
  font-weight: 600;
}
.auth-required p,
.welcome-content p {
  color: var(--ion-color-medium);
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
}
.quick-nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}
.quick-nav ion-button {
  width: 100%;
  max-width: 300px;
  --border-radius: 12px;
  --padding-top: 1rem;
  --padding-bottom: 1rem;
}
.conversation-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* Responsive design */
@media (max-width: 768px) {
  .auth-required,
  .welcome-container {
    padding: 1rem;
  }
  .auth-required h2,
  .welcome-content h2 {
    font-size: 1.5rem;
  }
  .auth-required p,
  .welcome-content p {
    font-size: 1rem;
  }
  .quick-nav {
    gap: 0.75rem;
  }
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .auth-icon,
  .welcome-icon {
    color: var(--ion-color-primary-tint);
  }
}
</style> 