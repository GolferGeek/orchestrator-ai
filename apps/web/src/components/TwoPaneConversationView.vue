<template>
  <div class="two-pane-conversation" :class="{ 'mobile-single-pane': isMobile && showWorkProductPane }">
    <!-- Header Controls -->
    <div class="conversation-header">
      <div class="conversation-info">
        <h2>{{ conversation?.title || 'Conversation' }}</h2>
        <span class="agent-name">with {{ currentAgent?.name }}</span>
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
          <!-- Agent Resources Panel -->
          <AgentResourcesPanel
            v-if="shouldShowAgentResources"
            :agent-video-ids="agentVideoIds"
            :fallback-video-ids="fallbackVideoIds"
            :videos="allVideos"
            :agent-slug="agentSlug"
            :agent-name="currentAgent?.name"
          />
          
          <!-- Prominent thinking indicator (Converse/Plan/Build modes) -->
          <div v-if="isSendingMessage && (currentChatMode === 'converse' || currentChatMode === 'plan' || currentChatMode === 'build')" class="prominent-thinking-indicator">
            <div class="thinking-content">
              <div class="thinking-avatar">
                <ion-spinner name="dots" color="primary"></ion-spinner>
              </div>
              <div class="thinking-bubble">
                <div class="thinking-text">
                  <div class="agent-thinking-name">{{ currentAgent?.name || 'Agent' }}</div>
                  <div class="thinking-message">{{ thinkingMessage }}</div>
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
              :agent="currentAgent"
              :agent-name="currentAgent?.name"
              :show-work-product-pane="showWorkProductPane"
              @deliverable-created="handleDeliverableCreated"
              @deliverable-updated="handleDeliverableUpdated"
              @deliverable-selected="selectDeliverable"
            />
          </div>
        </div>
        <div
          v-if="shouldShowRecommendations"
          class="agent-llm-suggestions"
        >
          <div class="agent-llm-suggestions__header">
            <span>Popular picks for {{ currentAgent?.name || 'this agent' }}</span>
            <ion-spinner v-if="isRecommendationsLoading" name="lines" />
          </div>
          <div
            v-if="topAgentRecommendations.length"
            class="agent-llm-suggestions__chips"
          >
            <ion-chip
              v-for="rec in topAgentRecommendations"
              :key="`${rec.providerName}-${rec.modelName}`"
              class="agent-llm-suggestions__chip"
              :class="{ 'chip-selected': isRecommendationActive(rec) }"
              :outline="!isRecommendationActive(rec)"
              :color="isRecommendationActive(rec) ? 'primary' : undefined"
              @click="applyRecommendation(rec)"
            >
              <span class="chip-provider">{{ rec.providerName }}</span>
              <span class="chip-divider">•</span>
              <span class="chip-model">{{ rec.modelName }}</span>
              <span class="chip-rating">{{ rec.averageRating.toFixed(1) }}</span>
            </ion-chip>
          </div>
          <p
            v-else-if="!isRecommendationsLoading && !recommendationsError"
            class="agent-llm-suggestions__empty"
          >
            No highly rated runs yet.
          </p>
          <p
            v-if="!isRecommendationsLoading && !topAgentRecommendations.length && recommendationsError"
            class="agent-llm-suggestions__error"
          >
            {{ recommendationsError }}
          </p>
        </div>
        <!-- Input Area (always visible) -->
        <div class="input-area">
          <form @submit.prevent="sendMessage()">
            <ion-item>
              <ion-textarea
                v-model="messageText"
                placeholder="Type your message..."
                :rows="2"
                :disabled="!currentAgent"
                @keydown.enter.prevent="sendMessage()"
              />
              <!-- Conversational Speech Button (moved to middle position) -->
              <ConversationalSpeechButton
                v-if="props.conversation?.id"
                slot="end"
                :conversation-id="props.conversation.id"
                :agent-name="currentAgent?.name"
                :agent-type="currentAgent?.type || 'generalists'"
                :disabled="!currentAgent"
                @conversation-start="handleConversationStart"
                @conversation-end="handleConversationEnd"
                @error="handleSpeechError"
              />
              <!-- Mode-aware Send Button -->
              <ChatModeSendButton
                slot="end"
                :disabled="!canSend"
                @send="sendMessage"
              />
            </ion-item>
          </form>
          <!-- Compact LLM + Mode + Execution Controls -->
          <div class="llm-controls">
            <CompactLLMControl />
            <TaskExecutionControls />
          </div>
          <!-- Enhance-here hint when a deliverable is selected -->
          <div v-if="activeWorkProduct?.type === 'deliverable'" class="enhance-hint">
            <ion-chip color="warning" outline>
              Enhancing: {{ activeWorkProduct.data?.title || 'Deliverable' }} — type instructions and press send
            </ion-chip>
            <ion-button size="small" fill="clear" @click="cancelEnhancement">Cancel</ion-button>
          </div>
        </div>
        <!-- Typing Indicator -->
        <div v-if="isSendingMessage" class="typing-indicator">
          <ion-spinner size="small" />
          <span>Processing...</span>
        </div>
      </div>
      <!-- Work Product Pane with Tabs -->
      <div
        class="work-product-pane"
        :class="{
          'hidden': !showWorkProductPane,
          'full-width': isMobile && showWorkProductPane,
          'empty-work-product': !hasActiveWorkProduct && !conversation?.currentPlan
        }"
        v-if="showWorkProductPane"
      >
        <!-- Tabs for Plan and Deliverable -->
        <div v-if="conversation?.currentPlan || hasActiveWorkProduct" class="work-product-tabs">
          <ion-segment :value="activeTab" @ionChange="activeTab = $event.detail.value">
            <ion-segment-button v-if="conversation?.currentPlan" value="plan">
              <ion-label>Plan</ion-label>
              <ion-badge v-if="conversation?.currentPlan" color="primary">{{ conversation.currentPlan.currentVersion?.versionNumber || 1 }}</ion-badge>
            </ion-segment-button>
            <ion-segment-button v-if="activeWorkProduct?.type === 'deliverable'" value="deliverable">
              <ion-label>Deliverable</ion-label>
              <ion-badge v-if="activeWorkProduct?.data" color="success">{{ activeWorkProduct.data.currentVersion?.versionNumber || 1 }}</ion-badge>
            </ion-segment-button>
            <!-- Project segment button removed - projects deprecated -->
          </ion-segment>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Plan Tab -->
          <div v-if="activeTab === 'plan' && conversation?.currentPlan">
            <PlanDisplay
              :plan="conversation.currentPlan"
              :conversation-id="conversation?.id"
              @version-changed="handlePlanVersionChanged"
              @version-created="handlePlanVersionCreated"
              @current-version-changed="handlePlanCurrentVersionChanged"
              @run-with-different-llm="handleRunPlanWithDifferentLLM"
            />
          </div>

          <!-- Deliverable Tab -->
          <div v-if="activeTab === 'deliverable' && activeWorkProduct?.type === 'deliverable' && activeWorkProduct?.data">
            <DeliverableDisplay
              :deliverable="activeWorkProduct.data"
              :conversation-id="conversation?.id"
              @version-changed="handleVersionChanged"
              @version-created="handleVersionCreated"
              @merge-requested="handleMergeRequested"
              @edit-requested="handleEditRequested"
              @run-with-different-llm="handleRunWithDifferentLLM"
            />
          </div>

          <!-- Project Tab removed - projects deprecated -->
        </div>

        <!-- Empty work product state -->
        <div
          v-if="!conversation?.currentPlan && !hasActiveWorkProduct"
          class="empty-state"
        >
          <ion-icon :icon="documentTextOutline" size="large" color="medium" />
          <h3>No Work Product Selected</h3>
          <p v-if="isOrchestratorConversation">
            Projects, deliverables, and plans will appear here when the orchestrator creates them.
          </p>
          <p v-else>
            Deliverables and plans will appear here when agents create them in this conversation.
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
    
    <!-- LLM Reselector Modal (for rerun with different LLM) -->
    <LLMReselectorModal
      :is-open="showLLMRerunModal"
      @dismiss="closeLLMRerunModal"
      @execute="handleLLMExecute"
    />
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
  IonBadge,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/vue';
