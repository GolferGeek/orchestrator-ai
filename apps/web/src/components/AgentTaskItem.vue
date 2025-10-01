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
        

        <!-- Task text content -->
        <div class="task-text" v-if="message.content && !willHideForDeliverable">
          <!-- Debug comment -->
          <!-- DEBUG: showing content, willHideForDeliverable = {{ willHideForDeliverable }} -->
          <!-- Render markdown for assistant messages -->
          <div v-if="message.role === 'assistant'" class="rendered-content">
            <div v-if="renderedContent" v-html="renderedContent"></div>
            <div v-else class="fallback-content">{{ message.content }}</div>
          </div>
          <!-- Plain text for user messages -->
          <div v-else>{{ message.content }}</div>
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
              v-for="(step, index) in displayedWorkflowSteps" 
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
        
        <!-- Debug info removed - deliverables should now work properly -->
        
        <!-- Deliverable Creation Callout (shown instead of message content for deliverable messages) -->
        <!-- SHOWING CALLOUT: willHideForDeliverable = {{ willHideForDeliverable }}, hasDeliverableId = {{ hasBackendDeliverable }}, messageId = {{ message.id }} -->
        <div v-if="willHideForDeliverable" class="deliverable-creation-callout" :class="{ 'clickable': displayedDeliverable }" @click="handleCalloutClick">
          <div class="callout-content">
            <ion-icon :icon="documentTextOutline" class="callout-icon" />
            <div class="callout-text">
              <div class="callout-title">
                {{ displayedDeliverable ? 'Deliverable Created' : 'Creating deliverable...' }}
              </div>
              <div class="callout-description">
                {{ displayedDeliverable ? displayedDeliverable.title : 'Processing your request into a structured document' }}
              </div>
            </div>
            <div class="callout-indicator" v-if="!displayedDeliverable">
              <ion-spinner name="dots" color="primary" />
            </div>
            <ion-chip v-else size="small" color="primary" outline>
              {{ displayedDeliverable.type || 'document' }}
            </ion-chip>
          </div>
          <div class="callout-action" v-if="displayedDeliverable && !props.showWorkProductPane">
            <ion-button fill="clear" size="small">
              <ion-icon :icon="arrowForwardOutline" slot="end" />
              View in Document Pane
            </ion-button>
          </div>
          <div class="callout-action" v-else-if="displayedDeliverable && props.showWorkProductPane">
            <ion-chip size="small" color="success" fill="outline">
              <ion-icon :icon="documentTextOutline" />
              Showing in Document Pane
            </ion-chip>
          </div>
        </div>
        
        <!-- Privacy Indicators for assistant messages only -->
        <UserPrivacyIndicators
          v-if="message.role === 'assistant' && showPrivacyIndicators"
          :showDataProtection="false"
          :isDataProtected="false"
          :showSanitizationStatus="privacySettings.showSanitizationStatus"
          :sanitizationStatus="sanitizationStatus"
          :flaggedCount="flaggedItemsCount"
          :pseudonymizedCount="pseudonymizedItemsCount"
          :showRoutingDisplay="privacySettings.showRoutingDisplay"
          :routingMode="currentRoutingMode"
          :showTrustSignal="privacySettings.showTrustSignal"
          :trustLevel="currentTrustLevel"
          :trustScore="currentTrustScore"
          :showPiiCount="privacySettings.showPiiCount"
          :showProcessingTime="false"
          :processingTimeMs="0"
          :compact="privacySettings.compactMode"
        />
        
        <!-- Task timestamp -->
        <div class="task-timestamp">{{ formattedTimestamp }}</div>
        
        <!-- LLM Information for assistant messages -->
        <LLMInfo
          v-if="message.role === 'assistant' && llmUsed && ((message.metadata?.mode || '').toLowerCase() !== 'converse') && ((message.metadata?.mode || '').toLowerCase() !== 'plan')"
          :llmUsed="llmUsed"
          :usage="usage || undefined"
          :costCalculation="costCalculation || undefined"
        />
      </div>
      
      <!-- Agent avatar removed for more space -->
  </div>
    
    <!-- Smart CTAs: Plan / Build (assistant messages only, no deliverable shown) -->
    <div v-if="message.role === 'assistant' && !willHideForDeliverable && (suggestsPlan || suggestsBuild)" class="smart-cta-bar">
      <ion-chip v-if="suggestsPlan" color="primary" outline @click="handlePlanNow">
        Plan It
      </ion-chip>
      <ion-chip v-if="suggestsBuild" color="success" outline @click="handleBuildNow">
        Build It
      </ion-chip>
    </div>

    <!-- Task evaluation interface for assistant messages -->
    <div v-if="message.role === 'assistant' && message.taskId && 
                message.taskId !== 'pending' && 
                !message.taskId.startsWith('workflow-') && 
                !message.metadata?.isPlaceholder" class="task-evaluation">
      <TaskRating
        :taskId="message.taskId"
        :agentName="agentName"
        :messageRole="message.role"
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
import { computed, ref, watch } from 'vue';
import { marked } from 'marked';
import { IonIcon, IonButton, IonSpinner, IonChip } from '@ionic/vue';
import { 
  informationCircleOutline, 
  documentTextOutline, 
  arrowForwardOutline,
  checkmarkCircleOutline,
  playCircleOutline,
  closeCircleOutline,
  ellipseOutline
} from 'ionicons/icons';
import TaskRating from './TaskRating.vue';
import TaskMetadataModal from './TaskMetadataModal.vue';
import LLMInfo from './LLMInfo.vue';
import UserPrivacyIndicators from './UserPrivacyIndicators.vue';
import { useDeliverablesStore } from '@/stores/deliverablesStore';
import { usePrivacyIndicatorsStore } from '@/stores/privacyIndicatorsStore';
import { useLLMStore } from '@/stores/llmStore';
import { useAgentChatStore } from '@/stores/agentChatStore';
import analyticsService from '@/services/analyticsService';
import { apiService } from '@/services/apiService';
import { toastController } from '@ionic/vue';

