<template>
  <div class="agent-message-item-wrapper" :class="[`message-sender--${senderType}`]">
    <div class="agent-message-item" :class="[`message-item--${senderType}`]">
      <ion-avatar v-if="senderType === 'agent'" slot="start" class="message-avatar agent-avatar">
        <ion-icon :icon="cogOutline" size="small"></ion-icon>
      </ion-avatar>
      <div class="message-bubble-wrapper">
        <div class="message-bubble">
          <!-- No agent name displayed for agent chat -->
          <div class="message-text" v-if="message.content" v-html="renderedText"></div>
          <div class="message-timestamp">{{ formattedTimestamp }}</div>
        </div>
        
        <!-- LLM Information Component (keep evaluation/metadata info) -->
        <LLMInfo
          v-if="message.role === 'assistant' && message.metadata"
          :llmUsed="message.metadata.llmOptions"
          :usage="message.metadata.usage"
          :costCalculation="message.metadata.costCalculation"
        />
        
        <!-- Agent Metadata Info (processing time, context usage, etc.) -->
        <div 
          v-if="message.role === 'assistant' && message.metadata && hasAgentMetadata"
          class="agent-metadata-info"
        >
          <div class="metadata-row" v-if="message.metadata.processedAt">
            <span class="metadata-label">Processed:</span>
            <span class="metadata-value">{{ formatProcessedTime(message.metadata.processedAt) }}</span>
          </div>
          <div class="metadata-row" v-if="message.metadata.contextUsed">
            <span class="metadata-label">Context:</span>
            <span class="metadata-value">{{ message.metadata.contextLength }} chars</span>
          </div>
          <div class="metadata-row" v-if="message.metadata.agentType">
            <span class="metadata-label">Agent Type:</span>
            <span class="metadata-value">{{ message.metadata.agentType }}</span>
          </div>
        </div>
        
        <!-- Message Rating Component -->
        <MessageRating
          v-if="message.role === 'assistant'"
          :message="message"
          :showRatingInput="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import { marked } from 'marked';
import { IonAvatar, IonIcon } from '@ionic/vue';
import { cogOutline } from 'ionicons/icons';
import MessageRating from './MessageRating.vue';
import LLMInfo from './LLMInfo.vue';
import type { AgentChatMessage } from '@/stores/agentChatStore';

const props = defineProps<{
  message: AgentChatMessage;
}>();

const senderType = computed(() => {
  return props.message.role === 'user' ? 'user' : 'agent';
});

const renderedText = computed(() => {
  if (!props.message.content) return '';
  
  // Ensure content is always a string
  const content = String(props.message.content);
  
  try {
    return marked.parse(content, { breaks: true, gfm: true });
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return content; // Fallback to raw text
  }
});

const formattedTimestamp = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(props.message.timestamp));
});

const hasAgentMetadata = computed(() => {
  return props.message.metadata && (
    props.message.metadata.processedAt ||
    props.message.metadata.contextUsed ||
    props.message.metadata.agentType
  );
});

const formatProcessedTime = (processedAt: string) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(processedAt));
};
</script>

<style scoped>
.agent-message-item-wrapper {
  margin: 16px 0;
  display: flex;
  flex-direction: column;
}

.message-sender--user {
  align-items: flex-end;
}

.message-sender--agent {
  align-items: flex-start;
}

.agent-message-item {
  display: flex;
  align-items: flex-start;
  max-width: 80%;
  gap: 8px;
}

.message-item--user {
  flex-direction: row-reverse;
}

.message-item--agent {
  flex-direction: row;
}

.message-avatar {
  width: 32px;
  height: 32px;
  --border-radius: 50%;
  flex-shrink: 0;
}

.agent-avatar {
  --background: var(--ion-color-primary);
  --color: white;
}

.message-bubble-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.message-bubble {
  background: var(--ion-color-light);
  border-radius: 16px;
  padding: 12px 16px;
  position: relative;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.message-item--user .message-bubble {
  background: var(--ion-color-primary);
  color: white;
}

.message-item--agent .message-bubble {
  background: var(--ion-color-light);
  color: var(--ion-color-dark);
}

.message-text {
  margin-bottom: 8px;
  line-height: 1.4;
}

.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  margin: 0.5em 0;
}

.message-text :deep(p) {
  margin: 0.5em 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.message-text :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 1em;
  border-left: 3px solid var(--ion-color-medium);
  background: var(--ion-color-light-shade);
  padding: 0.5em 1em;
}

.message-text :deep(code) {
  background: var(--ion-color-light-shade);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.message-text :deep(pre) {
  background: var(--ion-color-light-shade);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.message-timestamp {
  font-size: 0.75em;
  color: var(--ion-color-medium);
  text-align: right;
  margin-top: 4px;
}

.message-item--user .message-timestamp {
  color: rgba(255, 255, 255, 0.7);
}

.agent-metadata-info {
  background: var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 4px;
  font-size: 0.8em;
}

.metadata-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 2px 0;
}

.metadata-label {
  font-weight: 500;
  color: var(--ion-color-medium);
}

.metadata-value {
  color: var(--ion-color-dark);
}

/* Responsive design */
@media (max-width: 768px) {
  .agent-message-item {
    max-width: 90%;
  }
}
</style>