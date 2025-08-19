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
import { informationCircleOutline, documentTextOutline, arrowForwardOutline } from 'ionicons/icons';
import TaskRating from './TaskRating.vue';
import TaskMetadataModal from './TaskMetadataModal.vue';
import LLMInfo from './LLMInfo.vue';
import { useDeliverablesStore } from '@/stores/deliverablesStore';

export interface AgentTaskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
  deliverable_id?: string;
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

// Reactive state
const showMetadataModal = ref(false);
// Removed: Frontend deliverable creation logic (handled on backend)

// Computed properties
const hasBackendDeliverable = computed(() => {
  return !!(props.message.deliverable_id || props.message.deliverableId || 
           props.message.metadata?.deliverable_id || props.message.metadata?.deliverableId);
});

const backendDeliverableId = computed(() => {
  return props.message.deliverable_id || 
         props.message.deliverableId ||
         props.message.metadata?.deliverable_id || 
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
  
  // Simple rule: If an assistant message has a deliverable_id, show the callout instead of content
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
      console.warn('Failed to parse markdown, using plain text:', error);
      html = `<p>${props.message.content}</p>`;
    }
    
    // Basic validation to ensure it's valid HTML
    if (typeof html !== 'string' || html.trim() === '') {
      console.warn('Markdown parsing returned empty or invalid content');
      return null; // This will trigger the fallback
    }
    
    // Check for problematic patterns that might cause DOM issues
    if (html.includes('<html') || html.includes('<body') || html.includes('<head')) {
      console.warn('Markdown content contains document-level HTML tags, using fallback');
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

// LLM Information computed properties
const llmUsed = computed(() => {
  const metadata = props.message.metadata;
  if (!metadata?.llmMetadata) return null;
  
  return {
    providerId: metadata.llmMetadata.providerId,
    providerName: metadata.llmMetadata.provider || metadata.llmMetadata.providerName,
    modelId: metadata.llmMetadata.modelId,
    modelName: metadata.llmMetadata.model || metadata.llmMetadata.modelName,
    temperature: metadata.llmMetadata.temperature,
    maxTokens: metadata.llmMetadata.maxTokens,
    responseTimeMs: metadata.llmMetadata.responseTimeMs
  };
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

// Methods

const handleCalloutClick = () => {
  if (displayedDeliverable.value) {
    emit('deliverable-selected', displayedDeliverable.value);
  }
};

// Removed: Helper functions for deliverable detection and creation (handled on backend)

// Removed: createDeliverable function (deliverables are now created on backend)

// Removed: Watch for message completion (deliverables are created on backend)

// Removed: Watch for backend deliverable ID (deliverables are loaded during conversation opening)

// Watch for changes in deliverable availability to debug timing issues
watch(() => hasBackendDeliverable.value, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    console.log(`🎯 hasBackendDeliverable changed for message ${props.message.id}: ${oldVal} → ${newVal}`);
  }
}, { immediate: true });

watch(() => backendDeliverable.value, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    console.log(`🎯 backendDeliverable changed for message ${props.message.id}:`, {
      old: oldVal?.title,
      new: newVal?.title,
      deliverableId: backendDeliverableId.value
    });
  }
}, { immediate: true });

// Note: We only rely on backend-created deliverables that are already linked to messages
// No frontend deliverable creation or emission needed
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
</style>