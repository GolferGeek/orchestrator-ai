<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button color="primary"></ion-menu-button>
        </ion-buttons>
        <ion-title>Organization</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Organization</ion-title>
        </ion-toolbar>
      </ion-header>
      <div class="organization-container">
        <!-- Left Sidebar: Agent Tree -->
        <div class="agent-sidebar">
          <AgentTreeView 
            @conversation-selected="handleConversationSelected"
            @agent-selected="handleAgentSelected"
          />
        </div>
        <!-- Main Content: Agent Chat or Welcome -->
        <div class="main-content">
          <div v-if="!chatUiStore.hasActiveConversation" class="welcome-screen">
            <div class="welcome-content">
              <ion-icon :icon="businessOutline" class="welcome-icon"></ion-icon>
              <h2>Welcome to Your Organization</h2>
              <p>Select an agent from the left panel to start a conversation, or choose an existing conversation to continue.</p>
              <div class="quick-actions">
                <h3>Quick Actions</h3>
                <ion-button 
                  fill="outline" 
                  @click="handleQuickAction('marketing')"
                  class="quick-action-btn"
                >
                  <ion-icon :icon="megaphoneOutline" slot="start"></ion-icon>
                  Marketing Strategy
                </ion-button>
                <ion-button 
                  fill="outline" 
                  @click="handleQuickAction('operations')"
                  class="quick-action-btn"
                >
                  <ion-icon :icon="settingsOutline" slot="start"></ion-icon>
                  Operations Planning
                </ion-button>
                <ion-button 
                  fill="outline" 
                  @click="handleQuickAction('finance')"
                  class="quick-action-btn"
                >
                  <ion-icon :icon="cardOutline" slot="start"></ion-icon>
                  Financial Analysis
                </ion-button>
              </div>
            </div>
          </div>
          <!-- Agent Chat Interface -->
          <div v-else class="chat-container">
            <AgentChatView />
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>
<script setup lang="ts">
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonButtons, 
  IonMenuButton,
  IonButton,
  IonIcon
} from '@ionic/vue';
import { 
  businessOutline,
  megaphoneOutline,
  settingsOutline,
  cardOutline
} from 'ionicons/icons';
import AgentTreeView from '@/components/AgentTreeView.vue';
import AgentChatView from '@/components/AgentChatView.vue';
import { conversation } from '@/services/conversationHelpers';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useAgentsStore } from '@/stores/agentsStore';
const _conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const agentsStore = useAgentsStore();
const handleConversationSelected = async (conv: { id: string }) => {
  try {
    // TODO: Load conversation messages if not already loaded
    // await conversation.loadConversationMessages(conv.id);
    chatUiStore.setActiveConversation(conv.id);
  } catch {

  }
};
const handleAgentSelected = async (agent: { type: string }) => {
  try {
    await conversation.createConversation(agent);
  } catch {

  }
};
const handleQuickAction = async (agentType: string) => {
  try {
    // Find the first agent of the requested type
    const availableAgents = agentsStore.getAvailableAgents;
    const targetAgent = availableAgents.find((agent: { type: string }) => agent.type === agentType);
    if (targetAgent && targetAgent.type) {
      // Ensure the agent has the required type field
      const agentData = {
        name: targetAgent.name,
        type: targetAgent.type,
        description: targetAgent.description,
        execution_modes: targetAgent.execution_modes,
      };
      await conversation.createConversation(agentData);
    } else {

    }
  } catch {

  }
};
</script>
<style scoped>
.organization-container {
  display: flex;
  height: 100%;
  width: 100%;
}
.agent-sidebar {
  width: var(--app-sidebar-width);
  min-width: calc(var(--app-sidebar-width));
  max-width: calc(var(--app-sidebar-width));
  border-right: 1px solid var(--ion-color-step-150);
  background: var(--ion-color-step-25);
  overflow-y: auto;
  resize: horizontal;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.welcome-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
}
.welcome-content {
  text-align: center;
  max-width: 600px;
}
.welcome-icon {
  font-size: 4rem;
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
}
.welcome-content h2 {
  color: var(--ion-color-primary);
  margin-bottom: 1rem;
  font-size: 2rem;
  font-weight: 600;
}
.welcome-content p {
  color: var(--ion-color-medium);
  margin-bottom: 2rem;
  font-size: 1.1rem;
  line-height: 1.6;
}
.quick-actions {
  margin-top: 2rem;
}
.quick-actions h3 {
  color: var(--ion-color-dark);
  margin-bottom: 1rem;
  font-size: 1.3rem;
  font-weight: 500;
}
.quick-action-btn {
  margin: 0.5rem;
  --border-radius: 12px;
  --padding-start: 1rem;
  --padding-end: 1rem;
  --padding-top: 0.75rem;
  --padding-bottom: 0.75rem;
}
.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}
/* Responsive design */
@media (max-width: 768px) {
  .organization-container {
    flex-direction: column;
  }
  .agent-sidebar {
    width: 100%;
    max-height: 300px;
    min-width: auto;
    resize: none;
  }
  .welcome-content {
    padding: 1rem;
  }
  .welcome-content h2 {
    font-size: 1.5rem;
  }
  .welcome-content p {
    font-size: 1rem;
  }
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .agent-sidebar {
    background: var(--ion-color-step-50);
    border-right-color: var(--ion-color-step-200);
  }
}
</style>
