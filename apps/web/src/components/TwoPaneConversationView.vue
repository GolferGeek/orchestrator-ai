<template>
  <div class="two-pane-conversation" :class="{ 'mobile-single-pane': isMobile && showWorkProductPane }">
    <!-- Header Controls -->
    <div class="conversation-header">
      <div class="conversation-info">
        <h2>{{ conversation?.title || 'Conversation' }}</h2>
        <span class="agent-name">with {{ conversation?.agent?.name }}</span>
        <!-- Sovereign Mode Indicator -->
        <SovereignModeTooltip position="bottom" :show-data-flow="true" :show-compliance="true">
          <SovereignModeBadge variant="compact" :clickable="false" />
        </SovereignModeTooltip>
      </div>
      <div class="header-controls">
        <!-- Mobile pane toggle -->
        <ion-button
          v-if="isMobile && hasActiveWorkProduct"
          fill="clear"
          @click="togglePane"
        >
          <ion-icon :icon="showWorkProductPane ? chatbubbleOutline : documentTextOutline" />
        </ion-button>
        <!-- Desktop layout controls -->
        <ion-button
          v-if="!isMobile"
          fill="clear"
          @click="toggleWorkProductPane"
        >
          <ion-icon :icon="showWorkProductPane ? eyeOffOutline : eyeOutline" />
          {{ showWorkProductPane ? 'Hide' : 'Show' }} {{ getWorkProductLabel() }}
        </ion-button>
        <TaskExecutionControls />
      </div>
    </div>
    <div class="panes-container">
      <!-- Conversation Pane -->
      <div 
        class="conversation-pane" 
        :class="{ 
          'full-width': !showWorkProductPane || (isMobile && !showWorkProductPane),
          'hidden': isMobile && showWorkProductPane
        }"
      >
        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <ion-spinner />
          <p>Loading conversation...</p>
        </div>
        <!-- Error State -->
        <div v-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <p>{{ error }}</p>
          <ion-button @click="clearError">Dismiss</ion-button>
        </div>
        
        <!-- Sovereign Mode Banner -->
        <SovereignModeBanner 
          v-if="shouldShowSovereignBanner"
          :variant="sovereignBannerVariant"
          :dismissible="false"
          class="sovereign-conversation-banner"
        />
        
        <!-- Messages -->
        <div class="messages-container" ref="messagesContainer">
          <!-- Prominent thinking indicator -->
          <div v-if="isSendingMessage" class="prominent-thinking-indicator">
            <div class="thinking-content">
              <div class="thinking-avatar">
                <ion-spinner name="dots" color="primary"></ion-spinner>
              </div>
              <div class="thinking-bubble">
                <div class="thinking-text">
                  <div class="agent-thinking-name">{{ currentAgent?.name || 'Agent' }}</div>
                  <div class="thinking-message">is thinking...</div>
                </div>
                <div class="thinking-dots">
                  <span class="dot"></span>
                  <span class="dot"></span>
                  <span class="dot"></span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-wrapper"
            :class="{ 
              'has-deliverable': messageHasDeliverable(message)
            }"
          >
            <AgentTaskItem
              :message="message"
              :conversation-id="conversation?.id"
              :agent="conversation?.agent"
              :agent-name="conversation?.agent?.name"
              :show-work-product-pane="showWorkProductPane"
              @deliverable-created="handleDeliverableCreated"
              @deliverable-updated="handleDeliverableUpdated"
              @deliverable-selected="selectDeliverable"
            />
          </div>
        </div>
        <!-- Input Area (always visible) -->
        <div class="input-area">
          <form @submit.prevent="sendMessage">
            <ion-item>
              <ion-textarea
                v-model="messageText"
                placeholder="Type your message..."
                :rows="2"
                :disabled="!currentAgent"
                @keydown.enter.prevent="sendMessage"
              />
              <ion-button
                slot="end"
                type="submit"
                :disabled="!canSend"
                fill="clear"
              >
                <ion-icon :icon="sendOutline" />
              </ion-button>
            </ion-item>
          </form>
          <!-- Compact LLM Controls -->
          <div class="llm-controls">
            <CompactLLMControl />
          </div>
        </div>
        <!-- Typing Indicator -->
        <div v-if="isSendingMessage" class="typing-indicator">
          <ion-spinner size="small" />
          <span>Agent is thinking...</span>
        </div>
      </div>
      <!-- Work Product Pane (Deliverable or Project) -->
      <div 
        class="work-product-pane" 
        :class="{ 
          'hidden': !showWorkProductPane,
          'full-width': isMobile && showWorkProductPane,
          'empty-work-product': !hasActiveWorkProduct
        }"
        v-if="showWorkProductPane"
      >
        <!-- Deliverable Display -->
        <template v-if="activeWorkProduct?.type === 'deliverable'">
          <DeliverableDisplay
            :deliverable="activeWorkProduct.data"
            :conversation-id="conversation?.id"
            @version-changed="handleVersionChanged"
            @version-created="handleVersionCreated"
            @merge-requested="handleMergeRequested"
            @edit-requested="handleEditRequested"
            @run-with-different-llm="handleRunWithDifferentLLM"
          />
        </template>
        <!-- Project Display -->
        <ProjectDisplay
          v-else-if="activeWorkProduct?.type === 'project'"
          :project="activeWorkProduct.data"
          :conversation-id="conversation?.id"
          @project-updated="handleProjectUpdated"
          @step-updated="handleStepUpdated"
          @edit-requested="handleEditRequested"
        />
        <!-- Empty work product state -->
        <div 
          v-else
          class="empty-state"
        >
          <ion-icon :icon="documentTextOutline" size="large" color="medium" />
          <h3>No Work Product Selected</h3>
          <p v-if="isOrchestratorConversation">
            Projects, deliverables, and plans will appear here when the orchestrator creates them.
          </p>
          <p v-else>
            Deliverables will appear here when agents create content in this conversation.
          </p>
        </div>
      </div>
    </div>
    <!-- Mobile Work Product Selector -->
    <ion-action-sheet
      :is-open="showDeliverableSelector"
      header="Select Work Product"
      :buttons="deliverableActionButtons"
      @didDismiss="showDeliverableSelector = false"
    />
    <!-- Merge Modal -->
    <ion-modal :is-open="showMergeModal" @did-dismiss="closeMergeModal">
      <DeliverableMergeView
        v-if="mergeDeliverable"
        :deliverable="mergeDeliverable"
        @merge-completed="handleMergeCompleted"
        @merge-cancelled="closeMergeModal"
      />
    </ion-modal>
    
    <!-- LLM Rerun Modal -->
    <ion-modal :is-open="showLLMRerunModal" @did-dismiss="closeLLMRerunModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>Run with Different LLM</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeLLMRerunModal">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="modal-content">
        <div class="llm-rerun-container">
          <div class="rerun-info">
            <h3>Re-run Deliverable</h3>
            <p>This will create a new version of the deliverable using a different LLM model with the same original prompt.</p>
          </div>
          <div class="llm-selector-wrapper">
            <LLMSelector>
              <template #actions>
                <ion-button 
                  fill="clear" 
                  @click="closeLLMRerunModal"
                  size="default"
                >
                  Cancel
                </ion-button>
                <ion-button 
                  @click="executeRerun"
                  :disabled="!canExecuteRerun"
                  color="primary"
                  size="default"
                >
                  <ion-icon :icon="playOutline" slot="start" />
                  Run with Selected LLM
                </ion-button>
              </template>
            </LLMSelector>
          </div>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue';