export interface AgentTaskMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
  deliverableId?: string;
}

const props = defineProps<{
  message: AgentTaskMessage;
  agentName?: string;
  conversationId?: string;
  agent?: any;
  showWorkProductPane?: boolean;
}>();

const emit = defineEmits<{
  'deliverable-created': [deliverable: any];
  'deliverable-updated': [deliverable: any];
  'deliverable-selected': [deliverable: any];
}>();

// Stores
const deliverablesStore = useDeliverablesStore();
const privacyIndicatorsStore = usePrivacyIndicatorsStore();
const llmStore = useLLMStore();
const chatStore = useAgentChatStore();

// Reactive state
const showMetadataModal = ref(false);
// Removed: Frontend deliverable creation logic (handled on backend)

// Computed properties
const hasBackendDeliverable = computed(() => {
  return !!(props.message.deliverableId || 
           props.message.metadata?.deliverableId);
});

const backendDeliverableId = computed(() => {
  return props.message.deliverableId ||
         props.message.metadata?.deliverableId;
});

const backendDeliverable = computed(() => {
  const deliverableId = backendDeliverableId.value;
  if (!deliverableId) return null;
  
  // Get deliverable from store - this will be reactive to store changes
  const deliverable = deliverablesStore.getDeliverableById(deliverableId);
  
  // Force reactivity by accessing conversation deliverables
  if (props.conversationId) {
    const conversationDeliverables = deliverablesStore.getDeliverablesByConversation(props.conversationId);
    // This ensures the computed updates when conversation deliverables are loaded
    
    // Also force reactivity on the deliverables store state
    const storeState = deliverablesStore.$state;
    // This line ensures we're reactive to any changes in the deliverables store
  }
  
  
  return deliverable;
});

const displayedDeliverable = computed(() => {
  return backendDeliverable.value;
});

const willHideForDeliverable = computed(() => {
  // Only hide content for Build mode. In Converse/Plan we always show text.
  const hasDeliverableId = hasBackendDeliverable.value;
  const isAssistantMessage = props.message.role === 'assistant';
  const mode = (props.message.metadata?.mode || '').toLowerCase();

  return hasDeliverableId && isAssistantMessage && mode === 'build';
});

const renderedContent = computed(() => {
  if (!props.message.content || props.message.role !== 'assistant') {
    return '';
  }
  
  try {
    // Parse markdown to HTML - use synchronous parsing
    let html: string;
    try {
      // Force synchronous parsing by using marked with older API style
      html = marked(props.message.content, { 
        breaks: true, 
        gfm: true
      }) as string;
    } catch (error) {

      html = `<p>${props.message.content}</p>`;
    }
    
    // Basic validation to ensure it's valid HTML
    if (typeof html !== 'string' || html.trim() === '') {

      return null; // This will trigger the fallback
    }
    
    // Check for problematic patterns that might cause DOM issues
    if (html.includes('<html') || html.includes('<body') || html.includes('<head')) {

      return null; // This will trigger the fallback
    }
    
    return html;
  } catch (error) {
console.error('Error parsing markdown content:', error);
    return null; // This will trigger the fallback
  }
});

const formattedTimestamp = computed(() => {
  return props.message.timestamp.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
});