import {
  alertCircleOutline,
  chatbubbleOutline,
  documentTextOutline,
  eyeOutline,
  eyeOffOutline,
} from 'ionicons/icons';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore } from '@/stores/ui/chatUiStore';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { deliverablesService } from '@/services/deliverablesService';
import { usePlanStore } from '@/stores/planStore';
import { useAuthStore } from '@/stores/authStore';
import { videoService } from '@/services/videoService';
import {
  sendMessage as sendMessageAction,
  createPlan as createPlanAction,
  createDeliverable as createDeliverableAction
} from '@/services/agent2agent/actions';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useUiStore } from '@/stores/uiStore';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';
import type {
  AgentConversation,
  AgentChatMessage,
  AgentChatMode,
  LLMRunConfiguration,
} from '@/types/conversation';
import type { AgentLLMRecommendation } from '@/types/evaluation';
import { rerunPlan, rerunDeliverable } from '@/services/agent2agent/actions';
import AgentTaskItem from './AgentTaskItem.vue';
import AgentResourcesPanel from './AgentResourcesPanel.vue';
import CompactLLMControl from './CompactLLMControl.vue';
import TaskExecutionControls from './TaskExecutionControls.vue';
import ChatModeSendButton from './ChatModeSendButton.vue';
import DeliverableDisplay from './DeliverableDisplay.vue';
import PlanDisplay from './PlanDisplay.vue';
// ProjectDisplay removed - projects deprecated
import DeliverableMergeView from './DeliverableMergeView.vue';
import LLMReselectorModal from './LLMReselectorModal.vue';
import SovereignModeBadge from './SovereignMode/SovereignModeBadge.vue';
import SovereignModeTooltip from './SovereignMode/SovereignModeTooltip.vue';
import SovereignModeBanner from './SovereignMode/SovereignModeBanner.vue';
import ConversationalSpeechButton from './ConversationalSpeechButton.vue';
import type { Deliverable, DeliverableVersion } from '@/services/deliverablesService';
import type { PlanData, PlanVersionData } from '@orchestrator-ai/transport-types';

interface Props {
  conversation?: AgentConversation | null;
}
const props = defineProps<Props>();

interface DeliverableRerunContext {
  deliverable: Deliverable;
  version: DeliverableVersion;
}

interface PlanRerunContext {
  plan: PlanData;
  version: PlanVersionData;
}

type RerunContext = DeliverableRerunContext | PlanRerunContext;

const isPlanRerunContext = (context: RerunContext): context is PlanRerunContext =>
  'plan' in context;
// Stores
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();
const deliverablesStore = useDeliverablesStore();
const planStore = usePlanStore();
const authStore = useAuthStore();
const sovereignPolicyStore = usePrivacyStore();
const llmStore = useLLMPreferencesStore();
const uiStore = useUiStore();
// Reactive state
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const showWorkProductPane = ref(false);
const showDeliverableSelector = ref(false);
const showMergeModal = ref(false);
const mergeDeliverable = ref<Deliverable | null>(null);
const showLLMRerunModal = ref(false);
const rerunDeliverableData = ref<RerunContext | null>(null);
const activeWorkProduct = ref<{ type: 'deliverable'; data: Deliverable } | null>(null);
const activeTab = ref<'plan' | 'deliverable'>('plan');
const isMobile = ref(false);
// Computed properties
const currentAgent = computed(() => {
  if (!props.conversation) return null;
  // Construct agent-like object from conversation properties
  return {
    name: props.conversation.agentName || '',
    type: props.conversation.agentType || 'custom',
    slug: props.conversation.agentName || '',
    id: props.conversation.agentName || '',
    organizationSlug: props.conversation.organizationSlug,
  };
});
const currentAgentIdentifier = computed(() => currentAgent.value?.name ?? '');
const messages = computed<AgentChatMessage[]>(() => {
  // Try to get messages from conversation prop first (old structure), then from store
  if (props.conversation?.messages) {
    return props.conversation.messages;
  }
  if (props.conversation?.id) {
    return conversationsStore.messagesByConversation(props.conversation.id);
  }
  return [];
});

