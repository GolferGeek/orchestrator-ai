<template>
  <div class="agent-task-item" :class="[`task-role--${message.role}`]">
    <div class="task-message">
      <!-- User avatar for user messages -->
      <ion-avatar v-if="message.role === 'user'" slot="start" class="task-avatar user-avatar">
        <ion-icon :icon="personCircleOutline" size="small"></ion-icon>
      </ion-avatar>
      
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
        <div class="task-text" v-if="message.content">
          <!-- Render markdown for assistant messages -->
          <div v-if="message.role === 'assistant'" class="rendered-content">
            <div v-if="renderedContent" v-html="renderedContent"></div>
            <div v-else class="fallback-content">{{ message.content }}</div>
          </div>
          <!-- Plain text for user messages -->
          <div v-else>{{ message.content }}</div>
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
      
      <!-- Agent avatar for assistant messages -->
      <ion-avatar v-if="message.role === 'assistant'" slot="end" class="task-avatar agent-avatar">
        <ion-icon :icon="cogOutline" size="small"></ion-icon>
      </ion-avatar>
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
import { computed, ref } from 'vue';
import { marked } from 'marked';
import { IonAvatar, IonIcon, IonButton } from '@ionic/vue';
import { personCircleOutline, cogOutline, informationCircleOutline } from 'ionicons/icons';
import TaskRating from './TaskRating.vue';
import TaskMetadataModal from './TaskMetadataModal.vue';
import LLMInfo from './LLMInfo.vue';

export interface AgentTaskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  taskId?: string;
  metadata?: Record<string, any>;
}

const props = defineProps<{
  message: AgentTaskMessage;
  agentName?: string;
}>();

// Reactive state
const showMetadataModal = ref(false);

// Computed properties
const renderedContent = computed(() => {
  if (!props.message.content || props.message.role !== 'assistant') {
    return '';
  }
  
  try {
    // Debug: Log the original content
    console.log('🎭 Processing message content for rendering:', {
      messageId: props.message.id,
      contentLength: props.message.content.length,
      contentPreview: props.message.content.substring(0, 100),
      hasTaskId: !!props.message.taskId
    });
    
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
    
    // Debug: Log the parsed HTML
    console.log('🎭 Parsed HTML:', {
      messageId: props.message.id,
      htmlLength: html.length,
      htmlPreview: html.substring(0, 200)
    });
    
    // Basic validation to ensure it's valid HTML
    if (typeof html !== 'string' || html.trim() === '') {
      console.warn('🎭 Markdown parsing returned empty or invalid content');
      return null; // This will trigger the fallback
    }
    
    // Check for problematic patterns that might cause DOM issues
    if (html.includes('<html') || html.includes('<body') || html.includes('<head')) {
      console.warn('🎭 Markdown content contains document-level HTML tags, using fallback');
      return null; // This will trigger the fallback
    }
    
    return html;
  } catch (error) {
    console.error('🎭 Error parsing markdown content:', error);
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

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .task-content {
    background: var(--ion-color-dark-shade);
  }
  
  .task-role--assistant .task-content {
    background: var(--ion-color-dark-shade);
  }
  
  .task-text :deep(pre) {
    background-color: rgba(255,255,255,0.05);
  }
  
  .task-text :deep(code) {
    background-color: rgba(255,255,255,0.05);
  }
}
</style>