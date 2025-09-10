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
          :sanitizationStatus="currentSanitizationStatus"
          :piiDetectionCount="currentPiiDetectionCount"
          :piiSeverityTypes="currentPiiSeverityTypes"
          :piiSeverityLevels="currentPiiSeverityLevels"
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
          v-if="message.role === 'assistant' && llmUsed"
          :llmUsed="llmUsed"
          :usage="usage || undefined"
          :costCalculation="costCalculation || undefined"
        />
      </div>
      
      <!-- Agent avatar removed for more space -->
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

export interface AgentTaskMessage {
  id: string;
  role: 'user' | 'assistant';
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
  // Show deliverable callout instead of message content if this message has a deliverable
  const hasDeliverableId = hasBackendDeliverable.value;
  const isAssistantMessage = props.message.role === 'assistant';
  
  // Force reactivity by checking if the deliverable is loaded in the store
  const deliverableLoaded = !!backendDeliverable.value;
  
  // Simple rule: If an assistant message has a deliverableId, show the callout instead of content
  return hasDeliverableId && isAssistantMessage;
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

// LLM Information computed properties - supports both legacy and unified formats
const llmUsed = computed(() => {
  const metadata = props.message.metadata;
  
  // Check for unified response format first
  if (metadata?.llmResponse?.metadata?.provider) {
    const unified = metadata.llmResponse.metadata;
    return {
      providerName: unified.provider,
      modelName: unified.model,
      temperature: unified.config?.temperature,
      maxTokens: unified.config?.maxTokens,
      responseTimeMs: unified.timing?.duration
    };
  }
  
  // Check for standardized error format
  if (metadata?.llmError?.technical?.provider) {
    const error = metadata.llmError.technical;
    return {
      providerName: error.provider,
      modelName: error.model,
      isError: true,
      errorCode: error.code,
      severity: error.severity,
      retryable: error.retryable
    };
  }
  
  // Legacy format fallback
  if (!metadata?.llmMetadata) return null;
  
  return {
    providerName: metadata.llmMetadata.provider || metadata.llmMetadata.providerName,
    modelName: metadata.llmMetadata.model || metadata.llmMetadata.modelName,
    temperature: metadata.llmMetadata.temperature,
    maxTokens: metadata.llmMetadata.maxTokens,
    responseTimeMs: metadata.llmMetadata.responseTimeMs
  };
});

const usage = computed(() => {
  const metadata = props.message.metadata;
  
  // Check for unified response format first
  if (metadata?.llmResponse?.metadata?.usage) {
    const unified = metadata.llmResponse.metadata;
    return {
      inputTokens: unified.usage.inputTokens || 0,
      outputTokens: unified.usage.outputTokens || 0,
      totalTokens: unified.usage.totalTokens || 0,
      totalCost: unified.usage.cost || 0,
      responseTimeMs: unified.timing?.duration || 0
    };
  }
  
  // Legacy format fallback
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
  // Only show for assistant messages with metadata
  return props.message.role === 'assistant' && 
         (props.message.metadata || privacyState.value);
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
const currentSanitizationStatus = computed(() => {
  // 🔍 DEBUG: Log what sanitization metadata we're receiving
  console.log('🔍 [FRONTEND-DEBUG] AgentTaskItem message metadata:', props.message.metadata);
  console.log('🔍 [FRONTEND-DEBUG] AgentTaskItem sanitization metadata:', props.message.metadata?.sanitizationMetadata);
  
  // First, check message metadata for sanitization data (preferred)
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  if (sanitizationMetadata?.status) {
    console.log('🔍 [FRONTEND-DEBUG] Found sanitization status in metadata:', sanitizationMetadata.status);
    return sanitizationMetadata.status;
  }
  
  // Fallback to privacy state if available (but skip 'processing')
  if (privacyState.value?.sanitizationStatus && privacyState.value.sanitizationStatus !== 'processing') {
    console.log('🔍 [FRONTEND-DEBUG] Using privacy state sanitization status:', privacyState.value.sanitizationStatus);
    return privacyState.value.sanitizationStatus;
  }
  
  // Default to 'none' if no sanitization data (no more processing badge)
  console.log('🔍 [FRONTEND-DEBUG] No sanitization metadata found, defaulting to none');
  return 'none';
});

const currentPiiDetectionCount = computed(() => {
  // 🔍 DEBUG: Log PII detection count data
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  console.log('🔍 [FRONTEND-DEBUG] PII detection count from sanitization metadata:', sanitizationMetadata?.piiDetectionCount);
  
  // First, check message metadata for PII count (preferred)
  if (sanitizationMetadata?.piiDetectionCount !== undefined) {
    console.log('🔍 [FRONTEND-DEBUG] Using PII count from metadata:', sanitizationMetadata.piiDetectionCount);
    return sanitizationMetadata.piiDetectionCount;
  }
  
  // Fallback to privacy state
  const fallbackCount = privacyState.value?.piiDetectionCount || 0;
  console.log('🔍 [FRONTEND-DEBUG] Using fallback PII count:', fallbackCount);
  return fallbackCount;
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
  // Extract PII severity levels from message metadata
  const sanitizationMetadata = props.message.metadata?.sanitizationMetadata;
  if (sanitizationMetadata?.piiSeverityLevels) {
    return sanitizationMetadata.piiSeverityLevels;
  }
  
  // If we don't have explicit severity levels, infer from types
  const types = currentPiiSeverityTypes.value;
  if (types.length === 0) return [];
  
  // Map types to severity levels based on our classification
  const severityMap: Record<string, string> = {
    'ssn': 'showstopper',
    'creditCard': 'showstopper',
    'email': 'pseudonymizer',
    'phone': 'pseudonymizer',
    'ipAddress': 'flagger',
    'name': 'pseudonymizer'
  };
  
  const severities = types.map(type => severityMap[type] || 'flagger');
  return [...new Set(severities)]; // Remove duplicates
});

// Methods

const handleCalloutClick = () => {
  if (displayedDeliverable.value) {
    emit('deliverable-selected', displayedDeliverable.value);
  }
};

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

// Initialize privacy state for this message
watch(() => props.message, (newMessage) => {
  if (newMessage && newMessage.role === 'assistant' && newMessage.metadata) {
    // Update privacy state from message metadata
    privacyIndicatorsStore.updateMessagePrivacyFromSources(newMessage.id, newMessage);
  }
}, { immediate: true, deep: true });

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