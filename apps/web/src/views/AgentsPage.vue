<template>
  <ion-page>
    <ion-split-pane content-id="agents-main-content" when="(min-width: 2000px)">
      <ion-menu content-id="agents-main-content" type="overlay" :disabled="!auth.isAuthenticated">
        <ion-header>
          <ion-toolbar>
            <ion-title 
              class="clickable-title"
              @click="navigateToLanding"
            >
              {{ menuTitle }}
            </ion-title>
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

            <!-- Deliverables, Projects & Evaluations Accordion -->
            <ion-accordion-group>
              <ion-accordion value="main-nav">
                <ion-item slot="header" color="none" class="accordion-header-custom">
                  <ion-icon aria-hidden="true" :icon="documentTextOutline" slot="start"></ion-icon>
                  <ion-label>Deliverables, Projects & Evaluations</ion-label>
                </ion-item>
                <div slot="content" class="main-nav-content">
                  <ion-list>
                    <ion-item
                      :button="true"
                      lines="none"
                      :detail="false"
                      @click="$router.push('/app/deliverables')"
                      :class="{ 'selected': $route.path.startsWith('/app/deliverables') }"
                    >
                      <ion-icon aria-hidden="true" :icon="documentTextOutline" slot="start"></ion-icon>
                      <ion-label>Deliverables</ion-label>
                    </ion-item>
                    <ion-item
                      :button="true"
                      lines="none"
                      :detail="false"
                      @click="$router.push('/app/evaluations')"
                      :class="{ 'selected': $route.path.startsWith('/app/evaluations') }"
                    >
                      <ion-icon aria-hidden="true" :icon="starOutline" slot="start"></ion-icon>
                      <ion-label>Evaluations</ion-label>
                    </ion-item>
                    <ion-item
                      :button="true"
                      lines="none"
                      :detail="false"
                      @click="$router.push('/app/projects')"
                      :class="{ 'selected': $route.path.startsWith('/app/projects') }"
                    >
                      <ion-icon aria-hidden="true" :icon="folderOutline" slot="start"></ion-icon>
                      <ion-label>Projects</ion-label>
                    </ion-item>
                  </ion-list>
                </div>
              </ion-accordion>
            </ion-accordion-group>
              
              <!-- Admin Accordion -->
              <ion-accordion-group v-if="auth.hasAdminAccess || auth.hasEvaluationAccess" :value="adminExpanded ? 'admin' : undefined">
                <ion-accordion value="admin">
                  <ion-item slot="header" color="none" class="accordion-header-custom">
                    <ion-icon aria-hidden="true" :icon="settingsOutline" slot="start"></ion-icon>
                    <ion-label>Admin</ion-label>
                  </ion-item>
                  <div slot="content" class="admin-content">
                    <ion-list>
                      <ion-item 
                        v-if="auth.hasAdminAccess"
                        :button="true"
                        lines="none" 
                        :detail="false"
                        @click="$router.push('/app/admin/settings')"
                        :class="{ 'selected': $route.path === '/app/admin/settings' }"
                      >
                        <ion-icon aria-hidden="true" :icon="settingsOutline" slot="start"></ion-icon>
                        <ion-label>Admin Settings</ion-label>
                      </ion-item>
                      <ion-item 
                        v-if="auth.hasAdminAccess"
                        :button="true"
                        lines="none" 
                        :detail="false"
                        @click="$router.push('/app/admin/audit')"
                        :class="{ 'selected': $route.path === '/app/admin/audit' }"
                      >
                        <ion-icon aria-hidden="true" :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
                        <ion-label>Audit Dashboard</ion-label>
                      </ion-item>
                      
                      <ion-item 
                        v-if="auth.hasAdminAccess"
                        :button="true"
                        lines="none" 
                        :detail="false"
                        @click="$router.push('/app/admin/data-sanitization')"
                        :class="{ 'selected': $route.path.includes('/app/admin/data-sanitization') || $route.path.includes('/app/admin/pii-') || $route.path.includes('/app/admin/pseudonym-') }"
                      >
                        <ion-icon aria-hidden="true" :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
                        <ion-label>Data Sanitization</ion-label>
                      </ion-item>
                      <ion-menu-toggle v-if="auth.hasEvaluationAccess">
                        <ion-item 
                          :button="true"
                          router-direction="root" 
                          router-link="/app/admin/evaluations" 
                          lines="none" 
                          :detail="false"
                          :class="{ 'selected': $route.path === '/app/admin/evaluations' }"
                        >
                          <ion-icon aria-hidden="true" :icon="analyticsOutline" slot="start"></ion-icon>
                          <ion-label>Admin Evaluations</ion-label>
                        </ion-item>
                      </ion-menu-toggle>
                      <ion-menu-toggle v-if="auth.hasAdminAccess">
                        <ion-item 
                          :button="true"
                          router-direction="root" 
                          router-link="/app/admin/llm-usage" 
                          lines="none" 
                          :detail="false"
                          :class="{ 'selected': $route.path === '/app/admin/llm-usage' }"
                        >
                          <ion-icon aria-hidden="true" :icon="barChartOutline" slot="start"></ion-icon>
                          <ion-label>LLM Usage</ion-label>
                        </ion-item>
                      </ion-menu-toggle>
                      <ion-item 
                        v-if="auth.hasAdminAccess"
                        :button="true"
                        router-direction="root" 
                        router-link="/app/admin/observability" 
                        lines="none" 
                        :detail="false"
                        :class="{ 'selected': $route.path === '/app/admin/observability' }"
                      >
                        <ion-icon aria-hidden="true" :icon="pulseOutline" slot="start"></ion-icon>
                        <ion-label>System Observability</ion-label>
                      </ion-item>
                    </ion-list>
                  </div>
                </ion-accordion>
              </ion-accordion-group>
              <!-- Agents & Conversations Accordion - Takes remaining space -->
              <ion-accordion-group :value="agentsExpanded ? 'agents' : undefined">
                <ion-accordion value="agents">
                  <ion-item slot="header" color="none" class="accordion-header-custom">
                    <ion-icon aria-hidden="true" :icon="chatbubblesOutline" slot="start"></ion-icon>
                    <ion-label>Agents & Conversations</ion-label>
                  </ion-item>
                  <div slot="content" class="agents-content">
                    <!-- Agent Tree -->
                    <AgentTreeView 
                      @conversation-selected="handleConversationSelected"
                      @agent-selected="handleAgentSelected"
                      :compact-mode="true"
                    />
                  </div>
                </ion-accordion>
              </ion-accordion-group>
          </div>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="agents-main-content"></ion-router-outlet>
    </ion-split-pane>
  </ion-page>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { 
  IonPage, IonContent, IonIcon, IonItem, IonLabel, IonList, IonMenu, IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle, IonAccordion, IonAccordionGroup
} from '@ionic/vue';
import { logOutOutline, starOutline, folderOutline, chatbubblesOutline, documentTextOutline, shieldCheckmarkOutline, analyticsOutline, barChartOutline, pulseOutline, settingsOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';
import { conversation } from '@/services/conversationHelpers';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useRouter } from 'vue-router';
import AgentTreeView from '@/components/AgentTreeView.vue';
const auth = useAuthStore();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const router = useRouter();
// State for accordion and search
const _mainNavExpanded = ref(true); // Main navigation accordion starts expanded
const agentsExpanded = ref(true);
const adminExpanded = ref(false); // Admin accordion starts collapsed
// Dynamic titles based on current route
const menuTitle = computed(() => {
  return 'Orchestrator AI';
});
const handleLogout = async () => {
  await auth.logout();
  router.push('/login');
};
const navigateToLanding = () => {
  router.push('/');
};
const handleConversationSelected = async (conversation: Record<string, unknown>) => {
  try {
    console.log('Conversation selected:', conversation);

    // Set the active conversation in the store
    chatUiStore.setActiveConversation(conversation.id);

    // Set flag in sessionStorage to indicate active conversation
    sessionStorage.setItem('activeConversation', 'true');

    // Navigate to home page to show the conversation
    await router.push({ path: '/app/home', query: { forceHome: 'true', conversationId: conversation.id } });
  } catch (error) {
    console.error('Error selecting conversation:', error);
  }
};
const handleAgentSelected = async (agent: Record<string, unknown>) => {
  try {
    if (agent.createProject) {
      // Navigate to projects page with agent info for creating new project
      router.push({
        path: '/app/projects',
        query: { 
          action: 'new',
          agentName: agent.name,
          agentType: agent.type
        }
      });
    } else {
      const conversationId = await conversation.createConversation(agent);

      // Refresh conversations list to show the new conversation
      await conversationsStore.fetchConversations(true);

      // Set flag in sessionStorage to indicate active conversation for admin users
      sessionStorage.setItem('activeConversation', 'true');
      router.push({ path: '/app/home', query: { forceHome: 'true', conversationId } });
    }
  } catch (error) {
    console.error('Failed to handle agent selection:', error);
  }
};
</script>
<style scoped>
/* Clickable title styling */
.clickable-title {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.clickable-title:hover {
  opacity: 0.8;
  transform: scale(1.02);
}
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
/* Accordion header styling - burnt orange theme with opacity */
.accordion-header-custom {
  /* Subtle primary-tinted background using theme color */
  background-color: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  background: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  --background: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  --ion-background-color: rgba(var(--ion-color-primary-rgb), var(--app-accent-opacity)) !important;
  border-radius: 6px !important;
  margin: 2px 0 !important;
  font-weight: 500 !important;
  --color: var(--ion-color-dark) !important;
  color: var(--ion-color-dark) !important;
}

/* Try targeting the actual Ionic CSS variables */
ion-accordion {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
}

ion-accordion ion-item {
  --background: var(--ion-color-primary) !important;
  --color: var(--ion-color-primary-contrast) !important;
}

/* Main navigation accordion content */
.main-nav-content {
  padding: 0;
  background: white !important;
  display: block !important;
  visibility: visible !important;
}

.main-nav-content ion-list {
  padding: 0;
  background: white !important;
}

.main-nav-content ion-item {
  --padding-start: 32px;
  --padding-end: 16px;
  font-size: 0.9rem;
  display: block !important;
  --background: white !important;
  background: white !important;
  --color: #333 !important;
  color: #333 !important;
}

/* Navigation item selected state */
ion-item.selected {
  --background: var(--ion-color-primary-tint, #e3f2fd);
  --color: var(--ion-color-primary, #1976d2);
  font-weight: 500;
  border-left: 3px solid var(--ion-color-primary, #1976d2);
}
/* Consistent compact sidebar width for all screen sizes */
ion-menu {
  --width: var(--app-sidebar-width);
}
/* Ensure split-pane (static) sidebar width matches hamburger menu width */
ion-split-pane {
  --side-min-width: var(--app-sidebar-width);
  --side-max-width: var(--app-sidebar-width);
}
/* Admin accordion content */
.admin-content {
  padding: 0;
  background: white !important;
}

.admin-content ion-list {
  padding: 0;
  background: white !important;
}

.admin-content ion-item {
  --padding-start: 32px;
  --padding-end: 16px;
  font-size: 0.9rem;
  --background: white !important;
  background: white !important;
  --color: #333 !important;
  color: #333 !important;
}


/* Agents & Conversations accordion content */
.agents-content {
  padding: 0;
  flex: 1;
  min-height: 0; /* Allow flex child to shrink */
  overflow-y: auto;
}
/* Controls at top of agents accordion */
.agents-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--ion-color-step-50);
  border-bottom: 1px solid var(--ion-color-step-150);
}
.compact-searchbar {
  flex: 1;
  --border-radius: 8px;
  --box-shadow: none;
  --background: var(--ion-color-step-100);
}
.refresh-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  min-width: 40px;
}
/* Compact styles for tree view in menu - Updated selectors */
.agents-content :deep(.agent-tree-view) {
  padding-left: 32px; /* Indent entire agent tree */
}

.agents-content :deep(.organization-header) {
  margin-left: 16px; /* Indent organization headers */
}

.agents-content :deep(.agent-section) {
  margin-left: 32px; /* Indent agent sections */
}

.agents-content :deep(.agent-header-button) {
  margin-left: 16px; /* Indent agent headers */
}

.agents-content :deep(.agent-type-content) {
  padding-left: 24px; /* Indent agent type content */
}

/* Legacy selectors for backward compatibility */
.agents-content :deep(.department-section) {
  margin-left: 48px;
}

.agents-content :deep(.department-header) {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  margin-left: 32px;
}

.agents-content :deep(.agent-item) {
  padding: 0.5rem 1.5rem;
  font-size: 0.85rem;
  margin-left: 64px;
}
/* Dark theme support for navigation */
@media (prefers-color-scheme: dark) {
  ion-item.selected {
    --background: #1e3a8a;
    --color: #3b82f6;
    border-left-color: #3b82f6;
  }

  /* Dark theme accordion headers */
  ion-accordion-group ion-accordion ion-item[slot="header"] {
    --background: var(--ion-color-primary-shade) !important;
    --color: var(--ion-color-primary-contrast) !important;
  }
  
  .accordion-header-custom {
    background-color: rgba(var(--ion-color-primary-rgb), 0.45) !important;
    background: rgba(var(--ion-color-primary-rgb), 0.45) !important;
  }

  .main-nav-content {
    background: var(--ion-color-step-50);
  }
  .agents-content {
    background: var(--ion-color-step-50);
  }
  .agents-controls {
    background: var(--ion-color-step-100);
    border-bottom-color: var(--ion-color-step-200);
  }
}
</style>
