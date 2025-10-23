<template>
  <div class="conversation-tabs-container">
    <!-- Tab Bar -->
    <div class="conversation-tab-bar" v-if="openTabs.length > 0">
      <div class="tab-scroll-wrapper">
        <div
          v-for="conversation in openTabs"
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
// import { useRoute } from 'vue-router';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { sendMessage, createPlan, createDeliverable } from '@/services/agent2agent/actions';
import { conversation } from '@/services/conversationHelpers';
import AgentChatView from './AgentChatView.vue';
import TwoPaneConversationView from './TwoPaneConversationView.vue';
// const route = useRoute();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const agentsStore = useAgentsStore();
// Computed
const activeConversation = computed(() => chatUiStore.activeConversation);

// Get only the open tabs (conversations that are in openConversationTabs array)
const openTabs = computed(() => {
  console.log('🔍 [ConversationTabs] Computing openTabs, openConversationTabs:', chatUiStore.openConversationTabs);
  const tabs = chatUiStore.openConversationTabs
    .map(id => {
      const conv = conversationsStore.conversationById(id);
      console.log('  → Tab ID:', id, 'Found:', !!conv, 'Title:', conv?.title);
      return conv;
    })
    .filter(conv => conv !== undefined);
  console.log('🔍 [ConversationTabs] Computed', tabs.length, 'open tabs');
  return tabs;
});

const shouldUseTwoPaneView = computed(() => {
  // Enable two-pane view for all conversations
  // Regular agents: show deliverables in right pane
  // Orchestrator agents: show deliverables AND projects in right pane
  return true;
});

// Methods
const switchToConversation = async (conversationId: string) => {
  console.log('🔄 [ConversationTabs] Switching to conversation:', conversationId);

  const existingConversation = conversationsStore.conversationById(conversationId);
  const existingMessages = conversationsStore.messagesByConversation(conversationId);

  console.log('🔍 [ConversationTabs] Existing conversation:', !!existingConversation);
  console.log('🔍 [ConversationTabs] Existing messages count:', existingMessages?.length || 0);

  // If conversation exists and has messages, just switch to it
  if (existingConversation && existingMessages && existingMessages.length > 0) {
    console.log('✅ [ConversationTabs] Conversation already loaded, switching to it');
    chatUiStore.setActiveConversation(conversationId);
    return;
  }

  // Otherwise, load the conversation data from backend
  console.log('📥 [ConversationTabs] Loading conversation from backend...');
  try {
    const backendConversation = await conversation.getBackendConversation(conversationId);
    const messages = await conversation.loadConversationMessages(conversationId);

    console.log('📦 [ConversationTabs] Loaded messages from backend:', messages.length);

    // Ensure agents are loaded
    if (!agentsStore.availableAgents || agentsStore.availableAgents.length === 0) {
      await agentsStore.ensureAgentsLoaded();
    }

    const agent = agentsStore.availableAgents?.find(a => a.name === backendConversation.agentName);

    if (!agent) {
      console.error('Agent not found for conversation:', backendConversation.agentName);
      return;
    }

    // Create the conversation object
    const createdAt = backendConversation.createdAt ? new Date(backendConversation.createdAt) : new Date();
    const loadedConversation = conversation.createConversationObject(agent, createdAt);
    loadedConversation.id = conversationId;
    loadedConversation.agentName = backendConversation.agentName;
    loadedConversation.agentType = backendConversation.agentType;
    loadedConversation.organizationSlug = backendConversation.organizationSlug;
    loadedConversation.title = backendConversation.title || loadedConversation.title;

    // Add or update conversation in the store
    if (existingConversation) {
      conversationsStore.updateConversation(conversationId, loadedConversation);
    } else {
      conversationsStore.setConversation(loadedConversation);
    }

    // Set messages separately (the store manages messages in a separate Map)
    console.log('💾 [ConversationTabs] Setting messages in store...');
    conversationsStore.setMessages(conversationId, messages);

    // Verify messages were set
    const verifyMessages = conversationsStore.messagesByConversation(conversationId);
    console.log('✅ [ConversationTabs] Messages set in store, count:', verifyMessages.length);

    chatUiStore.setActiveConversation(conversationId);
  } catch (error) {
    console.error('Failed to load conversation:', error);
  }
};

const closeConversation = (conversationId: string) => {
  // Close the tab (but keep conversation data in store)
  chatUiStore.closeConversationTab(conversationId);
};

const handleSendMessage = async (content: string) => {
  const conversation = chatUiStore.activeConversation;
  if (!conversation || !conversation.agentName) {
    console.error('Cannot send message: no active conversation');
    return;
  }

  try {
    const mode = chatUiStore.chatMode || 'conversational';
    const agentName = conversation.agentName;

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