// Video-related computed properties
const agentSlug = computed(() => currentAgent.value?.slug ?? currentAgent.value?.id ?? '');

const agentVideoIds = computed(() => {
  const agentIdentifier = agentSlug.value || currentAgent.value?.name || '';
  if (!agentIdentifier) return [] as string[];
  return videoService.getAgentVideoIdsByNameOrSlug(agentIdentifier);
});

const fallbackVideoIds = computed(() => videoService.getDefaultVideoIds());

const allVideos = computed(() => videoService.getAllVideos());

const shouldShowAgentResources = computed(() => {
  if (!currentAgent.value) return false;
  return agentVideoIds.value.length > 0 || fallbackVideoIds.value.length > 0;
});
const isLoading = computed(() => chatUiStore.isLoading);
const error = computed(() => chatUiStore.error);
const isSendingMessage = computed(() => chatUiStore.isSendingMessage);
const canSend = computed(() => {
  return (
    messageText.value.trim().length > 0 &&
    !isSendingMessage.value &&
    Boolean(currentAgent.value)
  );
});
const currentChatMode = computed<AgentChatMode | string | undefined>(() => chatUiStore.chatMode);
const agentRecommendations = computed(() =>
  currentAgentIdentifier.value
    ? llmStore.getRecommendationsForAgent(currentAgentIdentifier.value)
    : [],
);
const topAgentRecommendations = computed(() => agentRecommendations.value.slice(0, 3));
const isRecommendationsLoading = computed(() => llmStore.isAgentRecommendationsLoading);
const recommendationsError = computed(() => llmStore.agentRecommendationsErrorMessage);
const shouldShowRecommendations = computed(
  () =>
    isRecommendationsLoading.value ||
    topAgentRecommendations.value.length > 0 ||
    !!recommendationsError.value,
);

// Current LLM selection for display (commented out as unused)
// const currentLLMProvider = computed(() => llmStore.selectedProvider?.name || 'No provider selected');
// const currentLLMModel = computed(() => llmStore.selectedModel?.modelName || 'No model selected');
// Informal thinking message for converse/plan/build
const thinkingMessage = computed(() => {
  const mode = (currentChatMode.value || '').toLowerCase();
  if (mode === 'converse') return 'One sec — thinking it through…';
  if (mode === 'plan') return 'Sketching a quick plan…';
  if (mode === 'build') return 'Building your deliverable…';
  return 'Processing…';
});
const hasActiveWorkProduct = computed(() => {
  const result = activeWorkProduct.value !== null;
  return result;
});
const isOrchestratorConversation = computed(() => {
  const agentName = currentAgent.value?.name;
  // Ensure agentName is a string before calling toLowerCase
  if (typeof agentName === 'string') {
    return agentName.toLowerCase().includes('orchestrator');
  }
  return false;
});

// Sovereign mode computed properties
const shouldShowSovereignBanner = computed(() => {
  // Show banner for enforced policy or when there are warnings
  return sovereignPolicyStore.policy?.enforced ||
         (sovereignPolicyStore.policyWarnings?.length ?? 0) > 0;
});

