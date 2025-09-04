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
            <!-- Navigation -->
            <ion-list>
              <ion-list-header>Navigation</ion-list-header>
              <!-- Direct Navigation Items - Projects and Evaluations at top -->
              <ion-menu-toggle>
                <ion-item 
                  router-direction="root" 
                  router-link="/app/projects" 
                  lines="none" 
                  :detail="false"
                  :class="{ 'selected': $route.path.startsWith('/app/projects') }"
                >
                  <ion-icon aria-hidden="true" :icon="folderOutline" slot="start"></ion-icon>
                  <ion-label>Projects</ion-label>
                </ion-item>
              </ion-menu-toggle>
              <ion-menu-toggle>
                <ion-item 
                  router-direction="root" 
                  router-link="/app/deliverables" 
                  lines="none" 
                  :detail="false"
                  :class="{ 'selected': $route.path.startsWith('/app/deliverables') }"
                >
                  <ion-icon aria-hidden="true" :icon="documentTextOutline" slot="start"></ion-icon>
                  <ion-label>Deliverables</ion-label>
                </ion-item>
              </ion-menu-toggle>
              <ion-menu-toggle>
                <ion-item router-direction="root" router-link="/app/evaluations" lines="none" :detail="false">
                  <ion-icon aria-hidden="true" :icon="starOutline" slot="start"></ion-icon>
                  <ion-label>Evaluations</ion-label>
                </ion-item>
              </ion-menu-toggle>
              
              <!-- Admin Section -->
              <div v-if="auth.hasAdminAccess || auth.hasEvaluationAccess">
                <ion-list-header>Admin</ion-list-header>
                          <ion-menu-toggle v-if="auth.hasAdminAccess">
            <ion-item 
              router-direction="root" 
              router-link="/app/admin/settings" 
              lines="none" 
              :detail="false"
              :class="{ 'selected': $route.path === '/app/admin/settings' }"
            >
              <ion-icon aria-hidden="true" :icon="settingsOutline" slot="start"></ion-icon>
              <ion-label>Admin Settings</ion-label>
            </ion-item>
          </ion-menu-toggle>
          <ion-menu-toggle v-if="auth.hasAdminAccess">
            <ion-item 
              router-direction="root" 
              router-link="/app/admin/audit" 
              lines="none" 
              :detail="false"
              :class="{ 'selected': $route.path === '/app/admin/audit' }"
            >
              <ion-icon aria-hidden="true" :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
              <ion-label>Audit Dashboard</ion-label>
            </ion-item>
          </ion-menu-toggle>
                <ion-menu-toggle v-if="auth.hasAdminAccess">
                  <ion-item 
                    router-direction="root" 
                    router-link="/app/admin/pii-patterns" 
                    lines="none" 
                    :detail="false"
                    :class="{ 'selected': $route.path === '/app/admin/pii-patterns' }"
                  >
                    <ion-icon aria-hidden="true" :icon="shieldCheckmarkOutline" slot="start"></ion-icon>
                    <ion-label>PII Patterns</ion-label>
                  </ion-item>
                </ion-menu-toggle>
                <ion-menu-toggle v-if="auth.hasAdminAccess">
                  <ion-item 
                    router-direction="root" 
                    router-link="/app/admin/pii-testing" 
                    lines="none" 
                    :detail="false"
                    :class="{ 'selected': $route.path === '/app/admin/pii-testing' }"
                  >
                    <ion-icon aria-hidden="true" :icon="flaskOutline" slot="start"></ion-icon>
                    <ion-label>PII Testing</ion-label>
                  </ion-item>
                </ion-menu-toggle>
                <ion-menu-toggle v-if="auth.hasAdminAccess">
                  <ion-item 
                    router-direction="root" 
                    router-link="/app/admin/pseudonym-dictionary" 
                    lines="none" 
                    :detail="false"
                    :class="{ 'selected': $route.path === '/app/admin/pseudonym-dictionary' }"
                  >
                    <ion-icon aria-hidden="true" :icon="libraryOutline" slot="start"></ion-icon>
                    <ion-label>Pseudonym Dictionary</ion-label>
                  </ion-item>
                </ion-menu-toggle>
                <ion-menu-toggle v-if="auth.hasAdminAccess">
                  <ion-item 
                    router-direction="root" 
                    router-link="/app/admin/pseudonym-mappings" 
                    lines="none" 
                    :detail="false"
                    :class="{ 'selected': $route.path === '/app/admin/pseudonym-mappings' }"
                  >
                    <ion-icon aria-hidden="true" :icon="swapHorizontalOutline" slot="start"></ion-icon>
                    <ion-label>Pseudonym Mappings</ion-label>
                  </ion-item>
                </ion-menu-toggle>
                <ion-menu-toggle v-if="auth.hasEvaluationAccess">
                  <ion-item 
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
              </div>
              <!-- Agents & Conversations Accordion - Takes remaining space -->
              <ion-accordion-group :value="agentsExpanded ? 'agents' : undefined">
                <ion-accordion value="agents">
                  <ion-item slot="header" color="none">
                    <ion-icon aria-hidden="true" :icon="chatbubblesOutline" slot="start"></ion-icon>
                    <ion-label>Agents & Conversations</ion-label>
                  </ion-item>
                  <div slot="content" class="agents-content">
                    <!-- Search and Refresh Controls -->
                    <div class="agents-controls">
                      <ion-searchbar
                        v-model="searchQuery"
                        placeholder="Search agents..."
                        :debounce="300"
                        @input="handleSearch"
                        class="compact-searchbar"
                      />
                      <ion-button
                        fill="clear"
                        size="small"
                        @click="handleRefresh"
                        :disabled="isRefreshing"
                        class="refresh-btn"
                      >
                        <ion-icon :icon="refreshOutline" />
                      </ion-button>
                    </div>
                    <!-- Agent Tree -->
                    <AgentTreeView 
                      @conversation-selected="handleConversationSelected"
                      @agent-selected="handleAgentSelected"
                      :compact-mode="true"
                      :search-query="searchQuery"
                    />
                  </div>
                </ion-accordion>
              </ion-accordion-group>
            </ion-list>
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
  IonPage, IonContent, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonMenu, IonMenuToggle, IonNote, IonRouterOutlet, IonSplitPane, IonHeader, IonToolbar, IonTitle, IonAccordion, IonAccordionGroup, IonSearchbar, IonButton
} from '@ionic/vue';
import { logOutOutline, starOutline, folderOutline, chatbubblesOutline, refreshOutline, documentTextOutline, shieldCheckmarkOutline, analyticsOutline, barChartOutline, flaskOutline, libraryOutline, settingsOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useAuthStore } from '@/stores/authStore';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useRouter } from 'vue-router';
import AgentTreeView from '@/components/AgentTreeView.vue';
const auth = useAuthStore();
const agentChatStore = useAgentChatStore();
const router = useRouter();
// State for accordion and search
const agentsExpanded = ref(true);
const searchQuery = ref('');
const isRefreshing = ref(false);
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
const handleConversationSelected = async (conversation: any) => {
  try {
    await agentChatStore.openExistingConversation(conversation.id);
    router.push('/app/home');
  } catch (error) {

  }
};
const handleAgentSelected = async (agent: any) => {
  try {
    await agentChatStore.startNewConversation(agent);
    router.push('/app/home');
  } catch (error) {

  }
};
const handleSearch = () => {
  // The search query is passed as a prop to AgentTreeView
  // The component will handle the actual filtering
};
const handleRefresh = async () => {
  try {
    isRefreshing.value = true;
    // You can add refresh logic here if needed
    // For now, we'll let the AgentTreeView handle its own refresh
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
  } catch (error) {

  } finally {
    isRefreshing.value = false;
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
  .agents-controls {
    background: var(--ion-color-step-100);
    border-bottom-color: var(--ion-color-step-200);
  }
}
</style>
