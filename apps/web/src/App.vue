<template>
  <ion-app>
    <ion-split-pane content-id="main-content">
      <ion-menu content-id="main-content" type="overlay" :disabled="!auth.isAuthenticated">
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ menuTitle }}</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <div v-if="auth.isAuthenticated">
            <ion-note v-if="auth.user && auth.user.email" class="ion-padding-top">{{ auth.user.email }}</ion-note>
            <ion-item lines="none" :detail="false" :button="true" @click="handleLogout">
              <ion-icon aria-hidden="true" :icon="logOutOutline" slot="start"></ion-icon>
              <ion-label>Logout</ion-label>
            </ion-item>
            
            <hr/>
            
            <!-- Session sidebar -->
            <SessionSidebar 
              @agent-chat-started="handleAgentChatStarted" 
              @agent-conversation-selected="handleAgentConversationSelected"
            />
          </div>
          <div v-else>
            <ion-list>
              <ion-list-header>Menu</ion-list-header>
              <ion-menu-toggle :auto-hide="false">
                <ion-item router-direction="root" router-link="/login" lines="none" :detail="false" class="hydrated">
                  <ion-icon aria-hidden="true" :icon="logInOutline"></ion-icon>
                  <ion-label>Login</ion-label>
                </ion-item>
              </ion-menu-toggle>
            </ion-list>
          </div>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="main-content"></ion-router-outlet>
    </ion-split-pane>
  </ion-app>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { 
  IonApp, IonContent, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle 
} from '@ionic/vue';
import { logInOutline, logOutOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import SessionSidebar from '@/components/SessionSidebar.vue';
import { useAgentChatStore } from '@/stores/agentChatStore';

const auth = useAuthStore();
const router = useRouter();
const agentChatStore = useAgentChatStore();

// Dynamic titles based on current route
const menuTitle = computed(() => {
      return 'Orchestrator AI';
});

const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};

const handleAgentChatStarted = (_agent: any) => {
  // Navigate to homepage where we'll show the agent chat
  router.push('/');
};

const handleAgentConversationSelected = (_conversation: any) => {
  // Navigate to homepage where we'll show the agent conversation
  router.push('/');
  // The agentChatStore.loadConversation is already called in SessionSidebar
};
</script>

<style scoped>
/* Basic styling for user info in menu */
ion-note {
  display: block;
  padding-left: 16px;
  padding-bottom: 8px;
  font-size: 0.9em;
  color: var(--ion-color-medium-shade);
}
hr {
  border: none;
  border-top: 1px solid var(--ion-color-step-150, #e0e0e0);
  margin: 8px 0;
}

/* Increase sidebar width for better space utilization */
ion-menu {
  --width: 320px;
}

@media (max-width: 768px) {
  ion-menu {
    --width: 280px;
  }
}
</style>
