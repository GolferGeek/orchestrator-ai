<template>
  <div class="agent-task-item" :class="[`task-role--${message.role}`]">
    <div class="task-message">
      <!-- User avatar removed for more space -->
      
      <!-- Task content -->
      <div class="task-content">
        <!-- Agent name for assistant messages -->
        <div v-if="message.role === 'assistant'" class="task-agent-name">
          {{ agentName }}
          <!-- Metadata button for agent responses -->
          <ion-button 
            v-if="message.metadata || message.taskId"
            fill="clear" 
            size="small" 
            @click="showMetadataModal = true"
            class="metadata-button"
          >
            <ion-icon :icon="informationCircleOutline" slot="icon-only" />
          </ion-button>
        </div>

        <!-- Human approval status badge (assistant messages) -->
        <div v-if="approvalStatus" class="approval-status">
          <ion-chip :color="approvalColor" size="small" outline @click="legendOpen = true">
            <ion-icon :icon="approvalIcon" />
            <span class="approval-text">{{ approvalText }}</span>
            <span v-if="approvalTime" class="approval-time">&nbsp;· {{ approvalTime }}</span>
          </ion-chip>
          <ion-popover :is-open="legendOpen" @didDismiss="legendOpen = false">
            <div class="legend">
              <div class="legend-row"><ion-icon :icon="ellipseOutline" class="pending" /> Pending — Awaiting Approval</div>
              <div class="legend-row"><ion-icon :icon="checkmarkCircleOutline" class="approved" /> Approved — Execution Resumed</div>
              <div class="legend-row"><ion-icon :icon="closeCircleOutline" class="rejected" /> Rejected — Execution Stopped</div>
            </div>
          </ion-popover>
        </div>
        

        <!-- Inline image gallery (if deliverable has image attachments) -->
        <div v-if="message.role === 'assistant' && imageAssets.length" class="image-gallery">
          <div class="thumb-grid">
            <img v-for="(img, idx) in imageAssets" :key="idx" class="thumb" :src="img.thumbnailUrl || img.url" :alt="img.altText || 'image'" @click.stop="openImage(img)" />
          </div>
        </div>

        <!-- Deliverable/Plan Creation Callout -->
        <div v-if="willHideForDeliverable" class="deliverable-creation-callout" :class="{ 'clickable': displayedDeliverable || displayedPlan }" @click="handleCalloutClick">
          <div class="callout-content">
            <ion-icon :icon="documentTextOutline" class="callout-icon" />
            <div class="callout-text">
              <div class="callout-title">
                {{ displayedPlan ? 'Plan Created' : displayedDeliverable ? 'Deliverable Created' : (hasBackendPlan ? 'Creating plan...' : 'Creating deliverable...') }}
              </div>
              <div class="callout-description">
                {{ displayedPlan ? displayedPlan.title : displayedDeliverable ? displayedDeliverable.title : 'Processing your request into a structured document' }}
              </div>
            </div>
            <div class="callout-indicator" v-if="!displayedDeliverable && !displayedPlan">
              <ion-spinner name="dots" color="primary" />
            </div>
            <div v-else class="callout-badges">
              <ion-chip size="small" color="primary" outline>
                {{ displayedPlan ? 'plan' : displayedDeliverable?.type || 'document' }}
              </ion-chip>
              <ion-chip v-if="llmUsed && llmUsed.providerName && llmUsed.modelName" size="small" color="medium" outline>
                <span class="chip-provider">{{ llmUsed.providerName }}</span>
                <span class="chip-divider">•</span>
                <span class="chip-model">{{ llmUsed.modelName }}</span>
              </ion-chip>
            </div>
          </div>
          <div class="callout-action" v-if="(displayedDeliverable || displayedPlan) && !props.showWorkProductPane">
            <ion-button fill="clear" size="small">
              <ion-icon :icon="arrowForwardOutline" slot="end" />
              View in {{ displayedPlan ? 'Plan' : 'Document' }} Pane
            </ion-button>
          </div>
          <div class="callout-action" v-else-if="(displayedDeliverable || displayedPlan) && props.showWorkProductPane">
            <ion-chip size="small" color="success" fill="outline">
              <ion-icon :icon="documentTextOutline" />
              Showing in {{ displayedPlan ? 'Plan' : 'Document' }} Pane
            </ion-chip>
          </div>
        </div>

        <!-- Task text content (shown for all messages, even with deliverables) -->
        <div class="task-text" v-if="message.content">
          <!-- Render markdown for assistant messages -->
          <div v-if="message.role === 'assistant'" class="rendered-content" v-html="renderedContent"></div>
          <!-- Plain text for user messages -->
          <div v-else>{{ message.content }}</div>
        </div>

        <!-- Thinking section (collapsible) for assistant messages -->
        <div v-if="message.role === 'assistant' && thinkingContent" class="thinking-section">
          <button
            class="thinking-toggle"
            @click="showThinking = !showThinking"
            :aria-expanded="showThinking"
          >
            <ion-icon :icon="showThinking ? chevronDownOutline : chevronForwardOutline" />
            <span class="thinking-label">Model Reasoning</span>
          </button>
          <div v-if="showThinking" class="thinking-content">
            {{ thinkingContent }}
          </div>
        </div>
        
        <!-- Workflow Progress (shown for real-time mode during processing) -->
        <div v-if="showWorkflowProgress" class="workflow-progress-container">
          <div class="workflow-header">
            <h5>Processing Steps</h5>
            <div class="workflow-overall-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${workflowProgress}%` }"></div>
              </div>
              <span class="progress-text">{{ completedWorkflowSteps }}/{{ totalWorkflowSteps }} steps</span>
            </div>
          </div>
          <div class="workflow-steps">
            <div 
              v-for="step in displayedWorkflowSteps" 
              :key="`${step.stepName}-${step.stepIndex}`"
              class="workflow-step"
              :class="getWorkflowStepClass(step)"
            >
              <div class="step-indicator">
                <div class="step-number">{{ step.stepIndex + 1 }}</div>
                <div class="step-status-icon">
                  <ion-icon 
                    :icon="getWorkflowStepIcon(step)"
                    :class="getWorkflowStepIconClass(step)"
                  />
                </div>
              </div>
              <div class="step-content">
                <div class="step-title">{{ formatWorkflowStepName(step.stepName) }}</div>
                <div v-if="step.message" class="step-message">{{ step.message }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Privacy Indicators for assistant messages only -->
        <UserPrivacyIndicators
          v-if="message.role === 'assistant' && showPrivacyIndicators"
          :show-data-protection="false"
          :is-data-protected="false"
          :show-sanitization-status="privacySettings.showSanitizationStatus"
          :sanitization-status="sanitizationStatus"
          :flagged-count="flaggedItemsCount"
          :pseudonymized-count="pseudonymizedItemsCount"
          :show-routing-display="privacySettings.showRoutingDisplay"
          :routing-mode="currentRoutingMode"
          :show-trust-signal="privacySettings.showTrustSignal"
          :trust-level="currentTrustLevel"
          :trust-score="currentTrustScore"
          :show-pii-count="privacySettings.showPiiCount"
          :show-processing-time="false"
          :processing-time-ms="0"
          :compact="privacySettings.compactMode"
        />
        
        <!-- Task timestamp -->
        <div class="task-timestamp">{{ formattedTimestamp }}</div>
        
        <!-- LLM Information for assistant messages -->
        <LLMInfo
          v-if="message.role === 'assistant' && llmUsed && ((message.metadata?.mode || '').toLowerCase() !== 'converse')"
          :llm-used="llmUsed"
          :usage="usage || undefined"
          :cost-calculation="costCalculation || undefined"
        />
      </div>
      
      <!-- Agent avatar removed for more space -->
  </div>
    
    <!-- Smart CTAs: Plan / Build (assistant messages only) -->
    <div v-if="message.role === 'assistant'" class="smart-cta-bar">
      <ion-chip v-if="suggestsPlan" color="primary" outline @click="handlePlanNow">
        Plan
      </ion-chip>
      <ion-chip v-if="suggestsBuild" color="success" outline @click="handleBuildNow">
        Build
      </ion-chip>
    </div>

    <!-- Task evaluation interface for assistant messages -->
    <div v-if="message.role === 'assistant' && message.taskId && 
                message.taskId !== 'pending' && 
                !message.taskId.startsWith('workflow-') && 
                !message.metadata?.isPlaceholder" class="task-evaluation">
      <TaskRating
        :task-id="message.taskId"
        :agent-name="agentName"
        :message-role="message.role"
      />
    </div>
    
    <!-- Task Metadata Modal -->
    <TaskMetadataModal 
      v-if="message.taskId && 
             message.taskId !== 'pending' && 
             !message.taskId.startsWith('workflow-') && 
             !message.metadata?.isPlaceholder"
      :is-open="showMetadataModal" 
      :task-id="message.taskId"
      @close="showMetadataModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { marked } from 'marked';
import { IonIcon, IonButton, IonSpinner, IonChip, IonPopover } from '@ionic/vue';
import {
  informationCircleOutline,
  documentTextOutline,
  arrowForwardOutline,
  checkmarkCircleOutline,
  playCircleOutline,
  closeCircleOutline,
  ellipseOutline,
  chevronDownOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import TaskRating from './TaskRating.vue';
import TaskMetadataModal from './TaskMetadataModal.vue';
import LLMInfo from './LLMInfo.vue';
import UserPrivacyIndicators from './UserPrivacyIndicators.vue';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { usePlanStore } from '@/stores/planStore';
import { usePrivacyStore } from '@/stores/privacyStore';
import { useLLMPreferencesStore } from '@/stores/llmPreferencesStore';
import { useConversationsStore } from '@/stores/conversationsStore';
import { useChatUiStore, type PendingAction } from '@/stores/ui/chatUiStore';
import { createPlan, createDeliverable } from '@/services/agent2agent/actions';
import analyticsService from '@/services/analyticsService';
import { apiService } from '@/services/apiService';
import { toastController } from '@ionic/vue';
import type {
  Agent,
  AgentChatMessage,
  AgentChatWorkflowStep,
  AgentChatCompletedStepSummary,
} from '@/types/conversation';
import type { Deliverable } from '@/services/deliverablesService';
import type { JsonObject, JsonValue, PlanData } from '@orchestrator-ai/transport-types';

interface LLMDisplayInfo {
  providerName: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  responseTimeMs?: number;
}

interface LLMUsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  responseTimeMs: number;
}

interface LLMCostSummary {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

interface DeliverableImageAttachment extends JsonObject {
  thumbnailUrl?: string;
  url?: string;
  altText?: string;
}

interface WorkflowDisplayStep {
  stepName: string;
  stepIndex: number;
  totalSteps: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  timestamp: Date;
}

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getJsonObject = (source: JsonObject | undefined, key: string): JsonObject | undefined => {
  if (!source) return undefined;
  const candidate = source[key];
  return isJsonObject(candidate) ? candidate : undefined;
};

const getJsonString = (source: JsonObject | undefined, key: string): string | undefined => {
  if (!source) return undefined;
  const candidate = source[key];
  return typeof candidate === 'string' ? candidate : undefined;
};

const getJsonNumber = (source: JsonObject | undefined, key: string): number | undefined => {
  if (!source) return undefined;
  const candidate = source[key];
  return typeof candidate === 'number' ? candidate : undefined;
};

const isDeliverableImageAttachment = (value: JsonValue): value is DeliverableImageAttachment => {
  if (!isJsonObject(value)) {
    return false;
  }

  const { thumbnailUrl, url, altText } = value as Partial<DeliverableImageAttachment>;
  return (
    (thumbnailUrl === undefined || typeof thumbnailUrl === 'string')
    && (url === undefined || typeof url === 'string')
    && (altText === undefined || typeof altText === 'string')
  );
};

const props = defineProps<{
  message: AgentChatMessage;
  agentName?: string;
  conversationId?: string;
  agent?: Agent;
  showWorkProductPane?: boolean;
}>();

const emit = defineEmits<{
  'deliverable-created': [deliverable: Deliverable];
  'deliverable-updated': [deliverable: Deliverable];
  'deliverable-selected': [deliverable: Deliverable];
}>();

// Stores
const deliverablesStore = useDeliverablesStore();
const planStore = usePlanStore();
const privacyIndicatorsStore = usePrivacyStore();
const llmStore = useLLMPreferencesStore();
const conversationsStore = useConversationsStore();
const chatUiStore = useChatUiStore();

// Reactive state
const showMetadataModal = ref(false);
const showThinking = ref(false);

// Extract thinking content from message metadata
const thinkingContent = computed(() => {
  return props.message.metadata?.thinking;
});

// Render markdown for assistant messages
const renderedContent = computed(() => {
  if (props.message.role === 'assistant' && props.message.content) {
    return marked(props.message.content, { breaks: true, gfm: true });
  }
  return props.message.content;
});
// Removed: Frontend deliverable creation logic (handled on backend)

// Computed properties
const hasBackendDeliverable = computed(() => {
  return !!(props.message.deliverableId || 
           props.message.metadata?.deliverableId);
});

const backendDeliverableId = computed(() => {
  const id = props.message.deliverableId ||
         props.message.metadata?.deliverableId;
  console.log('🆔 [AgentTaskItem.backendDeliverableId] Message:', props.message.id, 'has deliverableId:', id);
  return id;
});

const backendDeliverable = computed<Deliverable | null>(() => {
  const deliverableId = backendDeliverableId.value;
  console.log('🔍 [AgentTaskItem.backendDeliverable] Computing for message:', props.message.id, 'deliverableId:', deliverableId);

  if (!deliverableId) {
    console.log('❌ [AgentTaskItem.backendDeliverable] No deliverableId found');
    return null;
  }

  // Get deliverable from store - this will be reactive to store changes
  const deliverable = deliverablesStore.getDeliverableById(deliverableId);
  console.log('📦 [AgentTaskItem.backendDeliverable] Retrieved from store:', deliverable ? deliverable.id : 'NOT FOUND');

  // Force reactivity by accessing conversation deliverables
  if (props.conversationId) {
    const conversationDeliverables = deliverablesStore.getDeliverablesByConversation(props.conversationId);
    console.log('📋 [AgentTaskItem.backendDeliverable] Conversation deliverables count:', conversationDeliverables?.length || 0);

    // Also force reactivity on the deliverables store state
    void deliverablesStore.$state;
  }

  return deliverable ?? null;
});

const displayedDeliverable = computed(() => {
  return backendDeliverable.value;
});

// Plan tracking (similar to deliverable tracking)
const hasBackendPlan = computed(() => {
  return !!(props.message.planId ||
           props.message.metadata?.planId);
});

const backendPlanId = computed(() => {
  return props.message.planId ||
         props.message.metadata?.planId;
});

const backendPlan = computed<PlanData | null>(() => {
  const planId = backendPlanId.value;
  if (!planId) return null;

  // Get plan from store
  const plan = planStore.planById(planId);
  return plan ?? null;
});

const displayedPlan = computed(() => {
  return backendPlan.value;
});

const willHideForDeliverable = computed(() => {
  // Show callout bubble for both Plan and Build modes
  const hasWorkProduct = hasBackendDeliverable.value || hasBackendPlan.value;
  const isAssistantMessage = props.message.role === 'assistant';
  const mode = (props.message.metadata?.mode || '').toLowerCase();

  return hasWorkProduct && isAssistantMessage && (mode === 'build' || mode === 'plan');
});

// Removed unused computed property

const formattedTimestamp = computed(() => {
  const timestamp = props.message.timestamp;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Approval badge computed values
const approvalStatus = computed(() => {
  const metadata = props.message.metadata;
  if (!metadata) return '';
  if (metadata.approvalStatus) return metadata.approvalStatus;
  if (metadata.humanRequired) return 'pending';
  return '';
});
const approvalText = computed(() => {
  switch (approvalStatus.value) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'pending':
      return 'Awaiting Approval';
    default:
      return '';
  }
});
const approvalIcon = computed(() => {
  switch (approvalStatus.value) {
    case 'approved':
      return checkmarkCircleOutline;
    case 'rejected':
      return closeCircleOutline;
    case 'pending':
      return ellipseOutline;
    default:
      return ellipseOutline;
  }
});
const approvalColor = computed(() => {
  switch (approvalStatus.value) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'medium';
  }
});
const approvalTime = computed(() => {
  const metadata = props.message.metadata;
  const timestampSource = metadata?.approvedAt ?? metadata?.decisionAt ?? props.message.timestamp.toISOString();
  if (!timestampSource) return '';
  const parsed = new Date(timestampSource);
  return Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// Legend state
const legendOpen = ref(false);

// Removed unused computed properties
// Removed unused computed property
// Removed unused function
// Removed unused function

// If this message requires human approval, set pending action so a simple "yes" continues
onMounted(() => {
  const metadata = props.message.metadata;
  if (!metadata) return;

  const needsHuman = metadata.humanRequired === true || metadata.approvalStatus === 'pending';
  const mode = (metadata.mode ?? '').toLowerCase();
  if (!needsHuman || !props.conversationId) {
    return;
  }

  if (mode === 'build' || mode === 'plan') {
    const pendingAction: PendingAction = {
      type: mode,
      status: 'pending',
      conversationId: props.conversationId,
      metadata: props.message.taskId ? { taskId: props.message.taskId } : undefined,
    };
    chatUiStore.setPendingAction(pendingAction);
  }
});

// Image attachments for associated deliverable (if any)
const imageAssets = computed<DeliverableImageAttachment[]>(() => {
  const deliverableId = props.message.deliverableId ?? props.message.metadata?.deliverableId;
  if (!deliverableId) {
    return [];
  }

  const currentVersion = deliverablesStore.getCurrentVersion(deliverableId);
  const attachments = currentVersion?.fileAttachments;
  if (!attachments || !isJsonObject(attachments)) {
    return [];
  }

  const candidateImages = attachments['images'];
  if (!Array.isArray(candidateImages)) {
    return [];
  }

  return candidateImages.filter(isDeliverableImageAttachment);
});

// LLM Information computed properties
const llmUsed = computed<LLMDisplayInfo | null>(() => {
  const metadata = props.message.metadata;
  if (!metadata) {
    return null;
  }

  const llmMetadata = isJsonObject(metadata.llmMetadata) ? metadata.llmMetadata : undefined;
  const llmUsedMetadata = isJsonObject(metadata.llmUsed) ? metadata.llmUsed : undefined;
  const selection = getJsonObject(llmMetadata, 'originalLLMSelection')
    ?? getJsonObject(llmUsedMetadata, 'originalLLMSelection')
    ?? llmMetadata
    ?? llmUsedMetadata;

  const providerName = metadata.provider
    ?? getJsonString(selection, 'providerName')
    ?? getJsonString(selection, 'provider')
    ?? getJsonString(llmMetadata, 'provider_name')
    ?? 'Unknown Provider';

  const modelName = metadata.model
    ?? getJsonString(selection, 'modelName')
    ?? getJsonString(selection, 'model')
    ?? getJsonString(llmMetadata, 'model_name')
    ?? 'Unknown Model';

  const temperature = getJsonNumber(selection, 'temperature') ?? getJsonNumber(llmMetadata, 'temperature');
  const maxTokens = getJsonNumber(selection, 'maxTokens') ?? getJsonNumber(selection, 'max_tokens');
  const responseTimeMs =
    getJsonNumber(llmMetadata, 'responseTimeMs') ??
    getJsonNumber(llmMetadata, 'response_time_ms') ??
    getJsonNumber(llmMetadata, 'duration') ??
    getJsonNumber(llmUsedMetadata, 'responseTimeMs') ??
    getJsonNumber(llmUsedMetadata, 'duration');

  return {
    providerName,
    modelName,
    temperature,
    maxTokens,
    responseTimeMs,
  };
});

const usage = computed<LLMUsageSummary | null>(() => {
  const usageMeta = props.message.metadata?.usage;
  if (!usageMeta) {
    return null;
  }

  return {
    inputTokens: usageMeta.inputTokens ?? 0,
    outputTokens: usageMeta.outputTokens ?? 0,
    totalCost: usageMeta.totalCost ?? 0,
    responseTimeMs: usageMeta.responseTimeMs ?? 0,
  };
});

const costCalculation = computed<LLMCostSummary | null>(() => {
  const costMeta = props.message.metadata?.costCalculation;
  if (!costMeta) {
    return null;
  }

  return {
    inputTokens: costMeta.inputTokens ?? 0,
    outputTokens: costMeta.outputTokens ?? 0,
    inputCost: costMeta.inputCost ?? 0,
    outputCost: costMeta.outputCost ?? 0,
    totalCost: costMeta.totalCost ?? 0,
    currency: costMeta.currency ?? 'USD',
  };
});

// Workflow progress computed properties
const workflowSteps = computed<WorkflowDisplayStep[]>(() => {
  const metadata = props.message.metadata;
  if (!metadata) {
    return [];
  }

  const completedSteps = metadata.completedSteps ?? [];
  const realtimeSteps = metadata.workflow_steps_realtime ?? [];

  const stepMap = new Map<number, WorkflowDisplayStep>();

  completedSteps.forEach((step: AgentChatCompletedStepSummary) => {
    stepMap.set(step.index, {
      stepName: step.name,
      stepIndex: step.index,
      totalSteps: step.total,
      status: 'completed',
      message: step.message,
      timestamp: new Date(),
    });
  });

  realtimeSteps.forEach((step: AgentChatWorkflowStep) => {
    stepMap.set(step.stepIndex, {
      stepName: step.stepName,
      stepIndex: step.stepIndex,
      totalSteps: step.totalSteps,
      status: step.status,
      message: step.message,
      timestamp: step.timestamp ? new Date(step.timestamp) : new Date(),
    });
  });

  return Array.from(stepMap.values()).sort((a, b) => a.stepIndex - b.stepIndex);
});

const showWorkflowProgress = computed(() => {
  // Show workflow progress if:
  // 1. This is an assistant message
  // 2. It has workflow steps (from any execution that had them)
  // Keep it visible permanently - don't hide when deliverable callout shows
  const isAssistant = props.message.role === 'assistant';
  const hasWorkflowSteps = workflowSteps.value.length > 0;
  

  
  return isAssistant && hasWorkflowSteps;
});

const displayedWorkflowSteps = computed(() => {
  return workflowSteps.value;
});

const totalWorkflowSteps = computed(() => {
  const steps = workflowSteps.value;
  if (steps.length === 0) return 0;
  // Get the totalSteps from any step (they should all be the same)
  return steps[0]?.totalSteps || steps.length;
});

const completedWorkflowSteps = computed(() => {
  return workflowSteps.value.filter(step => step.status === 'completed').length;
});

const workflowProgress = computed(() => {
  const total = totalWorkflowSteps.value;
  const completed = completedWorkflowSteps.value;
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
});

// Privacy indicators computed properties
const privacyState = computed(() => {
  return privacyIndicatorsStore.getMessagePrivacyState(props.message.id);
});

const privacySettings = computed(() => {
  const defaultSettings = {
    showDataProtection: true,
    showSanitizationStatus: true,
    showRoutingDisplay: true,
    showTrustSignal: true,
    showPiiCount: true,
    showProcessingTime: false,
    compactMode: false
  };

  if (!props.conversationId) return defaultSettings;
  
  const conversationSettings = privacyIndicatorsStore.getConversationSettings(props.conversationId);
  return conversationSettings ? {
    showDataProtection: conversationSettings.showDataProtection,
    showSanitizationStatus: conversationSettings.showSanitizationStatus,
    showRoutingDisplay: conversationSettings.showRoutingDisplay,
    showTrustSignal: conversationSettings.showTrustSignal,
    showPiiCount: conversationSettings.showPiiCount,
    showProcessingTime: conversationSettings.showProcessingTime,
    compactMode: conversationSettings.compactMode
  } : defaultSettings;
});

const showPrivacyIndicators = computed(() => {
  // Suppress badges for informal modes and placeholders
  const mode = (props.message.metadata?.mode || '').toLowerCase();
  const isPlaceholder = !!props.message.metadata?.isPlaceholder;
  if (isPlaceholder) return false;
  if (mode === 'converse' || mode === 'plan') return false;

  // Only show for assistant messages with metadata otherwise
  return props.message.role === 'assistant' && (props.message.metadata || privacyState.value);
});

// Reactive LLM-based privacy indicators
const currentRoutingMode = computed(() => {
  return llmStore.currentRoutingMode;
});

const currentTrustLevel = computed(() => {
  return llmStore.currentTrustLevel;
});

const currentTrustScore = computed(() => {
  return llmStore.currentTrustScore;
});

// Sanitization status - read from message metadata (better architecture)
const pseudonymizedItemsCount = computed(() => {
  // First check for simplified PII metadata
  const simplifiedPii = props.message.metadata?.simplifiedPii;
  if (simplifiedPii) {
    console.log('🏷️ [BADGE-CHECK] Using simplified PII - pseudonym count:', simplifiedPii.pseudonymCount);
    return simplifiedPii.pseudonymCount || 0;
  }
  
  // Fall back to legacy PII metadata
  const piiMetadata = props.message.metadata?.piiMetadata || props.message.piiMetadata;
  
  // Debug logging for PII badges (only when no simplified metadata)
  if (props.message.role === 'assistant' && !simplifiedPii) {
    console.log('🏷️ [BADGE-CHECK] Falling back to legacy PII metadata');
    if (piiMetadata) {
      console.log('🏷️ [BADGE-CHECK] Legacy PII structure found');
    }
  }
  
  // Check the correct structure based on PIIProcessingMetadata type
  if (piiMetadata?.pseudonymResults?.processedMatches?.length) {
    return piiMetadata.pseudonymResults.processedMatches.length;
  }
  if (piiMetadata?.pseudonymResults?.mappingsCount) {
    return piiMetadata.pseudonymResults.mappingsCount;
  }
  if (piiMetadata?.pseudonymInstructions?.targetMatches?.length) {
    return piiMetadata.pseudonymInstructions.targetMatches.length;
  }
  return 0;
});

const flaggedItemsCount = computed(() => {
  // First check for simplified PII metadata
  const simplifiedPii = props.message.metadata?.simplifiedPii;
  if (simplifiedPii) {
    console.log('🚩 [BADGE-CHECK] Using simplified PII - flag count:', simplifiedPii.flagCount);
    return simplifiedPii.flagCount || 0;
  }
  
  // Fall back to legacy PII metadata
  const piiMetadata = props.message.metadata?.piiMetadata || props.message.piiMetadata;
  
  // Use the correct structure: detectionResults.flaggedMatches
  if (piiMetadata?.detectionResults?.flaggedMatches?.length) {
    const count = piiMetadata.detectionResults.flaggedMatches.length;
    console.log('🚩 [BADGE-CHECK] Falling back to legacy - flaggedMatches:', count);
    return count;
  }
  
  // Alternative: use totalMatches if available
  if (piiMetadata?.detectionResults?.totalMatches) {
    const count = piiMetadata.detectionResults.totalMatches;
    console.log('🚩 [BADGE-CHECK] Falling back to legacy - totalMatches:', count);
    return count;
  }
  
  return 0;
});

const sanitizationStatus = computed(() => {
  const piiMetadata = props.message.metadata?.piiMetadata || props.message.piiMetadata;
  if (piiMetadata?.showstopperDetected) {
    return 'blocked';
  }
  if (pseudonymizedItemsCount.value > 0) {
    return 'completed';
  }
  return 'none';
});

// Removed unused computed properties

// Methods

const handleCalloutClick = () => {
  if (displayedPlan.value) {
    // Plan click - show plan pane (handled by parent)
    // Could emit 'plan-selected' if needed
  } else if (displayedDeliverable.value) {
    emit('deliverable-selected', displayedDeliverable.value);
  }
};

// Smart CTA detection
// const contentText = computed(() => (props.message.content || '').toLowerCase());
const suggestsPlan = computed(() => {
  // Simple regex-based detection - assume modes are allowed (no permission check here)
  return /would you like.*plan|should i.*plan|plan (it|this)|create (a|the) (plan|prd)|requirements|spec/i.test(props.message.content || '');
});
const suggestsBuild = computed(() => {
  // Simple regex-based detection - assume modes are allowed (no permission check here)
  return /would you like.*build|should i.*build|build (it|this)|proceed to build|execute (now|this)/i.test(props.message.content || '');
});

async function handlePlanNow() {
  if (!props.conversationId || !props.agent) return;

  chatUiStore.setChatMode('plan');
  chatUiStore.setPendingAction({ mode: 'plan', taskId: props.message.taskId });

  // Execute using actions
  try {
    await createPlan(props.agent.name, props.conversationId, 'Create a plan based on our conversation');
  } catch (error) {
    console.error('Error creating plan:', error);
  }

  analyticsService.trackEvent({
    eventType: 'ui',
    category: 'cta',
    action: 'plan_clicked',
    label: 'Plan It',
    properties: { taskId: props.message.taskId, conversationId: props.conversationId },
    context: { url: window.location.pathname, userAgent: navigator.userAgent },
  });
}
async function handleBuildNow() {
  if (!props.conversationId || !props.agent) return;

  chatUiStore.setChatMode('build');
  chatUiStore.setPendingAction({ mode: 'build', taskId: props.message.taskId });

  // Execute using actions - use latest plan if available
  try {
    const conversation = conversationsStore.conversationById(props.conversationId);
    const planId = conversation?.currentPlan?.id;
    await createDeliverable(props.agent.name, props.conversationId, 'Build a deliverable based on our conversation', planId);
  } catch (error) {
    console.error('Error creating build:', error);
  }

  analyticsService.trackEvent({
    eventType: 'ui',
    category: 'cta',
    action: 'build_clicked',
    label: 'Build It',
    properties: { taskId: props.message.taskId, conversationId: props.conversationId },
    context: { url: window.location.pathname, userAgent: navigator.userAgent },
  });
}

// Workflow step styling methods
const getWorkflowStepClass = (step: WorkflowDisplayStep) => {
  return {
    'step-pending': step.status === 'pending',
    'step-in-progress': step.status === 'in_progress',
    'step-completed': step.status === 'completed',
    'step-failed': step.status === 'failed'
  };
};

const getWorkflowStepIcon = (step: WorkflowDisplayStep) => {
  switch (step.status) {
    case 'completed':
      return checkmarkCircleOutline;
    case 'in_progress':
      return playCircleOutline;
    case 'failed':
      return closeCircleOutline;
    default:
      return ellipseOutline;
  }
};

const getWorkflowStepIconClass = (step: WorkflowDisplayStep) => {
  return {
    'icon-completed': step.status === 'completed',
    'icon-in-progress': step.status === 'in_progress',
    'icon-failed': step.status === 'failed',
    'icon-pending': step.status === 'pending'
  };
};

const formatWorkflowStepName = (stepName: string): string => {
  return stepName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Removed: Helper functions for deliverable detection and creation (handled on backend)

// Removed: createDeliverable function (deliverables are now created on backend)

// Removed: Watch for message completion (deliverables are created on backend)

// Removed: Watch for backend deliverable ID (deliverables are loaded during conversation opening)

// Watch for changes in deliverable availability to debug timing issues
watch(() => hasBackendDeliverable.value, (newVal, oldVal) => {
  if (newVal !== oldVal) {

  }
}, { immediate: true });

// Initialize privacy state for this message and handle TTS
watch(() => props.message, (newMessage) => {
  if (newMessage && newMessage.role === 'assistant' && newMessage.metadata) {
    // Privacy state updates are handled elsewhere - this method doesn't exist
    // privacyIndicatorsStore.updateMessagePrivacyFromSources(newMessage.id, newMessage);
  }

  // TTS: Only trigger if last message was sent via speech
  if (newMessage &&
      newMessage.role === 'assistant' &&
      newMessage.content &&
      newMessage.content.trim().length > 0 &&
      !newMessage.metadata?.isPlaceholder) {

    // Check if the last message was sent via speech
    if (chatUiStore.lastMessageWasSpeech) {
      console.log('🎤 [TTS] Assistant message detected, checking length...');

      if (isResponseTooLong(newMessage.content)) {
        console.log('🎤 [TTS] Response is lengthy, using fallback message');
        handleTextToSpeech(LENGTHY_RESPONSE_FALLBACK);
      } else {
        console.log('🎤 [TTS] Response is short, using full content');
        handleTextToSpeech(newMessage.content);
      }
    } else {
      console.log('🎤 [TTS] Skipping TTS - last message was not via speech');
    }
  }
}, { immediate: false, deep: true });

watch(() => backendDeliverable.value, (newVal, oldVal) => {
  console.log('👀 [AgentTaskItem.backendDeliverable watcher] Triggered - newVal:', newVal?.id, 'oldVal:', oldVal?.id);

  if (newVal !== oldVal) {
    console.log('🔄 [AgentTaskItem.backendDeliverable watcher] Values changed');

    // Emit deliverable-created event when a new deliverable is detected
    if (newVal && !oldVal) {
      console.log('✨ [AgentTaskItem.backendDeliverable watcher] NEW deliverable detected, emitting deliverable-created:', newVal.id);
      emit('deliverable-created', newVal);
    } else if (newVal && oldVal && newVal.id !== oldVal.id) {
      // Different deliverable
      console.log('🔄 [AgentTaskItem.backendDeliverable watcher] DIFFERENT deliverable detected, emitting deliverable-created:', newVal.id);
      emit('deliverable-created', newVal);
    } else if (newVal && oldVal) {
      console.log('📝 [AgentTaskItem.backendDeliverable watcher] Same deliverable, no emit');
    }
  } else {
    console.log('➡️ [AgentTaskItem.backendDeliverable watcher] No change');
  }
}, { immediate: true });

// Watch for deliverable ID being added to message metadata (from task completion)
watch(() => backendDeliverableId.value, (_newId, _oldId) => {
  if (_newId && !_oldId) {

    // The backendDeliverable watcher will handle the emission when the deliverable loads
  }
}, { immediate: true });

// Debug: Watch message metadata changes
watch(() => props.message.metadata, (_newMetadata, _oldMetadata) => {

}, { deep: true, immediate: true });

// Debug: Watch message deliverableId changes  
watch(() => props.message.deliverableId, (_newId, _oldId) => {

}, { immediate: true });

// Fallback message for lengthy responses
const LENGTHY_RESPONSE_FALLBACK = "I successfully completed your request, but the response is quite lengthy. Please check the chat for the full details.";

/**
 * Check if a response is too long for TTS
 * Uses both character count and sentence count as criteria
 */
function isResponseTooLong(text: string): boolean {
  // Character threshold (~500 chars)
  if (text.length > 500) return true;
  
  // Sentence count (count periods/exclamation/question marks)
  const sentences = text.match(/[.!?]+/g) || [];
  if (sentences.length > 5) return true;
  
  return false;
}

// TTS function to handle text-to-speech conversion (simple working version)
async function handleTextToSpeech(text: string) {
  try {
    console.log('🎤 [TTS] Starting text-to-speech conversion...');
    
    // Synthesize the response text to speech
    const synthesizedAudio = await apiService.synthesizeText(
      text,
      'EXAVITQu4vr4xnSDxMaL', // Default voice ID
      0.5 // Speaking rate/stability
    );

    console.log('🎤 [TTS] Audio synthesis completed, starting playback...');
    
    // Play the response audio
    await playAudio(synthesizedAudio.audioData);
    
    console.log('🎤 [TTS] Audio playback finished successfully');
    
  } catch (error) {
    console.error('🎤 [TTS] Failed to convert text to speech:', error);
    
    // Show error toast
    const toast = await toastController.create({
      message: 'Voice synthesis failed',
      duration: 3000,
      color: 'warning',
      position: 'bottom'
    });
    await toast.present();
  } finally {
    // Always clear the speech flag when TTS completes (success or error)
    chatUiStore.setLastMessageWasSpeech(false);
    console.log('🎤 [TTS] Cleared speech flag after TTS completion');
  }
}

// Play audio function with proper format handling
async function playAudio(audioData: string) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio();
    
    // Set up event handlers
    audio.onended = () => {
      console.log('🎤 [TTS] Audio playback ended naturally');
      
      // Auto-start listening for user response by clicking the speech button
      try {
        const speechButton = document.querySelector('.conversation-button');
        if (speechButton) {
          console.log('🎤 [AUTO-LISTEN] Auto-clicking speech button after TTS');
          speechButton.click();
        } else {
          console.log('🎤 [AUTO-LISTEN] Speech button not found');
        }
      } catch (error) {
        console.error('🎤 [AUTO-LISTEN] Failed to auto-click speech button:', error);
      }
      
      resolve();
    };
    
    audio.onerror = (error) => {
      console.error('🎤 [TTS] Audio playback error:', error);
      reject(new Error('Audio playback failed'));
    };
    
    // Handle different audio data formats
    if (audioData.startsWith('data:')) {
      // Already a data URL
      audio.src = audioData;
    } else {
      // Assume base64 and add proper data URL prefix
      audio.src = `data:audio/mpeg;base64,${audioData}`;
    }
    
    console.log('🎤 [TTS DEBUG] Audio src format:', audio.src.substring(0, 50) + '...');
    audio.play().catch(reject);
  });
}

function openImage(img: DeliverableImageAttachment) {
  if (!img.url) {
    return;
  }
  window.open(img.url, '_blank');
}
</script>

<style scoped>
.agent-task-item {
  margin-bottom: 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.task-message {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: calc(100% - 32px);
  margin: 16px 16px;
  padding: 0;
}

.task-role--user .task-message {
  justify-content: flex-end;
  flex-direction: row-reverse;
}

.task-role--assistant .task-message {
  justify-content: flex-start;
}

.task-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar {
  background-color: var(--ion-color-primary-tint);
}

.agent-avatar {
  background-color: var(--ion-color-medium-tint);
}

.task-avatar ion-icon {
  font-size: 20px;
}

.user-avatar ion-icon {
  color: var(--ion-color-primary-contrast);
}

.agent-avatar ion-icon {
  color: var(--ion-color-medium-contrast);
}

.task-content {
  flex: 1;
  background: var(--ion-color-light-shade);
  padding: 12px 16px;
  border-radius: 16px;
  word-wrap: break-word;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.task-role--user .task-content {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-bottom-right-radius: 4px;
}

.task-role--assistant .task-content {
  background: var(--ion-color-light-shade);
  border-bottom-left-radius: 4px;
}

.task-agent-name {
  font-size: 0.8em;
  font-weight: bold;
  margin-bottom: 4px;
  color: var(--ion-color-medium-shade);
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-role--user .task-agent-name {
  display: none;
}

.task-text {
  font-size: 1em;
  line-height: 1.4;
  margin-bottom: 8px;
}

.thinking-section {
  margin-top: 12px;
  border-top: 1px solid var(--ion-color-step-150);
  padding-top: 8px;
}

.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 4px 0;
  cursor: pointer;
  font-size: 0.9em;
  color: var(--ion-color-medium);
  transition: color 0.2s ease;
}

.thinking-toggle:hover {
  color: var(--ion-color-primary);
}

.thinking-label {
  font-weight: 500;
}

.thinking-content {
  margin-top: 8px;
  padding: 12px;
  background: var(--ion-color-step-50);
  border-left: 3px solid var(--ion-color-medium);
  border-radius: 4px;
  font-size: 0.9em;
  color: var(--ion-color-medium-shade);
  white-space: pre-wrap;
  font-family: var(--ion-font-family);
  line-height: 1.5;
}

.task-text :deep(p) {
  margin-top: 0;
  margin-bottom: 0.5em;
}

.task-text :deep(p:last-child) {
  margin-bottom: 0;
}

.task-text :deep(ul),
.task-text :deep(ol) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding-left: 20px;
}

.task-text :deep(li) {
  margin-bottom: 0.25em;
}

.task-text :deep(pre) {
  background-color: rgba(0,0,0,0.05);
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.task-text :deep(code) {
  font-family: monospace;
  background-color: rgba(0,0,0,0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.task-text :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.rendered-content {
  /* Ensure content is properly contained */
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.fallback-content {
  /* Style for fallback plain text content */
  white-space: pre-wrap;
  font-family: inherit;
}

.task-timestamp {
  font-size: 0.75em;
  opacity: 0.7;
  text-align: right;
  margin-top: 4px;
}

.task-role--user .task-timestamp {
  color: var(--ion-color-primary-contrast);
}

.task-evaluation {
  margin-top: 8px;
  margin-left: 44px; /* Align with agent message content */
}

.task-role--user .task-evaluation {
  display: none;
}

.metadata-button {
  --padding-start: 4px;
  --padding-end: 4px;
  --color: var(--ion-color-medium);
  margin-left: auto;
}

.metadata-button:hover {
  --color: var(--ion-color-primary);
}

.image-gallery {
  margin-bottom: 8px;
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.thumb {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
}

.approval-status {
  margin: 6px 0 0 0;
}
.legend {
  padding: 12px;
  min-width: 220px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.legend-row .pending { color: var(--ion-color-warning); }
.legend-row .approved { color: var(--ion-color-success); }
.legend-row .rejected { color: var(--ion-color-danger); }

/* Deliverable Creation Callout */
.deliverable-creation-callout {
  padding: 16px;
  margin: 8px 0;
  background: linear-gradient(135deg, #f8f4ff 0%, #f0e7ff 100%);
  border: 1px solid #e0d4ed;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(139, 69, 197, 0.1);
  transition: all 0.3s ease;
}

.deliverable-creation-callout.clickable {
  cursor: pointer;
}

.deliverable-creation-callout:hover {
  box-shadow: 0 4px 16px rgba(139, 69, 197, 0.15);
  transform: translateY(-1px);
}

.callout-content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.callout-icon {
  font-size: 24px;
  color: #8b45c5;
  flex-shrink: 0;
}

.callout-text {
  flex: 1;
}

.callout-title {
  font-weight: 600;
  color: #5b21b6;
  font-size: 0.95em;
  margin-bottom: 2px;
}

.callout-description {
  font-size: 0.85em;
  color: #7c3aed;
  opacity: 0.8;
}

.callout-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chip-provider, .chip-model, .chip-divider {
  font-size: 12px;
}

.callout-indicator {
  flex-shrink: 0;
}

.callout-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(139, 69, 197, 0.15);
}

.callout-action ion-button {
  --color: #8b45c5;
  --color-hover: #7c3aed;
  font-size: 0.85em;
}


/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .task-content {
    background: #2a2a2a;
    color: #e8e8e8;
    border: 1px solid #404040;
  }
  
  .task-role--assistant .task-content {
    background: #2a2a2a;
    color: #e8e8e8;
    border: 1px solid #404040;
  }
  
  .task-role--user .task-content {
    background: #1a365d;
    color: #e2e8f0;
    border: 1px solid #2d5a87;
  }
  
  .task-agent-name {
    color: #a0aec0;
  }
  
  .task-text {
    color: #e8e8e8;
  }
  
  .task-text :deep(h1),
  .task-text :deep(h2),
  .task-text :deep(h3),
  .task-text :deep(h4),
  .task-text :deep(h5),
  .task-text :deep(h6) {
    color: #f7fafc;
  }
  
  .task-text :deep(strong),
  .task-text :deep(b) {
    color: #f7fafc;
  }
  
  .task-text :deep(pre) {
    background-color: #1a202c;
    color: #e2e8f0;
    border: 1px solid #4a5568;
  }
  
  .task-text :deep(code) {
    background-color: #1a202c;
    color: #68d391;
    border: 1px solid #4a5568;
  }
  
  .task-text :deep(pre code) {
    background-color: transparent;
    border: none;
    color: #e2e8f0;
  }
  
  .task-text :deep(blockquote) {
    border-left: 4px solid #4a5568;
    background-color: rgba(255, 255, 255, 0.02);
    color: #cbd5e0;
  }
  
  .task-text :deep(a) {
    color: #63b3ed;
  }
  
  .task-text :deep(a):hover {
    color: #90cdf4;
  }
  
  .task-timestamp {
    color: #a0aec0;
  }
  
  .task-role--user .task-timestamp {
    color: #e2e8f0;
  }
  
  /* Dark mode callout */
  .deliverable-creation-callout {
    background: linear-gradient(135deg, #2a1f3a 0%, #2d1b40 100%);
    border-color: #4a3b5c;
    box-shadow: 0 2px 8px rgba(139, 69, 197, 0.2);
  }
  
  .deliverable-creation-callout:hover {
    box-shadow: 0 4px 16px rgba(139, 69, 197, 0.3);
  }
  
  .callout-icon {
    color: #a78bfa;
  }
  
  .callout-title {
    color: #c4b5fd;
  }
  
  .callout-description {
    color: #a78bfa;
  }
  
  .callout-action {
    border-top-color: rgba(167, 139, 250, 0.2);
  }
  
  .callout-action ion-button {
    --color: #a78bfa;
    --color-hover: #c4b5fd;
  }
}

/* Manual dark theme toggle support */
html[data-theme="dark"] .task-content {
  background: #2a2a2a;
  color: #e8e8e8;
  border: 1px solid #404040;
}

html[data-theme="dark"] .task-role--assistant .task-content {
  background: #2a2a2a;
  color: #e8e8e8;
  border: 1px solid #404040;
}

html[data-theme="dark"] .task-role--user .task-content {
  background: #1a365d;
  color: #e2e8f0;
  border: 1px solid #2d5a87;
}

html[data-theme="dark"] .task-agent-name {
  color: #a0aec0;
}

html[data-theme="dark"] .task-text {
  color: #e8e8e8;
}

html[data-theme="dark"] .task-text :deep(h1),
html[data-theme="dark"] .task-text :deep(h2),
html[data-theme="dark"] .task-text :deep(h3),
html[data-theme="dark"] .task-text :deep(h4),
html[data-theme="dark"] .task-text :deep(h5),
html[data-theme="dark"] .task-text :deep(h6) {
  color: #f7fafc;
}

html[data-theme="dark"] .task-text :deep(strong),
html[data-theme="dark"] .task-text :deep(b) {
  color: #f7fafc;
}

html[data-theme="dark"] .task-text :deep(pre) {
  background-color: #1a202c;
  color: #e2e8f0;
  border: 1px solid #4a5568;
}

html[data-theme="dark"] .task-text :deep(code) {
  background-color: #1a202c;
  color: #68d391;
  border: 1px solid #4a5568;
}

html[data-theme="dark"] .task-text :deep(pre code) {
  background-color: transparent;
  border: none;
  color: #e2e8f0;
}

html[data-theme="dark"] .task-text :deep(blockquote) {
  border-left: 4px solid #4a5568;
  background-color: rgba(255, 255, 255, 0.02);
  color: #cbd5e0;
}

html[data-theme="dark"] .task-text :deep(a) {
  color: #63b3ed;
}

html[data-theme="dark"] .task-text :deep(a):hover {
  color: #90cdf4;
}

html[data-theme="dark"] .task-timestamp {
  color: #a0aec0;
}

html[data-theme="dark"] .task-role--user .task-timestamp {
  color: #e2e8f0;
}

/* Manual dark theme callout */
html[data-theme="dark"] .deliverable-creation-callout {
  background: linear-gradient(135deg, #2a1f3a 0%, #2d1b40 100%);
  border-color: #4a3b5c;
  box-shadow: 0 2px 8px rgba(139, 69, 197, 0.2);
}

html[data-theme="dark"] .deliverable-creation-callout:hover {
  box-shadow: 0 4px 16px rgba(139, 69, 197, 0.3);
}

html[data-theme="dark"] .callout-icon {
  color: #a78bfa;
}

html[data-theme="dark"] .callout-title {
  color: #c4b5fd;
}

html[data-theme="dark"] .callout-description {
  color: #a78bfa;
}

html[data-theme="dark"] .callout-action {
  border-top-color: rgba(167, 139, 250, 0.2);
}

html[data-theme="dark"] .callout-action ion-button {
  --color: #a78bfa;
  --color-hover: #c4b5fd;
}

/* Workflow Progress Styles */
.workflow-progress-container {
  margin: 12px 0;
  padding: 16px;
  background: var(--ion-color-light-tint);
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.workflow-header h5 {
  margin: 0;
  font-size: 1em;
  font-weight: 600;
  color: var(--ion-color-dark);
}

.workflow-overall-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.progress-bar {
  width: 60px;
  height: 6px;
  background: var(--ion-color-light-shade);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--ion-color-success);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8em;
  color: var(--ion-color-medium);
  white-space: nowrap;
}

.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: var(--ion-color-light);
  border-left: 3px solid var(--ion-color-medium);
  font-size: 0.9em;
}

.workflow-step.step-pending {
  border-left-color: var(--ion-color-medium);
}

.workflow-step.step-in-progress {
  border-left-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: white;
}

.workflow-step.step-in-progress .step-title,
.workflow-step.step-in-progress .step-message {
  color: white;
}

.workflow-step.step-completed {
  border-left-color: var(--ion-color-success);
}

.workflow-step.step-failed {
  border-left-color: var(--ion-color-danger);
  background: var(--ion-color-danger-tint);
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 32px;
}

.step-number {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--ion-color-medium);
  background: var(--ion-color-light-shade);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-status-icon {
  font-size: 1em;
}

.step-status-icon .icon-completed {
  color: var(--ion-color-success);
}

.step-status-icon .icon-in-progress {
  color: var(--ion-color-primary);
}

.step-status-icon .icon-failed {
  color: var(--ion-color-danger);
}

.step-status-icon .icon-pending {
  color: var(--ion-color-medium);
}

.step-content {
  flex: 1;
}

.step-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 2px;
  font-size: 0.9em;
}

.step-message {
  font-size: 0.8em;
  color: var(--ion-color-medium-shade);
  opacity: 0.8;
}

/* Smart CTA Bar */
.smart-cta-bar {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  margin-left: 44px; /* Align with agent message content */
  padding: 4px 0;
}

.smart-cta-bar ion-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.smart-cta-bar ion-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