const sovereignBannerVariant = computed(() => {
  if (sovereignPolicyStore.policy?.enforced) {
    return 'enforced';
  }
  if ((sovereignPolicyStore.policyWarnings?.length ?? 0) > 0) {
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
// Speech event handlers
const handleConversationStart = () => {
  uiStore.setConversationalMode(true);
  messageText.value = ''; // Clear text input when starting conversation
};

const handleConversationEnd = () => {
  uiStore.setConversationalMode(false);
};

const handleSpeechError = (error: unknown) => {
  console.error('Speech error:', error);
  uiStore.setConversationalMode(false);
};

// Methods
const sendMessage = async (mode?: AgentChatMode) => {
  if (!canSend.value) return;
  const content = messageText.value.trim();
  messageText.value = '';

  // If mode is provided, set it before sending
  // If no mode is set at all, default to 'converse' for new conversations
  if (mode) {
    chatUiStore.setChatMode(mode);
  } else if (!currentChatMode.value) {
    chatUiStore.setChatMode('converse');
  }

  const conversationId = props.conversation?.id;
  if (!conversationId) {
    console.error('Cannot send message: missing conversationId');
    return;
  }

  try {
    const agent = currentAgent.value;

    if (!agent) {
      console.error('Cannot send message: missing agent');
      return;
    }

    // Set sending state
    chatUiStore.setIsSendingMessage(true);
    chatUiStore.setError(null);

    const effectiveMode = mode || currentChatMode.value || 'converse';
    const agentName = agent.name;

    // Route to appropriate action based on mode
    if (effectiveMode === 'plan') {
      await createPlanAction(agentName, conversationId, content);
    } else if (effectiveMode === 'build') {
      // Always call createDeliverable - backend will automatically enhance existing deliverable if one exists
      // and create a new version with the user's new instructions
      await createDeliverableAction(agentName, conversationId, content);
    } else {
      // converse mode (default - 'conversational' or undefined)
      await sendMessageAction(agentName, conversationId, content);
    }

    scrollToBottom();
  } catch (error) {
    console.error('Error sending message:', error);
    chatUiStore.setError(error instanceof Error ? error.message : 'Failed to send message');
    // Re-populate the input if there was an error
    messageText.value = content;
  } finally {
    chatUiStore.setIsSendingMessage(false);
  }
};
// Check if a recommendation matches the current selection
const isRecommendationActive = (recommendation: AgentLLMRecommendation) => {
  if (!recommendation || !recommendation.providerName || !recommendation.modelName) {
    return false;
  }
  
  return (
    llmStore.selectedProvider?.name?.toLowerCase() === recommendation.providerName.toLowerCase() &&
    llmStore.selectedModel?.modelName?.toLowerCase() === recommendation.modelName.toLowerCase()
  );
};

const applyRecommendation = async (recommendation: AgentLLMRecommendation) => {
  if (!recommendation || !recommendation.providerName || !recommendation.modelName) {
    console.error('❌ Invalid recommendation:', recommendation);
    return;
  }

  console.log('🎯 Applying recommendation:', recommendation);
  console.log('📋 Before update - Current selection:', {
    provider: llmStore.selectedProvider?.name,
    model: llmStore.selectedModel?.modelName
  });

  // Find provider by name
  const provider = llmStore.filteredProviders.find(
    (p) => p.name?.toLowerCase() === recommendation.providerName.toLowerCase(),
  );

  if (!provider) {
    console.error('❌ Provider not found:', recommendation.providerName);
    return;
  }

  // Set provider first and wait for models to load
  console.log('Setting provider to:', provider.name);
  await llmStore.setProvider(provider);

  // Wait for next tick to ensure models list is updated
  await nextTick();

  // Find model - must match both provider and model name
  // The recommendation.modelName might be "ollama/gpt-oss:20b" format
  // We need to match against the actual model name which might be "gpt-oss:20b"
  const recommendedModelName = recommendation.modelName.toLowerCase();

  console.log('Looking for model:', recommendedModelName, 'in provider:', provider.name);
  console.log('Available models for this provider:', llmStore.filteredModels
    .filter(m => m.providerName === provider.name)
    .map(m => ({ modelName: m.modelName, name: m.name })));

  const model = llmStore.filteredModels.find((m) => {
    if (m.providerName !== provider.name) return false;

    const modelNameLower = m.modelName?.toLowerCase() || '';
    const modelDisplayNameLower = m.name?.toLowerCase() || '';

    // Debug log for each model checked
    console.log(`Checking model: modelName="${m.modelName}", name="${m.name}" against recommendation="${recommendedModelName}"`);

    // Try exact match first
    if (modelNameLower === recommendedModelName || modelDisplayNameLower === recommendedModelName) {
      console.log('✅ Exact match found!');
      return true;
    }

    // If recommendation includes provider prefix like "ollama/gpt-oss:20b", try without prefix
    const withoutPrefix = recommendedModelName.replace(`${provider.name?.toLowerCase() || ''}/`, '');
    if (modelNameLower === withoutPrefix || modelDisplayNameLower === withoutPrefix) {
      console.log('✅ Match found without provider prefix!');
      return true;
    }

    // Also try matching if one has :latest and the other doesn't
    const modelBase = modelNameLower.replace(':latest', '');
    const recBase = withoutPrefix.replace(':latest', '');
    if (modelBase === recBase) {
      console.log('✅ Match found ignoring :latest suffix!');
      return true;
    }

    return false;
  });

  if (!model) {
    console.error('❌ Model not found:', recommendation.modelName, 'for provider:', provider.name);
    console.log('Available models for provider:', llmStore.filteredModels
      .filter(m => m.providerName === provider.name)
      .map(m => ({ name: m.name, modelName: m.modelName })));
    return;
  }

  // Set model
  console.log('Setting model to:', model.modelName);
  llmStore.setModel(model);

  // Note: Don't update user preferences here - that should only happen when
  // the user explicitly selects a model via the LLMSelectorModal.
  // This is just applying an agent recommendation, not a user preference change.

  // Verify the change happened
  nextTick(() => {
    console.log('✅ After update - Current selection:', {
      provider: llmStore.selectedProvider?.name,
      model: llmStore.selectedModel?.modelName,
      llmSelection: llmStore.currentLLMSelection
    });
  });
};
const clearError = () => {
  conversationsStore.clearError();
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
  return 'Deliverable';
};
const messageHasDeliverable = (message: AgentChatMessage) => {
  return Boolean(message.deliverableId || message.metadata?.deliverableId);
};
// const getMessageDeliverable = (message: AgentChatMessage) => {
//   const deliverableId = message.deliverableId || message.metadata?.deliverableId;
//   return deliverableId ? deliverablesStore.getDeliverableById(deliverableId) : null;
// };
const selectDeliverable = async (deliverable: Deliverable | null) => {
  if (!deliverable) {
    return;
  }
  // Versions are already loaded by openExistingConversation, but load them if missing
  const versions = deliverablesStore.getDeliverableVersionsSync(deliverable.id);
  if (!versions || versions.length === 0) {
    try {
      const versionList = await deliverablesService.getVersionHistory(deliverable.id);
      versionList.forEach(v => {
        deliverablesStore.addVersion(deliverable.id, v);
      });
    } catch (error) {
      console.error('Failed to load deliverable versions:', error);
      // Don't let version loading failure block deliverable selection
    }
  }
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  // Always open the work product pane when a deliverable is selected
  showWorkProductPane.value = true;
  showDeliverableSelector.value = false;
  try {
    // Set enhancement context so user composer enhancements route to versioning
    await deliverablesStore.startEnhancement(deliverable.id);
  } catch {
    // Ignore enhancement errors
  }
};

const cancelEnhancement = async () => {
  try { await deliverablesStore.stopEnhancement(); } catch {
    // Ignore enhancement errors
  }
};
const handleDeliverableCreated = async (deliverable: Deliverable) => {
  console.log('🎉 [TwoPaneConversationView.handleDeliverableCreated] Called with deliverable:', deliverable.id, 'title:', deliverable.title);
  console.log('🎉 [TwoPaneConversationView.handleDeliverableCreated] Current conversation:', props.conversation?.id);
  console.log('🎉 [TwoPaneConversationView.handleDeliverableCreated] Deliverable conversationId:', deliverable.conversationId);

  // Use the correct camelCase field name
  // Ensure the deliverable belongs to the current conversation
  if (props.conversation?.id && deliverable.conversationId !== props.conversation.id) {
    console.log('⚠️ [TwoPaneConversationView.handleDeliverableCreated] Deliverable belongs to different conversation, ignoring');
    return;
  }

  console.log('✅ [TwoPaneConversationView.handleDeliverableCreated] Deliverable belongs to current conversation');

  // Load versions for the newly created deliverable
  try {
    console.log('📥 [TwoPaneConversationView.handleDeliverableCreated] Loading deliverable versions...');
    const versionList = await deliverablesService.getVersionHistory(deliverable.id);
    versionList.forEach(v => {
      deliverablesStore.addVersion(deliverable.id, v);
    });
    console.log('✅ [TwoPaneConversationView.handleDeliverableCreated] Versions loaded');
  } catch (error) {
    console.error('❌ [TwoPaneConversationView.handleDeliverableCreated] Error loading versions:', error);
    // Don't let version loading failure block deliverable creation handling
  }

  // Auto-select newly created or newly loaded deliverable
  console.log('🎯 [TwoPaneConversationView.handleDeliverableCreated] Setting activeWorkProduct to deliverable:', deliverable.id);
  activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  console.log('🎯 [TwoPaneConversationView.handleDeliverableCreated] activeWorkProduct set:', activeWorkProduct.value);

  // FORCE show the work product pane immediately when a deliverable is created
  console.log('🎯 [TwoPaneConversationView.handleDeliverableCreated] Setting showWorkProductPane to true');
  showWorkProductPane.value = true;
  console.log('🎯 [TwoPaneConversationView.handleDeliverableCreated] showWorkProductPane set:', showWorkProductPane.value);

  // Force Vue reactivity update
  await nextTick();
  console.log('✅ [TwoPaneConversationView.handleDeliverableCreated] nextTick complete');

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
    console.error('❌ [TwoPaneConversationView.handleDeliverableCreated] Error showing toast:', error);
  }
};
const handleDeliverableUpdated = (deliverable: Deliverable) => {
  // Update active work product if it's the same deliverable
  if (activeWorkProduct.value?.type === 'deliverable' && 
      activeWorkProduct.value.data.id === deliverable.id) {
    activeWorkProduct.value = { type: 'deliverable', data: deliverable };
  }
};
const handleVersionChanged = (version: DeliverableVersion) => {
  if (activeWorkProduct.value?.type === 'deliverable') {
    const owningDeliverable = deliverablesStore.getDeliverableById(version.deliverableId);
    if (owningDeliverable) {
      activeWorkProduct.value = { type: 'deliverable', data: owningDeliverable };
    }
  }
};
const handleVersionCreated = async (newVersion: DeliverableVersion) => {
  // When a new version is created, update the active work product to show the new version
  if (activeWorkProduct.value?.type === 'deliverable') {
    const owningDeliverable = deliverablesStore.getDeliverableById(newVersion.deliverableId);
    if (owningDeliverable) {
      activeWorkProduct.value = { type: 'deliverable', data: owningDeliverable };
    }
  }
  // Reload the deliverables for this conversation to update the list
  if (props.conversation?.id) {
    const deliverablesList = await deliverablesService.getConversationDeliverables(props.conversation.id);
    deliverablesList.forEach(d => {
      deliverablesStore.addDeliverable(d);
    });
  }
};
const handleMergeRequested = (deliverable: Deliverable) => {
  mergeDeliverable.value = deliverable;
  showMergeModal.value = true;
};
const handleEditRequested = (_workProduct: { type: 'deliverable'; data: Deliverable }) => {
  // Navigate to edit view or open edit modal
  // Implementation depends on editing strategy
  // const productType = activeWorkProduct.value?.type || 'deliverable';
};
// Project handlers removed - projects deprecated
const closeMergeModal = () => {
  showMergeModal.value = false;
  mergeDeliverable.value = null;
};
const handleMergeCompleted = (mergedDeliverable: Deliverable) => {
  activeWorkProduct.value = { type: 'deliverable', data: mergedDeliverable };
  closeMergeModal();
};

// LLM Rerun handlers
const handleRunWithDifferentLLM = (data: DeliverableRerunContext) => {
  console.log('🔍 [handleRunWithDifferentLLM] Capturing user message...');
  console.log('🔍 [handleRunWithDifferentLLM] Conversation ID:', props.conversation?.id);
  console.log('🔍 [handleRunWithDifferentLLM] Messages from computed:', messages.value.length);

  if (messages.value.length > 0) {
    console.log('🔍 [handleRunWithDifferentLLM] Message roles:', messages.value.map(m => m.role));
  }

  // Capture the last user message from the messages store
  let userMessage = '';
  const allMessages = messages.value;

  if (allMessages && allMessages.length > 0) {
    const userMessages = allMessages.filter(msg =>
      msg.role === 'user' && !msg.metadata?.isRerunRequest
    );
    console.log('🔍 [handleRunWithDifferentLLM] User messages (non-rerun) found:', userMessages.length);

    if (userMessages.length > 0) {
      userMessage = userMessages[userMessages.length - 1].content;
      console.log('✅ [handleRunWithDifferentLLM] Captured user message:', userMessage);
    } else {
      console.error('❌ [handleRunWithDifferentLLM] No non-rerun user messages found!');
    }
  } else {
    console.error('❌ [handleRunWithDifferentLLM] No messages available in store for conversation:', props.conversation?.id);
  }

  // Store rerun data with the user message
  rerunDeliverableData.value = {
    ...data,
    userMessage // Add the user message to the rerun context
  };
  console.log('🔍 [handleRunWithDifferentLLM] Stored rerun data. Has userMessage?', !!userMessage);
  showLLMRerunModal.value = true;
};

// Plan event handlers
const handlePlanVersionChanged = (version: PlanVersionData) => {
  console.log('Plan version changed:', version);
  // TODO: Update plan state if needed
};

const handlePlanVersionCreated = (version: PlanVersionData) => {
  console.log('Plan version created:', version);
  // TODO: Update plan state if needed
};

const handlePlanCurrentVersionChanged = (version: PlanVersionData) => {
  console.log('Plan current version changed:', version);
  // TODO: Update plan state if needed
};

const handleRunPlanWithDifferentLLM = (data: PlanRerunContext) => {
  console.log('Run plan with different LLM:', data);
  // Store plan data separately from deliverable data
  rerunDeliverableData.value = { plan: data.plan, version: data.version };
  showLLMRerunModal.value = true;
};

const closeLLMRerunModal = () => {
  showLLMRerunModal.value = false;
  rerunDeliverableData.value = null;
};

const handleLLMExecute = async (llmConfig: LLMRunConfiguration) => {
  if (!rerunDeliverableData.value) {
    console.error('No rerun data available');
    return;
  }

  // Capture the rerun data before closing modal
  const capturedRerunData = { ...rerunDeliverableData.value } as RerunContext;

  // Close modal immediately to start conversation flow
  closeLLMRerunModal();

  // Execute the rerun with the provided config
  await executeRerunWithConfig(capturedRerunData, llmConfig);
};

// const canExecuteRerun = computed(() => {
//   return llmStore.selectedProvider && 
//          llmStore.selectedModel && 
//          rerunDeliverableData.value && 
//          rerunDeliverableData.value.version?.id;
// });

const executeRerunWithConfig = async (
  capturedRerunData: RerunContext,
  llmConfig: LLMRunConfiguration
) => {
  console.log('🔍 [executeRerunWithConfig] Rerun data:', capturedRerunData);

  const plan = isPlanRerunContext(capturedRerunData) ? capturedRerunData.plan : null;
  const deliverable = 'deliverable' in capturedRerunData ? capturedRerunData.deliverable : null;
  const isDeliverable = Boolean(deliverable);
  const isPlan = Boolean(plan);

  // Use the user message that was captured when opening the modal
  const userPrompt = (capturedRerunData as any).userMessage || '';

  console.log('🔍 [executeRerunWithConfig] Using captured user message:', userPrompt);

  if (!userPrompt || userPrompt.trim() === '') {
    console.error('❌ [executeRerunWithConfig] User prompt is empty!');
    throw new Error('User message was not captured - cannot rerun without context');
  }

  try {
    // Set chat mode to converse to show proper UI state
    chatUiStore.setChatMode('converse');

    // Set loading state
    chatUiStore.setIsSendingMessage(true);

    // Add a system message to show the rerun in the UI (not sent to LLM)
    const systemMessage: AgentChatMessage = {
      id: `rerun-${Date.now()}`,
      role: 'system',
      content: `🔄 Regenerating with ${llmConfig.provider}/${llmConfig.model}`,
      timestamp: new Date(),
      metadata: {
        isRerunRequest: true,
        originalVersionId: capturedRerunData.version.id,
        rerunLLMConfig: llmConfig,
      }
    };

    if (props.conversation) {
      conversationsStore.addMessage(props.conversation.id, systemMessage);
    }

    console.log('🔄 LLM Rerun Config:', llmConfig, 'isPlan:', isPlan, 'isDeliverable:', isDeliverable);

    // Get agent slug from conversation (this is the reliable source)
    const agentSlug = props.conversation?.agentName || currentAgent.value?.slug;

    if (!agentSlug) {
      throw new Error('No agent slug available for rerun');
    }

    let result;
    if (isPlan) {
      // Call the rerunPlan action
      result = await rerunPlan(
        agentSlug,
        plan.conversationId,
        capturedRerunData.version.id,
        {
          provider: llmConfig.provider,
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        }
      );
    } else if (isDeliverable) {
      // Call the rerunDeliverable action with the original user prompt
      result = await rerunDeliverable(
        agentSlug,
        deliverable.conversationId,
        deliverable.id,
        capturedRerunData.version.id,
        {
          provider: llmConfig.provider,
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          maxTokens: llmConfig.maxTokens,
        },
        userPrompt || undefined
      );
    }

    // Create assistant response message with the new version
    const assistantMessage: AgentChatMessage = {
      id: `rerun-response-${Date.now()}`,
      role: 'assistant',
      content: `✅ Created new version with ${llmConfig.provider}/${llmConfig.model}`,
      timestamp: new Date(),
      ...(isPlan ? { planId: plan.id } : {}),
      ...(isDeliverable ? { deliverableId: deliverable.id } : {}),
      metadata: {
        isRerunResponse: true,
        newVersionId: result.version.id,
        llmUsed: llmConfig,
        sourceVersionId: capturedRerunData.version.id
      }
    };

    if (props.conversation) {
      // Use store method instead of direct prop mutation
      conversationsStore.addMessage(props.conversation.id, assistantMessage);
    }

    // For plans, the store is already updated by the rerunPlan action
    // The PlanDisplay component will automatically show the updated plan via Vue reactivity
    // No need to set activeWorkProduct - the plan is already displayed

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
      // Use store method instead of direct prop mutation
      conversationsStore.addMessage(props.conversation.id, errorMessage);
    }
  } finally {
    // Clear loading state
    chatUiStore.setIsSendingMessage(false);
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
watch(
  () => currentAgentIdentifier.value,
  (agentName) => {
    if (!agentName) {
      return;
    }

    console.log('📊 Fetching recommendations for agent:', agentName);
    const existing = llmStore.getRecommendationsForAgent(agentName);
    if (!existing.length && !llmStore.isAgentRecommendationsLoading) {
      llmStore.fetchAgentRecommendations(agentName, 3);
    }
  },
  { immediate: true },
);
// Ensure pane opens when a work product becomes active (desktop)
watch(() => activeWorkProduct.value, (val) => {
  console.log('👀 [TwoPaneConversationView] activeWorkProduct watcher triggered:', val, 'isMobile:', isMobile.value, 'showWorkProductPane:', showWorkProductPane.value);
  if (val && !isMobile.value && !showWorkProductPane.value) {
    console.log('🎯 [TwoPaneConversationView] Opening work product pane from watcher');
    showWorkProductPane.value = true;
  }
});
// Watch for new messages and scroll
watch(() => messages.value.length, () => {
  scrollToBottom();
});
// Watch for conversation changes and handle deliverable/plan loading properly
watch(() => props.conversation?.id, async (newId, _oldId) => {
  if (newId && authStore.isAuthenticated) {
    console.log('🔍 [TwoPaneConversationView] Conversation changed to:', newId);

    // Set chat mode to 'converse' for new conversations if it's an allowed mode
    if (props.conversation?.allowedChatModes?.includes('converse' as AgentChatMode)) {
      chatUiStore.setChatMode('converse');
      console.log('✅ [TwoPaneConversationView] Set chat mode to converse for new conversation');
    }

    // Step 0: Load plan for this conversation (similar to deliverables)
    let hasPlan = false;

    // Check if we already have the plan in the store
    const conversationPlans = planStore.plansByConversationId(newId);
    console.log('🔍 [TwoPaneConversationView] Plans in store:', conversationPlans.length);

    if (conversationPlans.length === 0) {
      // Load from API if not in store
      try {
        console.log('📡 [TwoPaneConversationView] Loading plan from API for conversation:', newId);
        const loadedPlan = await planStore.loadPlansByConversation(newId);
        if (loadedPlan) {
          // Set the plan on the conversation so PlanDisplay can access it
          chatUiStore.setPlan(newId, loadedPlan);
          hasPlan = true;
          console.log('✅ [TwoPaneConversationView] Loaded plan from API and set on conversation:', loadedPlan.id);
        } else {
          console.log('❌ [TwoPaneConversationView] No plan found in API for conversation');
        }
      } catch (error) {
        console.error('❌ [TwoPaneConversationView] Error loading plan:', error);
      }
    } else {
      // Plan already in store - get it and set on conversation
      const mostRecentPlan = conversationPlans[0]; // Already sorted by updatedAt DESC
      chatUiStore.setPlan(newId, mostRecentPlan);
      hasPlan = true;
      console.log('✅ [TwoPaneConversationView] Plan already in store, set on conversation:', mostRecentPlan.id);
    }

    console.log('🔍 [TwoPaneConversationView] hasPlan:', hasPlan);

    // Step 1: Check if deliverables are already loaded, if not load them
    let conversationDeliverables = deliverablesStore.getDeliverablesByConversation(newId);
    console.log('🔍 [TwoPaneConversationView] Initial deliverables from store:', conversationDeliverables?.length || 0);

    if (!conversationDeliverables || conversationDeliverables.length === 0) {
      // Load deliverables first
      console.log('📡 [TwoPaneConversationView] Loading deliverables from API...');
      try {
        const loadedDeliverables = await deliverablesService.getConversationDeliverables(newId);
        loadedDeliverables.forEach(d => {
          deliverablesStore.addDeliverable(d);
        });
        conversationDeliverables = loadedDeliverables || [];
        console.log('✅ [TwoPaneConversationView] Loaded deliverables from API:', conversationDeliverables.length);
      } catch (error) {
        console.error('❌ [TwoPaneConversationView] Error loading deliverables:', error);
        conversationDeliverables = [];
      }
    } else {
      console.log('✅ [TwoPaneConversationView] Using existing deliverables from store');
    }
    console.log('🔍 [TwoPaneConversationView] Final deliverables count:', conversationDeliverables.length, 'hasPlan:', hasPlan);
    console.log('🔍 [TwoPaneConversationView] Current showWorkProductPane before setting:', showWorkProductPane.value);
    console.log('🔍 [TwoPaneConversationView] Current activeWorkProduct before setting:', activeWorkProduct.value);

    if (conversationDeliverables.length > 0) {
      // Step 2: Get the most recent deliverable
      const mostRecentDeliverable = conversationDeliverables
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
      console.log('📋 [TwoPaneConversationView] Most recent deliverable:', mostRecentDeliverable.id);

      // Step 3: Load versions for the selected deliverable
      try {
        const versionList = await deliverablesService.getVersionHistory(mostRecentDeliverable.id);
        versionList.forEach(v => {
          deliverablesStore.addVersion(mostRecentDeliverable.id, v);
        });
        console.log('✅ [TwoPaneConversationView] Loaded deliverable versions');
      } catch (error) {
        console.error('❌ [TwoPaneConversationView] Error loading deliverable versions:', error);
      }

      // Step 4: Set up the work product pane and select the deliverable
      console.log('🎯 [TwoPaneConversationView] Setting activeWorkProduct to deliverable:', mostRecentDeliverable.id);
      activeWorkProduct.value = { type: 'deliverable', data: mostRecentDeliverable };
      console.log('🎯 [TwoPaneConversationView] Setting showWorkProductPane to true');
      showWorkProductPane.value = true;
      console.log('✅ [TwoPaneConversationView] After setting - showWorkProductPane:', showWorkProductPane.value, 'activeWorkProduct:', activeWorkProduct.value);
    } else if (hasPlan) {
      // If no deliverables but there's a plan, show the plan
      console.log('📋 [TwoPaneConversationView] Setting activeTab to plan and showing pane');
      activeTab.value = 'plan';
      showWorkProductPane.value = true;
      console.log('✅ [TwoPaneConversationView] Showing plan pane - showWorkProductPane:', showWorkProductPane.value, 'activeTab:', activeTab.value);
    } else {
      // Reset active work product when no deliverables or plans
      console.log('⚠️ [TwoPaneConversationView] No deliverables or plans, hiding pane');
      activeWorkProduct.value = null;
      // Hide work product pane when no deliverables or plans (can be toggled back on)
      if (!isMobile.value) {
        showWorkProductPane.value = false;
      }
      console.log('⚠️ [TwoPaneConversationView] After hiding - showWorkProductPane:', showWorkProductPane.value);
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
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated && props.conversation?.id) {
    const deliverablesList = await deliverablesService.getConversationDeliverables(props.conversation.id);
    deliverablesList.forEach(d => {
      deliverablesStore.addDeliverable(d);
    });
  }
});

// Watch for plan creation and show in work product pane
watch(() => props.conversation?.currentPlan, (plan) => {
  console.log('👀 [TwoPaneConversationView] currentPlan changed:', plan);
  if (plan) {
    activeTab.value = 'plan';
    showWorkProductPane.value = true;
    console.log('✅ [TwoPaneConversationView] Switched to plan tab:', plan.id);
  }
}, { immediate: true });

// Watch for deliverable selection and switch tabs
watch(() => activeWorkProduct.value, (workProduct) => {
  console.log('👀 [TwoPaneConversationView] activeWorkProduct tab watcher:', workProduct);
  if (workProduct?.type === 'deliverable') {
    console.log('🎯 [TwoPaneConversationView] Switching to deliverable tab');
    activeTab.value = 'deliverable';
  }
  // Project tab logic removed - projects deprecated
});

// Debug watcher for showWorkProductPane
watch(() => showWorkProductPane.value, (newVal, oldVal) => {
  console.log('🔄 [TwoPaneConversationView] showWorkProductPane changed from', oldVal, 'to', newVal);
  console.log('🔄 [TwoPaneConversationView] Current activeWorkProduct:', activeWorkProduct.value);
  console.log('🔄 [TwoPaneConversationView] Current activeTab:', activeTab.value);
  console.log('🔄 [TwoPaneConversationView] Current conversation.currentPlan:', props.conversation?.currentPlan);
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
  width: var(--app-convo-width-desktop); /* Theme variable */
  min-width: 320px; /* Minimum for mobile */
  display: flex;
  flex-direction: column;
  background: white;
  transition: all 0.3s ease;
  flex-shrink: 0; /* Don't shrink the conversation pane */
}
.conversation-pane.full-width {
  width: 100%; /* Take full width when work product pane is hidden */
}
.conversation-pane.hidden {
  display: none;
}
.work-product-pane {
  flex: 1; /* Take remaining space */
  min-width: var(--app-workpane-min-width);
  max-width: none;
  border-left: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Prevent parent from scrolling */
}
.work-product-tabs {
  flex-shrink: 0; /* Don't shrink tabs */
}
.tab-content {
  flex: 1;
  overflow-y: auto; /* Make tab content scrollable */
  padding: 16px;
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
.current-model-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.model-label {
  font-weight: 600;
  color: var(--ion-color-medium);
}

.agent-llm-suggestions {
  margin: 12px 16px 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}
.agent-llm-suggestions__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--ion-color-dark);
  margin-bottom: 8px;
}
.agent-llm-suggestions__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.agent-llm-suggestions__chip {
  cursor: pointer;
  --background: rgba(255, 255, 255, 0.94);
  --color: var(--ion-color-dark);
  font-size: 0.85rem;
  font-weight: 500;
}
.agent-llm-suggestions__chip:hover {
  --background: var(--ion-color-light);
  --color: var(--ion-color-dark);
  font-weight: 600;
}
.agent-llm-suggestions__chip .chip-provider {
  font-weight: 600;
}
.agent-llm-suggestions__chip .chip-divider {
  margin: 0 4px;
  opacity: 0.6;
}
.agent-llm-suggestions__chip .chip-rating {
  margin-left: 6px;
  font-weight: 600;
  color: var(--ion-color-primary);
}
.agent-llm-suggestions__empty,
.agent-llm-suggestions__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}
.agent-llm-suggestions__error {
  color: var(--ion-color-danger);
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
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
html[data-theme="dark"] .agent-llm-suggestions {
  background: rgba(45, 55, 72, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
html[data-theme="dark"] .agent-llm-suggestions__header {
  color: #e2e8f0;
}
html[data-theme="dark"] .agent-llm-suggestions__chip {
  --background: rgba(55, 65, 81, 0.9);
  --color: #e2e8f0;
}
html[data-theme="dark"] .agent-llm-suggestions__chip .chip-rating {
  color: var(--ion-color-primary-tint);
}
html[data-theme="dark"] .agent-llm-suggestions__empty,
html[data-theme="dark"] .agent-llm-suggestions__error {
  color: #a0aec0;
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
  .conversation-pane {
    width: var(--app-convo-width-tablet); /* Theme variable */
    min-width: 300px;
  }
  .work-product-pane {
    flex: 1; /* Take remaining space */
    min-width: 350px;
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
