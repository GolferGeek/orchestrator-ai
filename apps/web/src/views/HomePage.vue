<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button :auto-hide="false" v-if="auth.isAuthenticated"></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
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

      <!-- Agent Conversation View -->
      <div v-else-if="agentChatStore.hasActiveConversation" class="conversation-container">
        <ConversationTabs @close="handleCloseAgentChat" />
      </div>

      <!-- Welcome/Empty State -->
      <div v-else class="welcome-container">
        <div class="welcome-content">
          <ion-icon :icon="chatbubblesOutline" class="welcome-icon"></ion-icon>
          <h2>Welcome to Orchestrator AI</h2>
          <p>Start a conversation with any agent from the Organization tab, or create a new project to begin orchestrated workflows.</p>
          
          <div class="quick-nav">
            <ion-button 
              @click="navigateToOrganization"
              fill="solid"
              size="large"
            >
              <ion-icon :icon="businessOutline" slot="start"></ion-icon>
              View Organization
            </ion-button>
            <ion-button 
              @click="navigateToProjects"
              fill="outline"
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
import { computed } from 'vue';
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
  businessOutline,
  folderOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useAgentChatStore } from '@/stores/agentChatStore';
import ConversationTabs from '@/components/ConversationTabs.vue';

const router = useRouter();
const auth = useAuthStore();
const agentChatStore = useAgentChatStore();

// Computed properties
const pageTitle = computed(() => {
  const activeConversation = agentChatStore.getActiveConversation();
  if (activeConversation) {
    return activeConversation.title || `Chat with ${activeConversation.agent?.name}`;
  }
  return 'Orchestrator AI';
});

// Methods
const navigateToOrganization = () => {
  router.push('/organization');
};

const navigateToProjects = () => {
  router.push('/projects');
};

const handleCloseAgentChat = () => {
  const activeConversation = agentChatStore.getActiveConversation();
  if (activeConversation) {
    agentChatStore.closeConversation(activeConversation.id);
  }
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