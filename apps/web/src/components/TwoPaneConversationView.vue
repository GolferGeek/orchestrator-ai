<template>
  <div class="two-pane-conversation" :class="{ 'mobile-single-pane': isMobile && showWorkProductPane }">
    <!-- Header Controls -->
    <div class="conversation-header">
      <div class="conversation-info">
        <h2>{{ conversation?.title || 'Conversation' }}</h2>
        <span class="agent-name">with {{ conversation?.agent?.name }}</span>
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
            :class="{ 'has-deliverable': messageHasDeliverable(message) }"
          >
            <AgentTaskItem
              :message="message"
              :conversation-id="conversation?.id"
              :agent="conversation?.agent"
              :agent-name="conversation?.agent?.name"
              @deliverable-created="handleDeliverableCreated"
              @deliverable-updated="handleDeliverableUpdated"
            />
            
            <!-- Deliverable Connection Indicator -->
            <div 
              v-if="messageHasDeliverable(message)"
              class="deliverable-indicator"
              @click="selectDeliverable(getMessageDeliverable(message))"
            >
              <ion-icon :icon="linkOutline" />
              <span>Created/Updated Deliverable</span>
              <ion-icon :icon="arrowForwardOutline" />
            </div>
          </div>
        </div>

        <!-- Input Area -->
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
          <div style="padding: 10px; background: yellow; font-size: 12px;">
            DEBUG: Rendering DeliverableDisplay with deliverable: {{ activeWorkProduct.data?.title }}
          </div>
          <DeliverableDisplay
            :deliverable="activeWorkProduct.data"
            :conversation-id="conversation?.id"
            @version-changed="handleVersionChanged"
            @merge-requested="handleMergeRequested"
            @edit-requested="handleEditRequested"
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
} from 'ionicons/icons';
import { useAgentChatStore } from '@/stores/agentChatStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { useAuthStore } from '@/stores/authStore';
import AgentTaskItem from './AgentTaskItem.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import DeliverableDisplay from './DeliverableDisplay.vue';
import ProjectDisplay from './ProjectDisplay.vue';
import DeliverableMergeView from './DeliverableMergeView.vue';

interface Props {
  conversation?: any;
}

const props = defineProps<Props>();

// Stores
const agentChatStore = useAgentChatStore();
const deliverablesStore = useDeliverablesStore();
const authStore = useAuthStore();

// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const showWorkProductPane = ref(false);
const showDeliverableSelector = ref(false);
const showMergeModal = ref(false);
const mergeDeliverable = ref<any>(null);
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
  console.log('🎭 hasActiveWorkProduct computed:', result, 'activeWorkProduct:', activeWorkProduct.value);
  return result;
});

const isOrchestratorConversation = computed(() => {
  return props.conversation?.agent?.name?.toLowerCase().includes('orchestrator') || false;
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
    console.error('Failed to send message:', error);
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
  return message.deliverable_id || 
         message.deliverableId ||
         (message.metadata && (message.metadata.deliverable_id || message.metadata.deliverableId));
};

const getMessageDeliverable = (message: any) => {
  const deliverableId = message.deliverable_id || 
                        message.deliverableId ||
                        message.metadata?.deliverable_id || 
                        message.metadata?.deliverableId;
  return deliverablesStore.getDeliverableById(deliverableId);
};

const selectDeliverable = (deliverable: any) => {
  if (!deliverable) {
    console.warn('selectDeliverable called with null/undefined deliverable');
    return;
  }
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  // Always open the work product pane when a deliverable is selected
  if (!showWorkProductPane.value) {
    showWorkProductPane.value = true;
    console.log('🎭 Opened work product pane from selectDeliverable');
  }
  showDeliverableSelector.value = false;
};

const handleDeliverableCreated = (deliverable: any) => {
  console.log('🎭 TwoPaneConversationView: handleDeliverableCreated called with:', deliverable);
  console.log('🎭 Current conversation ID:', props.conversation?.id);
  console.log('🎭 Deliverable conversation ID:', deliverable.conversation_id);
  
  // Auto-select newly created deliverable
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  console.log('🎭 Set activeWorkProduct:', activeWorkProduct.value);
  
  if (!showWorkProductPane.value && !isMobile.value) {
    showWorkProductPane.value = true;
    console.log('🎭 Showed work product pane');
  }
  
  console.log('🎭 Current showWorkProductPane state:', showWorkProductPane.value);
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

const handleMergeRequested = (deliverable: any) => {
  mergeDeliverable.value = deliverable;
  showMergeModal.value = true;
};

const handleEditRequested = (workProduct: any) => {
  // Navigate to edit view or open edit modal
  // Implementation depends on editing strategy
  const productType = activeWorkProduct.value?.type || 'deliverable';
  console.log('Edit requested for', productType, ':', workProduct.id);
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
  console.log('Project step updated:', step);
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

// Responsive handling
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768;
  if (!isMobile.value && showWorkProductPane.value === undefined) {
    showWorkProductPane.value = true;
  }
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // Auto-scroll to bottom on mount
  scrollToBottom();
  
  // Load deliverables for this conversation only if authenticated
  if (props.conversation?.id && authStore.isAuthenticated) {
    deliverablesStore.loadDeliverablesByConversation(props.conversation.id);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// Ensure pane opens when a work product becomes active (desktop)
watch(() => activeWorkProduct.value, (val) => {
  if (val && !isMobile.value && !showWorkProductPane.value) {
    showWorkProductPane.value = true;
    console.log('🎭 Opened work product pane from activeWorkProduct watcher');
  }
});

// Watch for new messages and scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});

// Watch for conversation changes and load deliverables
watch(() => props.conversation?.id, (newId) => {
  if (newId && authStore.isAuthenticated) {
    deliverablesStore.loadDeliverablesByConversation(newId);
  }
  // Reset active work product when switching conversations
  activeWorkProduct.value = null;
});

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
  width: 400px;
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

.deliverable-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9em;
  color: #1565c0;
}

.deliverable-indicator:hover {
  background: #bbdefb;
  border-color: #90caf9;
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
  
  .deliverable-indicator {
    background: #1e40af;
    border-color: #2563eb;
    color: #dbeafe;
  }
  
  .deliverable-indicator:hover {
    background: #2563eb;
    border-color: #3b82f6;
    color: #ffffff;
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

html[data-theme="dark"] .deliverable-indicator {
  background: #1e40af;
  border-color: #2563eb;
  color: #dbeafe;
}

html[data-theme="dark"] .deliverable-indicator:hover {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
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
    width: 350px;
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
</style>