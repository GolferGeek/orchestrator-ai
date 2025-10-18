<template>
  <div class="conversation-tabs-container">
    <!-- Tab Bar -->
    <div class="conversation-tab-bar" v-if="conversationsStore.allConversations.length > 0">
      <div class="tab-scroll-wrapper">
        <div
          v-for="conversation in conversationsStore.allConversations"
          :key="conversation.id"
          class="conversation-tab"
          :class="{ 'active': conversation.id === chatUiStore.activeConversationId }"
          @click="switchToConversation(conversation.id)"
        >
          <span class="tab-title">{{ conversation.title }}</span>
          <ion-button
            fill="clear"
            size="small"
            class="tab-close-button"
            @click.stop="closeConversation(conversation.id)"
          >
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </div>
      </div>
    </div>
    <!-- Tab Content -->
    <div class="conversation-tab-content">
      <div v-if="activeConversation" class="active-conversation">
        <!-- Two-Pane Conversation View (shows deliverables/projects alongside chat) -->
        <TwoPaneConversationView 
          v-if="shouldUseTwoPaneView"
          :conversation="activeConversation"
        />
        <!-- Traditional Single-Pane Chat View -->
        <AgentChatView 
          v-else
          :conversation="activeConversation"
          @send-message="handleSendMessage"
        />
      </div>
      <div v-else class="no-active-conversation">
        <div class="empty-state">
          <ion-icon :icon="chatbubblesOutline" size="large" color="medium" />
          <h3>No conversations open</h3>
          <p>Start a new conversation with an agent from the sidebar.</p>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { closeOutline, chatbubblesOutline } from 'ionicons/icons';
import { useRoute } from 'vue-router';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { sendMessage, createPlan, createDeliverable } from '@/services/agent2agent/actions';
import AgentChatView from './AgentChatView.vue';
import TwoPaneConversationView from './TwoPaneConversationView.vue';
// const route = useRoute();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
// Computed
const activeConversation = computed(() => chatUiStore.activeConversation);

// const isOrchestratorConversation = computed(() => {
//   const agentName = activeConversation.value?.agent?.name;
//   // Ensure agentName is a string before calling toLowerCase
//   if (typeof agentName === 'string') {
//     return agentName.toLowerCase().includes('orchestrator');
//   }
//   return false;
// });

const shouldUseTwoPaneView = computed(() => {
  // Enable two-pane view for all conversations
  // Regular agents: show deliverables in right pane
  // Orchestrator agents: show deliverables AND projects in right pane
  return true;
});

// Methods
const switchToConversation = (conversationId: string) => {
  chatUiStore.setActiveConversation(conversationId);
};

const closeConversation = (conversationId: string) => {
  // Close conversation without confirmation dialog
  conversationsStore.removeConversation(conversationId);
};

const handleSendMessage = async (content: string) => {
  const conversation = chatUiStore.activeConversation;
  if (!conversation || !conversation.agent) {
    console.error('Cannot send message: no active conversation');
    return;
  }

  try {
    const mode = conversation.chatMode || 'converse';
    const agentName = conversation.agent.name;

    // Route to appropriate action based on mode
    if (mode === 'plan') {
      await createPlan(agentName, conversation.id, content);
    } else if (mode === 'build') {
      await createDeliverable(agentName, conversation.id, content);
    } else {
      // converse mode (default)
      await sendMessage(agentName, conversation.id, content);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};
</script>
<style scoped>
.conversation-tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.conversation-tab-bar {
  border-bottom: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-50);
  padding: 0;
}
.tab-scroll-wrapper {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}
.tab-scroll-wrapper::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
.conversation-tab {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-right: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-100);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 0;
  max-width: 250px;
  position: relative;
}
.conversation-tab:hover {
  background: var(--ion-color-step-150);
}
.conversation-tab.active {
  background: #e3f2fd;
  color: #1565c0;
  border-bottom: 2px solid #1976d2;
}
.tab-title {
  flex: 1;
  font-size: 0.9em;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}
.tab-close-button {
  --padding-start: 4px;
  --padding-end: 4px;
  --color: currentColor;
  opacity: 0.7;
  flex-shrink: 0;
}
.conversation-tab:hover .tab-close-button {
  opacity: 1;
}
.conversation-tab.active .tab-close-button {
  --color: #1565c0;
  opacity: 0.8;
}
.conversation-tab-content {
  flex: 1;
  overflow: hidden;
}
.active-conversation {
  height: 100%;
}
.no-active-conversation {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-state {
  text-align: center;
  color: var(--ion-color-medium);
  max-width: 300px;
  padding: 40px 20px;
}
.empty-state ion-icon {
  margin-bottom: 16px;
}
.empty-state h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}
.empty-state p {
  margin: 0;
  line-height: 1.5;
}
/* Dark theme support */
@media (prefers-color-scheme: dark), 
html[data-theme="dark"] {
  .conversation-tab-bar {
    background: #2d3748;
    border-color: #4a5568;
  }
  .conversation-tab {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }
  .conversation-tab:hover {
    background: #4b5563;
    color: #f3f4f6;
  }
  .conversation-tab.active {
    background: #1e40af;
    color: #dbeafe;
    border-bottom-color: #3b82f6;
  }
  .conversation-tab.active .tab-close-button {
    --color: #dbeafe;
  }
  .empty-state {
    color: #9ca3af;
  }
  .empty-state h3 {
    color: #f3f4f6;
  }
}
</style>