import {
  IonIcon,
  IonButton,
  IonItem,
  IonTextarea,
  IonSpinner,
  IonActionSheet,
  IonModal,
  IonChip,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
} from '@ionic/vue';
import {
  alertCircleOutline,
  sendOutline,
  chatbubbleOutline,
  documentTextOutline,
  eyeOutline,
  eyeOffOutline,
  linkOutline,
  arrowForwardOutline,
  closeOutline,
  playOutline,
} from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { useAuthStore } from '@/stores/authStore';
import { useSovereignPolicyStore } from '@/stores/sovereignPolicyStore';
import { useLLMStore } from '@/stores/llmStore';
import type { AgentChatMessage } from '@/stores/agentChatStore/types';
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import DeliverableDisplay from './DeliverableDisplay.vue';
import ProjectDisplay from './ProjectDisplay.vue';
import DeliverableMergeView from './DeliverableMergeView.vue';
import LLMSelector from './LLMSelector.vue';
import SovereignModeBadge from './SovereignMode/SovereignModeBadge.vue';
import SovereignModeTooltip from './SovereignMode/SovereignModeTooltip.vue';
import SovereignModeBanner from './SovereignMode/SovereignModeBanner.vue';
interface Props {
  conversation?: any;
}
const props = defineProps<Props>();
// Stores
const agentChatStore = useAgentChatStore();
const deliverablesStore = useDeliverablesStore();
const authStore = useAuthStore();
const sovereignPolicyStore = useSovereignPolicyStore();
const llmStore = useLLMStore();
// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const showWorkProductPane = ref(false);
const showDeliverableSelector = ref(false);
const showMergeModal = ref(false);
const mergeDeliverable = ref<any>(null);
const showLLMRerunModal = ref(false);
const rerunDeliverableData = ref<{ deliverable: any; version: any } | null>(null);
const activeWorkProduct = ref<{ type: 'deliverable' | 'project'; data: any } | null>(null);
const isMobile = ref(false);
// Computed properties
const currentAgent = computed(() => props.conversation?.agent);
const messages = computed(() => props.conversation?.messages || []);
const isLoading = computed(() => agentChatStore.isLoading);
const error = computed(() => agentChatStore.error);
const isSendingMessage = computed(() => agentChatStore.isSendingMessage);
const canSend = computed(() => {
  return messageText.value.trim().length > 0 && 
         !isSendingMessage.value && 
         currentAgent.value;
});
const hasActiveWorkProduct = computed(() => {
  const result = activeWorkProduct.value !== null;
  return result;
});
const isOrchestratorConversation = computed(() => {
  return props.conversation?.agent?.name?.toLowerCase().includes('orchestrator') || false;
});

