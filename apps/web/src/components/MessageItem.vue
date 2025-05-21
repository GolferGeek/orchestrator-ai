<template>
  <div class="message-item-wrapper" :class="[`message-sender--${senderType}`]">
    <!-- <div v-if="message.messageType === 'agentList'" class="agent-list-message-container"> 
      <AgentListDisplay :agents="message.data.agents" />
    </div> -->
    <div class="message-item" :class="[`message-item--${senderType}`]">
      <ion-avatar v-if="senderType === 'agent'" slot="start" class="message-avatar agent-avatar">
        <ion-icon :icon="cogOutline" size="small"></ion-icon>
      </ion-avatar>
      <div class="message-bubble-wrapper">
        <div class="message-bubble">
          <div v-if="senderType === 'agent' && agentName" class="message-agent-name">{{ agentName }}</div>
          <div v-else-if="senderType === 'system' && agentName" class="message-agent-name">{{ agentName }}</div>
          <div class="message-text" v-if="message.content" v-html="renderedText"></div>
          <div class="message-timestamp">{{ formattedTimestamp }}</div>
        </div>
      </div>
      <ion-avatar v-if="senderType === 'user'" slot="end" class="message-avatar user-avatar">
        <ion-icon :icon="personCircleOutline" size="small"></ion-icon>
      </ion-avatar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import type { Message } from '@/services/sessionService';
import { marked } from 'marked';
import { IonAvatar, IonIcon } from '@ionic/vue';
import { personCircleOutline, cogOutline } from 'ionicons/icons';

const props = defineProps<{
  message: Message;
}>();

const senderType = computed(() => {
  if (props.message.role === 'user') return 'user';
  if (props.message.role === 'assistant') return 'agent';
  if (props.message.role === 'system') return 'system';
  return 'agent';
});

const renderedText = computed(() => {
  if (!props.message.content) return '';
  if (senderType.value === 'agent' || senderType.value === 'system') {
    return marked.parse(props.message.content, { breaks: true, gfm: true });
  } else {
    const text = props.message.content;
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
});

const formattedTimestamp = computed(() => {
  return new Date(props.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

const agentName = computed(() => {
  // Check for the responding_agent_name in metadata (from orchestrator)
  if (props.message.metadata?.responding_agent_name) {
    return props.message.metadata.responding_agent_name;
  }
  // Fallback to agentName for backward compatibility
  if (props.message.metadata?.agentName) {
    return props.message.metadata.agentName;
  }
  // Default to "AI" if no agent name is provided
  return senderType.value === 'agent' ? 'AI' : null;
});

</script>

<style scoped>
.message-item-wrapper {
  width: 100%;
  display: flex;
}

.message-sender--system .agent-list-message-container {
  width: 100%;
  margin-bottom: 12px;
}

.message-item {
  display: flex;
  align-items: flex-end;
  margin-bottom: 12px;
  max-width: 85%;
}

.message-item--user {
  justify-content: flex-end;
  margin-left: auto;
}

.message-item--agent,
.message-item--system {
  justify-content: flex-start;
  margin-right: auto;
}

.message-item--system .message-bubble {
  background-color: var(--ion-color-light);
  border-bottom-left-radius: 5px;
  border-bottom-right-radius: 5px;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--ion-color-light-tint);
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-avatar.user-avatar {
  margin-left: 8px;
  background-color: var(--ion-color-primary-tint);
}

.message-avatar.agent-avatar {
  margin-right: 8px;
  background-color: var(--ion-color-medium-tint);
}

.message-avatar ion-icon {
  font-size: 20px;
  color: var(--ion-color-dark-contrast);
}

.message-item--user .message-avatar ion-icon {
  color: var(--ion-color-primary-contrast);
}

.message-item--agent .message-avatar ion-icon {
  color: var(--ion-color-medium-contrast);
}

.message-bubble-wrapper {
}

.message-bubble {
  padding: 10px 15px;
  border-radius: 20px;
  word-wrap: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.message-item--user .message-bubble {
  background-color: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-bottom-right-radius: 5px;
}

.message-item--agent .message-bubble {
  background-color: var(--ion-color-light-shade);
  border-bottom-left-radius: 5px;
}

.message-agent-name {
  font-size: 0.8em;
  font-weight: bold;
  margin-bottom: 4px;
  color: var(--ion-color-medium-shade);
}

.message-item--user .message-agent-name {
  display: none;
}

.message-text {
  font-size: 1em;
  line-height: 1.4;
}

.message-text :deep(p) {
  margin-top: 0;
  margin-bottom: 0.5em;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  padding-left: 20px;
}

.message-text :deep(li) {
  margin-bottom: 0.25em;
}

.message-text :deep(pre) {
  background-color: rgba(0,0,0,0.05);
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.message-text :deep(code) {
  font-family: monospace;
  background-color: rgba(0,0,0,0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
}

.message-text :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.message-timestamp {
  font-size: 0.75em;
  margin-top: 6px;
  text-align: right;
  opacity: 0.8;
}

.message-item--agent .message-timestamp {
}
</style> 