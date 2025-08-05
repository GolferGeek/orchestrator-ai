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
            
            <!-- Navigation -->
            <ion-list>
              <ion-list-header>Navigation</ion-list-header>
              
              <!-- Direct Navigation Items - Projects and Evaluations at top -->
              <ion-menu-toggle :auto-hide="false">
                <ion-item 
                  router-direction="root" 
                  router-link="/projects" 
                  lines="none" 
                  :detail="false"
                  :class="{ 'selected': $route.path.startsWith('/projects') }"
                >
                  <ion-icon aria-hidden="true" :icon="folderOutline" slot="start"></ion-icon>
                  <ion-label>Projects</ion-label>
                </ion-item>
              </ion-menu-toggle>
              <ion-menu-toggle :auto-hide="false">
                <ion-item router-direction="root" router-link="/evaluations" lines="none" :detail="false">
                  <ion-icon aria-hidden="true" :icon="starOutline" slot="start"></ion-icon>
                  <ion-label>Evaluations</ion-label>
                </ion-item>
              </ion-menu-toggle>
              
              <!-- Agents & Conversations Accordion - Takes remaining space -->
              <ion-accordion-group :value="agentsExpanded ? 'agents' : undefined">
                <ion-accordion value="agents">
                  <ion-item slot="header" color="none">
                    <ion-icon aria-hidden="true" :icon="chatbubblesOutline" slot="start"></ion-icon>
                    <ion-label>Agents & Conversations</ion-label>
                  </ion-item>
                  <div slot="content" class="agents-content">
                    <AgentTreeView 
                      @conversation-selected="handleConversationSelected"
                      @agent-selected="handleAgentSelected"
                      :compact-mode="true"
                    />
                  </div>
                </ion-accordion>
              </ion-accordion-group>
            </ion-list>
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
import { computed, ref } from 'vue';
import { 
  IonApp, IonContent, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle, IonAccordion, IonAccordionGroup
} from '@ionic/vue';
import { logInOutline, logOutOutline, starOutline, businessOutline, folderOutline, chatbubblesOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useRouter, useRoute } from 'vue-router';
import AgentTreeView from '@/components/AgentTreeView.vue';

const auth = useAuthStore();
const agentChatStore = useAgentChatStore();
const router = useRouter();
const route = useRoute();

// State for accordion
const agentsExpanded = ref(true);

// Dynamic titles based on current route
const menuTitle = computed(() => {
  return 'Orchestrator AI';
});

const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};

const handleConversationSelected = async (conversation: any) => {
  try {
    await agentChatStore.openExistingConversation(conversation.id);
    router.push('/');
  } catch (error) {
    console.error('Failed to open conversation:', error);
  }
};

const handleAgentSelected = async (agent: any) => {
  try {
    await agentChatStore.startNewConversation(agent);
    router.push('/');
  } catch (error) {
    console.error('Failed to start conversation:', error);
  }
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

/* Navigation item selected state */
ion-item.selected {
  --background: var(--ion-color-primary-tint, #e3f2fd);
  --color: var(--ion-color-primary, #1976d2);
  font-weight: 500;
  border-left: 3px solid var(--ion-color-primary, #1976d2);
}

/* Increase sidebar width for better space utilization */
ion-menu {
  --width: 356px; /* Increased by ~36px (half inch) */
}

@media (max-width: 768px) {
  ion-menu {
    --width: 300px; /* Also increased mobile width proportionally */
  }
}

/* Agents & Conversations accordion content */
.agents-content {
  padding: 0;
  max-height: 50vh; /* Use viewport height to take remaining space */
  overflow-y: auto;
}

/* Compact styles for tree view in menu */
.agents-content :deep(.agent-tree-container) {
  padding: 0;
  background: transparent;
}

.agents-content :deep(.department-section) {
  margin-bottom: 0.5rem;
}

.agents-content :deep(.department-header) {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.agents-content :deep(.agent-item) {
  padding: 0.5rem 1.5rem;
  font-size: 0.85rem;
}

/* Dark theme support for navigation */
@media (prefers-color-scheme: dark) {
  ion-item.selected {
    --background: #1e3a8a;
    --color: #3b82f6;
    border-left-color: #3b82f6;
  }
  
  .agents-content {
    background: var(--ion-color-step-50);
  }
}
</style>