// Enhancement undo CTA bindings
const enhancedDeliverableId = computed(() => props.message.metadata?.enhancedDeliverableId || null);
const enhancedFromVersionId = computed(() => props.message.metadata?.enhancedFromVersionId || null);
const showUndoEnhancement = computed(() => {
  const dId = enhancedDeliverableId.value;
  const prevId = enhancedFromVersionId.value;
  if (!dId || !prevId) return false;
  const current = deliverablesStore.getCurrentVersion(dId);
  if (current?.id === prevId) return false; // gate: previous already current
  return true;
});
const undoEnhancement = async () => {
  try {
    if (!enhancedFromVersionId.value) return;
    await deliverablesStore.setCurrentVersion(enhancedFromVersionId.value);
  } catch (e) {
    console.warn('Failed to undo enhancement', e);
  }
};
const emitSelectDeliverable = () => {
  const id = enhancedDeliverableId.value;
  if (!id) return;
  const d = deliverablesStore.getDeliverableById(id);
  if (d) emit('deliverable-selected', d);
};

// LLM Information computed properties
        const llmUsed = computed(() => {
          const metadata = props.message.metadata;
          
          // Debug: Log the full message structure to see what we're getting
          console.log('🔍 AgentTaskItem - Full message object:', props.message);
          console.log('🔍 AgentTaskItem - Message metadata:', metadata);
          
          // Check both possible locations for LLM metadata
          const llmMeta = metadata?.llmMetadata || metadata?.llmUsed;
          console.log('🔍 AgentTaskItem - Extracted llmMeta:', llmMeta);
          
          if (!llmMeta) {
            console.log('❌ AgentTaskItem - No LLM metadata found in message');
            return null;
          }
          
          // Debug: Log the actual LLM metadata structure
          console.log('✅ AgentTaskItem - LLM Metadata received:', llmMeta);
          console.log('✅ AgentTaskItem - Full message metadata:', metadata);
  
          // Handle different possible field structures from backend
          // Check if data is in originalLLMSelection structure (new format)
          const llmSelection = llmMeta.originalLLMSelection || llmMeta;
          
          const providerName = llmSelection.providerName || 
                              llmSelection.provider || 
                              llmMeta.provider_name ||
                              'Unknown Provider';
                              
          const modelName = llmSelection.modelName || 
                           llmSelection.model || 
                           llmMeta.model_name ||
                           'Unknown Model';
          
          const result = {
            providerName,
            modelName,
            temperature: llmSelection.temperature || llmMeta.temperature,
            maxTokens: llmSelection.maxTokens || llmSelection.max_tokens || llmMeta.maxTokens || llmMeta.max_tokens,
            responseTimeMs: llmMeta.responseTimeMs || llmMeta.response_time_ms || llmMeta.duration
          };
  
  console.log('Processed LLM info:', result);
  return result;
});

const usage = computed(() => {
  const metadata = props.message.metadata;
  if (!metadata?.usage) return null;
  
  return {
    inputTokens: metadata.usage.inputTokens || 0,
    outputTokens: metadata.usage.outputTokens || 0,
    totalCost: metadata.usage.totalCost || 0,
    responseTimeMs: metadata.usage.responseTimeMs || 0
  };
});

const costCalculation = computed(() => {
  const metadata = props.message.metadata;
  if (!metadata?.costCalculation) return null;
  
  return {
    inputTokens: metadata.costCalculation.inputTokens || 0,
    outputTokens: metadata.costCalculation.outputTokens || 0,
    inputCost: metadata.costCalculation.inputCost || 0,
    outputCost: metadata.costCalculation.outputCost || 0,
    totalCost: metadata.costCalculation.totalCost || 0,
    currency: metadata.costCalculation.currency || 'USD'
  };
});