// Sovereign mode computed properties
const shouldShowSovereignBanner = computed(() => {
  // Show banner for enforced policy or when there are warnings
  return sovereignPolicyStore.policy?.enforced || 
         sovereignPolicyStore.policyWarnings.length > 0;
});

const sovereignBannerVariant = computed(() => {
  if (sovereignPolicyStore.policy?.enforced) {
    return 'enforced';
  }
  if (sovereignPolicyStore.policyWarnings.length > 0) {
    return 'warning';
  }
  if (sovereignPolicyStore.effectiveSovereignMode) {
    return 'success';
  }
  return 'info';
});
const deliverableActionButtons = computed(() => {
  const conversationDeliverables = deliverablesStore.getDeliverablesByConversation(props.conversation?.id);
  return conversationDeliverables.map(deliverable => ({
    text: deliverable.title,
    handler: () => selectDeliverable(deliverable),
  })).concat([
    {
      text: 'Cancel',
      handler: () => {}  // Empty handler for cancel
    }
  ]);
});
// Methods
const sendMessage = async () => {
  if (!canSend.value) return;
  const content = messageText.value.trim();
  messageText.value = '';
  try {
    await agentChatStore.sendMessage(content);
    scrollToBottom();
  } catch (error) {

  }
};
const clearError = () => {
  agentChatStore.clearError();
};
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};
const togglePane = () => {
  showWorkProductPane.value = !showWorkProductPane.value;
};
const toggleWorkProductPane = () => {
  showWorkProductPane.value = !showWorkProductPane.value;
};
const getWorkProductLabel = () => {
  if (!activeWorkProduct.value) {
    return isOrchestratorConversation.value ? 'Work Product' : 'Deliverable';
  }
  return activeWorkProduct.value.type === 'deliverable' ? 'Deliverable' : 'Project';
};
const messageHasDeliverable = (message: any) => {
  // Check if message has associated deliverable (support both snake_case and camelCase)
  return message.deliverableId ||
         (message.metadata && message.metadata.deliverableId);
};
const getMessageDeliverable = (message: any) => {
  const deliverableId = message.deliverableId ||
                        message.metadata?.deliverableId;
  return deliverablesStore.getDeliverableById(deliverableId);
};
const selectDeliverable = async (deliverable: any) => {
  if (!deliverable) {

    return;
  }
  // Versions are already loaded by openExistingConversation, but load them if missing
  const versions = deliverablesStore.getDeliverableVersionsSync(deliverable.id);
  if (!versions || versions.length === 0) {
    try {
      await deliverablesStore.loadDeliverableVersions(deliverable.id);
    } catch (error) {

      // Don't let version loading failure block deliverable selection
    }
  } else {
  }
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  // Always open the work product pane when a deliverable is selected
  showWorkProductPane.value = true;
  showDeliverableSelector.value = false;
};
const handleDeliverableCreated = async (deliverable: any) => {
  // Use the correct camelCase field name
  // Ensure the deliverable belongs to the current conversation
  if (props.conversation?.id && deliverable.conversationId !== props.conversation.id) {

    return;
  }
  // Load versions for the newly created deliverable
  try {
    await deliverablesStore.loadDeliverableVersions(deliverable.id);
  } catch (error) {

    // Don't let version loading failure block deliverable creation handling
  }
  // Auto-select newly created or newly loaded deliverable
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  // FORCE show the work product pane immediately when a deliverable is created
  showWorkProductPane.value = true;
  // Force Vue reactivity update
  await nextTick();
  // Show visual debugging toast to confirm pane opened
  try {
    const { toastController } = await import('@ionic/vue');
    const toast = await toastController.create({
      message: `✅ Deliverable "${deliverable.title}" created and pane opened!`,
      duration: 3000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  } catch (error) {

  }
};
const handleDeliverableUpdated = (deliverable: any) => {
  // Update active work product if it's the same deliverable
  if (activeWorkProduct.value?.type === 'deliverable' && 
      activeWorkProduct.value.data.id === deliverable.id) {
    activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  }
};
const handleVersionChanged = (version: any) => {
  if (activeWorkProduct.value?.type === 'deliverable') {
    activeWorkProduct.value = { type: 'deliverable', data: version };
  }
};
const handleVersionCreated = async (newVersion: any) => {
  // When a new version is created, update the active work product to show the new version
  if (activeWorkProduct.value?.type === 'deliverable') {
    activeWorkProduct.value = { type: 'deliverable', data: newVersion };
  }
  // Reload the deliverables for this conversation to update the list
  if (props.conversation?.id) {
    await deliverablesStore.loadDeliverablesByConversation(props.conversation.id);
  }
};
const handleMergeRequested = (deliverable: any) => {
  mergeDeliverable.value = deliverable;
  showMergeModal.value = true;
};
const handleEditRequested = (workProduct: any) => {
  // Navigate to edit view or open edit modal
  // Implementation depends on editing strategy
  const productType = activeWorkProduct.value?.type || 'deliverable';
};
const handleProjectUpdated = (project: any) => {
  // Update active work product if it's the same project
  if (activeWorkProduct.value?.type === 'project' && 
      activeWorkProduct.value.data.id === project.id) {
    activeWorkProduct.value = { type: 'project', data: project };
  }
};
const handleStepUpdated = (step: any) => {
  // Handle project step updates
  // Could update the project data with the new step information
};
const closeMergeModal = () => {
  showMergeModal.value = false;
  mergeDeliverable.value = null;
};
const handleMergeCompleted = (mergedDeliverable: any) => {
  activeWorkProduct.value = { type: 'deliverable', data: mergedDeliverable };
  closeMergeModal();
};

// LLM Rerun handlers
const handleRunWithDifferentLLM = (data: { deliverable: any; version: any }) => {
  rerunDeliverableData.value = data;
  showLLMRerunModal.value = true;
};

const closeLLMRerunModal = () => {
  showLLMRerunModal.value = false;
  rerunDeliverableData.value = null;
};

const canExecuteRerun = computed(() => {
  return llmStore.selectedProvider && 
         llmStore.selectedModel && 
         rerunDeliverableData.value && 
         rerunDeliverableData.value.version?.id;
});

const executeRerun = async () => {
  if (!canExecuteRerun.value || !rerunDeliverableData.value || !rerunDeliverableData.value.version?.id) {
    console.error('Invalid rerun data:', rerunDeliverableData.value);
    return;
  }

  // Capture the rerun data before closing modal (to avoid race condition)
  const capturedRerunData = { ...rerunDeliverableData.value };

  // Close modal immediately to start conversation flow
  closeLLMRerunModal();

  // Create a user message for the rerun request
  const rerunMessage = `🔄 Regenerating deliverable "${capturedRerunData.deliverable.title}" with ${llmStore.selectedProvider.name}/${llmStore.selectedModel.name}`;
  
  try {
    // Add user message to conversation
    const userMessage: AgentChatMessage = {
      id: `rerun-${Date.now()}`,
      role: 'user',
      content: rerunMessage,
      timestamp: new Date(),
      metadata: {
        isRerunRequest: true,
        originalVersionId: capturedRerunData.version.id,
        rerunLLMConfig: {
          provider: llmStore.selectedProvider.name.toLowerCase(),
          model: llmStore.selectedModel.modelName,
          temperature: llmStore.selectedProvider.temperature,
          maxTokens: llmStore.selectedProvider.maxTokens,
        }
      }
    };

    // Add message to conversation
    if (props.conversation) {
      props.conversation.messages.push(userMessage);
    }

    // Set conversation loading state (like normal sendMessage)
    if (props.conversation) {
      props.conversation.isSendingMessage = true;
      props.conversation.error = undefined;
    }

    // Normalize provider name to lowercase for backend compatibility
    const providerName = llmStore.selectedProvider.name.toLowerCase();
    
    const llmConfig: any = {
      provider: providerName,
      model: llmStore.selectedModel.modelName,
    };
    
    // Only include temperature and maxTokens if they have valid values
    if (llmStore.selectedProvider.temperature !== undefined && llmStore.selectedProvider.temperature !== null) {
      llmConfig.temperature = llmStore.selectedProvider.temperature;
    }
    if (llmStore.selectedProvider.maxTokens !== undefined && llmStore.selectedProvider.maxTokens !== null) {
      llmConfig.maxTokens = llmStore.selectedProvider.maxTokens;
    }
    
    console.log('🔄 LLM Rerun Config:', llmConfig);
    
    // Call the store method to rerun with different LLM
    const newVersion = await deliverablesStore.rerunWithDifferentLLM(
      capturedRerunData.version.id,
      llmConfig
    );

    // Create assistant response message with the new deliverable
    const assistantMessage: AgentChatMessage = {
      id: `rerun-response-${Date.now()}`,
      role: 'assistant', 
      content: `✅ Created new version with ${llmStore.selectedProvider.name}/${llmStore.selectedModel.name}`,
      timestamp: new Date(),
      deliverableId: newVersion.deliverableId,
      metadata: {
        isRerunResponse: true,
        newVersionId: newVersion.id,
        llmUsed: llmConfig,
        sourceVersionId: capturedRerunData.version.id
      }
    };

    // Add response message to conversation
    if (props.conversation) {
      props.conversation.messages.push(assistantMessage);
    }

    // Reload deliverable versions to get the new version
    await deliverablesStore.loadDeliverableVersions(capturedRerunData.deliverable.id);

    // Trigger deliverable selection to show the new version
    await handleVersionCreated(newVersion);

  } catch (error) {
    console.error('Failed to rerun with different LLM:', error);
    
    // Create error message in conversation
    const errorMessage: AgentChatMessage = {
      id: `rerun-error-${Date.now()}`,
      role: 'assistant',
      content: `❌ Failed to regenerate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
      metadata: {
        isRerunError: true,
        errorDetails: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    // Add error message to conversation
    if (props.conversation) {
      props.conversation.messages.push(errorMessage);
    }
  } finally {
    // Clear loading state
    if (props.conversation) {
      props.conversation.isSendingMessage = false;
    }
  }
};
// Responsive handling
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
  // Don't auto-show work product pane on desktop - let the conversation content determine this
};
onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  // Auto-scroll to bottom on mount
  scrollToBottom();
  // Deliverable loading is now handled by the conversation watcher with immediate: true
});
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
// Ensure pane opens when a work product becomes active (desktop)
watch(() => activeWorkProduct.value, (val) => {
  if (val && !isMobile.value && !showWorkProductPane.value) {
    showWorkProductPane.value = true;
  }
});
// Watch for new messages and scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});
// Watch for conversation changes and handle deliverable loading properly
watch(() => props.conversation?.id, async (newId, oldId) => {
  if (newId && authStore.isAuthenticated) {
    // Step 1: Check if deliverables are already loaded, if not load them
    let conversationDeliverables = deliverablesStore.getDeliverablesByConversation(newId);
    if (!conversationDeliverables || conversationDeliverables.length === 0) {
      // Load deliverables first
      try {
        const loadedDeliverables = await deliverablesStore.loadDeliverablesByConversation(newId);
        conversationDeliverables = loadedDeliverables || [];
      } catch (error) {

        conversationDeliverables = [];
      }
    } else {
    }
    if (conversationDeliverables.length > 0) {
      // Step 2: Get the most recent deliverable
      const mostRecentDeliverable = conversationDeliverables
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
      // Step 3: Load versions for the selected deliverable
      try {
        await deliverablesStore.loadDeliverableVersions(mostRecentDeliverable.id);
      } catch (error) {

      }
      // Step 4: Set up the work product pane and select the deliverable
      activeWorkProduct.value = { type: 'deliverable', data: mostRecentDeliverable };
      showWorkProductPane.value = true;
    } else {
      // Reset active work product when no deliverables
      activeWorkProduct.value = null;
      // Hide work product pane when no deliverables (can be toggled back on)
      if (!isMobile.value) {
        showWorkProductPane.value = false;
      }
    }
  } else {
    // Reset active work product when switching conversations
    activeWorkProduct.value = null;
    // Hide work product pane when no conversation
    if (!isMobile.value) {
      showWorkProductPane.value = false;
    }
  }
}, { immediate: true }); // Add immediate: true to ensure it runs on component mount
// Watch for authentication state changes and load deliverables when user logs in
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && props.conversation?.id) {
    deliverablesStore.loadDeliverablesByConversation(props.conversation.id);
  }
});
</script>
<style scoped>
.two-pane-conversation {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--ion-color-step-50);
}
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: white;
}
.conversation-info h2 {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
}
.agent-name {
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panes-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.conversation-pane {
  flex: 1;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  background: white;
  transition: all 0.3s ease;
}
.conversation-pane.full-width {
  flex: 1;
}
.conversation-pane.hidden {
  display: none;
}
.work-product-pane {
  width: 67%;
  min-width: 400px;
  max-width: none;
  border-left: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
  transition: all 0.3s ease;
}
.work-product-pane.full-width {
  width: 100%;
  border-left: none;
}
.work-product-pane.hidden {
  display: none;
}
.work-product-pane.empty-work-product {
  display: flex;
  align-items: center;
  justify-content: center;
}
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
}
.message-wrapper {
  margin-bottom: 16px;
}
.message-wrapper.has-deliverable {
  position: relative;
}
.input-area {
  border-top: 1px solid var(--ion-color-light);
  background: white;
  padding: 0;
}
.input-area ion-item {
  --border-width: 0;
  --inner-border-width: 0;
}
.input-area ion-textarea {
  --padding-top: 12px;
  --padding-bottom: 12px;
}
.llm-controls {
  padding: 8px 16px;
  background: var(--ion-color-step-50);
  border-top: 1px solid var(--ion-color-light-shade);
}
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--ion-color-step-100);
  border-top: 1px solid var(--ion-color-light);
  font-size: 0.9em;
  color: var(--ion-color-medium);
}
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
  text-align: center;
  color: var(--ion-color-medium);
}
.error-state {
  color: var(--ion-color-danger);
}
.empty-state {
  text-align: center;
  color: var(--ion-color-medium);
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
/* Prominent thinking indicator */
.prominent-thinking-indicator {
  margin-bottom: 16px;
  padding: 0 16px;
}
.thinking-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.thinking-avatar {
  width: 32px;
  height: 32px;
  background-color: var(--ion-color-medium-tint);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.thinking-bubble {
  background: var(--ion-color-light-shade);
  padding: 12px 16px;
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  flex: 1;
  max-width: 300px;
}
.thinking-text {
  margin-bottom: 8px;
}
.agent-thinking-name {
  font-size: 0.8em;
  font-weight: bold;
  color: var(--ion-color-medium-shade);
  margin-bottom: 2px;
}
.thinking-message {
  font-size: 0.9em;
  color: var(--ion-color-medium);
  font-style: italic;
}
.thinking-dots {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}
.dot {
  width: 6px;
  height: 6px;
  background-color: var(--ion-color-medium);
  border-radius: 50%;
  animation: thinking-pulse 1.4s infinite ease-in-out;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }
@keyframes thinking-pulse {
  0%, 80%, 100% { 
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% { 
    transform: scale(1);
    opacity: 1;
  }
}
/* Mobile responsive */
.mobile-single-pane .panes-container {
  position: relative;
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .two-pane-conversation {
    background: #1a1a1a;
  }
  .conversation-header {
    background: #2d3748;
    border-color: #4a5568;
    color: #f7fafc;
  }
  .conversation-info h2 {
    color: #f7fafc;
  }
  .agent-name {
    color: #a0aec0;
  }
  .conversation-pane {
    background: #1f2937;
  }
  .work-product-pane {
    background: #1a202c;
    border-color: #4a5568;
  }
  .messages-container {
    background: #1f2937;
  }
  .input-area {
    background: #2d3748;
    border-color: #4a5568;
  }
  .thinking-indicator {
    background: #374151;
    border-color: #4b5563;
  }
  .agent-thinking-name {
    color: #d1d5db;
  }
  .thinking-message {
    color: #9ca3af;
  }
  .dot {
    background-color: #6b7280;
  }
}
/* Manual dark theme toggle support */
html[data-theme="dark"] .two-pane-conversation {
  background: #1a1a1a;
}
html[data-theme="dark"] .conversation-header {
  background: #2d3748;
  border-color: #4a5568;
  color: #f7fafc;
}
html[data-theme="dark"] .conversation-info h2 {
  color: #f7fafc;
}
html[data-theme="dark"] .agent-name {
  color: #a0aec0;
}
html[data-theme="dark"] .conversation-pane {
  background: #1f2937;
}
html[data-theme="dark"] .work-product-pane {
  background: #1a202c;
  border-color: #4a5568;
}
html[data-theme="dark"] .messages-container {
  background: #1f2937;
}
html[data-theme="dark"] .input-area {
  background: #2d3748;
  border-color: #4a5568;
}
html[data-theme="dark"] .thinking-indicator {
  background: #374151;
  border-color: #4b5563;
}
html[data-theme="dark"] .agent-thinking-name {
  color: #d1d5db;
}
html[data-theme="dark"] .thinking-message {
  color: #9ca3af;
}
html[data-theme="dark"] .dot {
  background-color: #6b7280;
}
/* Tablet breakpoint */
@media (max-width: 1024px) {
  .work-product-pane {
    width: 60%;
    min-width: 350px;
    max-width: none;
  }
}
/* Mobile breakpoint */
@media (max-width: 768px) {
  .work-product-pane {
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
  }
  .conversation-pane.hidden {
    display: none;
  }
}

/* Sovereign Mode Styles */
.sovereign-conversation-banner {
  margin: 1rem;
  margin-bottom: 0.5rem;
}

.conversation-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.conversation-info h2 {
  margin: 0;
  flex-shrink: 0;
}

.agent-name {
  flex-shrink: 0;
}

/* Responsive adjustments for sovereign mode */
@media (max-width: 768px) {
  .sovereign-conversation-banner {
    margin: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .conversation-info {
    gap: 0.5rem;
  }
}

/* LLM Rerun Modal Styles */
.llm-rerun-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rerun-info h3 {
  margin: 0 0 8px 0;
  color: var(--ion-color-dark);
  font-size: 1.2em;
  font-weight: 600;
}

.rerun-info p {
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--ion-color-light);
}

.modal-footer {
  position: sticky;
  bottom: 0;
  background: var(--ion-color-step-50, #ffffff);
  border-top: 1px solid var(--ion-color-light);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.llm-selector-wrapper {
  max-height: 60vh;
  overflow-y: auto;
  padding-bottom: 20px;
}

html[data-theme="dark"] .rerun-info h3 {
  color: #f7fafc;
}

html[data-theme="dark"] .rerun-info p {
  color: #a0aec0;
}

html[data-theme="dark"] .modal-actions {
  border-color: #4a5568;
}

html[data-theme="dark"] .modal-footer {
  background: var(--ion-color-step-100, #1a1a1a);
  border-color: #4a5568;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}
</style>