// Workflow progress computed properties
const workflowSteps = computed(() => {
  const metadata = props.message.metadata;
  // Get workflow steps from either completedSteps or workflow_steps_realtime
  const completedSteps = metadata?.completedSteps || [];
  const realtimeSteps = metadata?.workflow_steps_realtime || [];
  

  
  // Merge and deduplicate steps, preferring realtime data
  const stepMap = new Map();
  
  // Add completed steps first
  completedSteps.forEach((step: any) => {
    stepMap.set(step.index, {
      stepName: step.name,
      stepIndex: step.index,
      totalSteps: step.total,
      status: 'completed',
      message: step.message,
      timestamp: new Date()
    });
  });
  
  // Add/update with realtime steps
  realtimeSteps.forEach((step: any) => {
    stepMap.set(step.stepIndex, {
      stepName: step.stepName,
      stepIndex: step.stepIndex,
      totalSteps: step.totalSteps,
      status: step.status,
      message: step.message,
      timestamp: new Date(step.timestamp)
    });
  });
  
  // Convert to array and sort by index
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

const currentPiiDetectionCount = computed(() => {
  const piiMetadata = props.message.metadata?.piiMetadata;
  if (piiMetadata?.detectionResults?.totalMatches) {
    return piiMetadata.detectionResults.totalMatches;
  }
  
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  if (sanitizationMetadata?.piiDetectionCount !== undefined) {
    return sanitizationMetadata.piiDetectionCount;
  }
  
  return 0;
});

const currentPiiSeverityTypes = computed(() => {
  // Extract PII types from message metadata
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  if (sanitizationMetadata?.piiTypes) {
    return sanitizationMetadata.piiTypes;
  }
  
  // Fallback to privacy state or empty array
  return privacyState.value?.piiTypes || [];
});

const currentPiiSeverityLevels = computed(() => {
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  if (sanitizationMetadata?.piiSeverityLevels) {
    return sanitizationMetadata.piiSeverityLevels;
  }

  const piiMetadata = props.message.metadata?.piiMetadata;
  if (piiMetadata?.detectionResults?.flaggedMatches) {
    const severities = piiMetadata.detectionResults.flaggedMatches.map(match => {
      // Convert 'info' severity from backend to 'flagger' for UI
      if (match.severity === 'info') return 'flagger';
      return match.severity;
    });
    return [...new Set(severities)];
  }

  return [];
});

// Methods

const handleCalloutClick = () => {
  if (displayedDeliverable.value) {
    emit('deliverable-selected', displayedDeliverable.value);
  }
};

// Smart CTA detection
const contentText = computed(() => (props.message.content || '').toLowerCase());
const suggestsPlan = computed(() => {
  if (!chatStore.isModeAllowed('plan')) {
    return false;
  }
  const c = contentText.value;
  return /would you like.*plan|should i.*plan|plan (it|this)|create (a|the) (plan|prd)|requirements|spec/i.test(props.message.content || '');
});
const suggestsBuild = computed(() => {
  if (!chatStore.isModeAllowed('build')) {
    return false;
  }
  const c = contentText.value;
  return /would you like.*build|should i.*build|build (it|this)|proceed to build|execute (now|this)/i.test(props.message.content || '');
});

function handlePlanNow() {
  if (!chatStore.isModeAllowed('plan')) {
    return;
  }
  chatStore.setChatMode('plan');
  chatStore.setPendingAction('plan', props.message.taskId || undefined);
  // Immediately execute from last user message
  chatStore.executeFromLastUserMessage('plan');
  analyticsService.trackEvent({
    eventType: 'ui',
    category: 'cta',
    action: 'plan_clicked',
    label: 'Plan It',
    properties: { taskId: props.message.taskId, conversationId: props.conversationId },
    context: { url: window.location.pathname, userAgent: navigator.userAgent },
  });
}
function handleBuildNow() {
  if (!chatStore.isModeAllowed('build')) {
    return;
  }
  chatStore.setChatMode('build');
  chatStore.setPendingAction('build', props.message.taskId || undefined);
  // Immediately execute from last user message
  chatStore.executeFromLastUserMessage('build');
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
const getWorkflowStepClass = (step: any) => {
  return {
    'step-pending': step.status === 'pending',
    'step-in-progress': step.status === 'in_progress',
    'step-completed': step.status === 'completed',
    'step-failed': step.status === 'failed'
  };
};

const getWorkflowStepIcon = (step: any) => {
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

const getWorkflowStepIconClass = (step: any) => {
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
    // Update privacy state from message metadata
    privacyIndicatorsStore.updateMessagePrivacyFromSources(newMessage.id, newMessage);
  }
  
  // TTS: Only trigger if last message was sent via speech
  if (newMessage && 
      newMessage.role === 'assistant' && 
      newMessage.content && 
      newMessage.content.trim().length > 0 &&
      !newMessage.metadata?.isPlaceholder) {
    
    // Check if the last message was sent via speech
    if (chatStore.lastMessageWasSpeech) {
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
  if (newVal !== oldVal) {

    
    // Emit deliverable-created event when a new deliverable is detected
    if (newVal && !oldVal) {

      emit('deliverable-created', newVal);
    } else if (newVal && oldVal && newVal.id !== oldVal.id) {
      // Different deliverable

      emit('deliverable-created', newVal);
    } else if (newVal && oldVal) {

    }
  }
}, { immediate: true });

// Watch for deliverable ID being added to message metadata (from task completion)
watch(() => backendDeliverableId.value, (newId, oldId) => {
  if (newId && !oldId) {

    // The backendDeliverable watcher will handle the emission when the deliverable loads
  }
}, { immediate: true });

// Debug: Watch message metadata changes
watch(() => props.message.metadata, (newMetadata, oldMetadata) => {

}, { deep: true, immediate: true });

// Debug: Watch message deliverableId changes  
watch(() => props.message.deliverableId, (newId, oldId) => {

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
    chatStore.setLastMessageWasSpeech(false);
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
</style>
