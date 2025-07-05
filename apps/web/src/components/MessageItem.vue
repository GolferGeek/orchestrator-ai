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
          <div v-if="senderType === 'agent' && agentName" class="message-agent-name">
            {{ agentName }}
            <span v-if="showViewAllAgentsLink" class="agent-action-link">
              (<a href="#" @click.prevent="viewAllAgents">View my agents</a>)
            </span>
            <span v-if="showViewAgentCapabilitiesLink" class="agent-action-link">
              (<a href="#" @click.prevent="viewAgentCapabilities">View all that I can do for you</a>)
            </span>
          </div>
          <div v-else-if="senderType === 'system' && agentName" class="message-agent-name">{{ agentName }}</div>
          <div class="message-text" v-if="message.content" v-html="renderedText" @click="handleMessageContentClick"></div>
          <div class="message-timestamp">{{ formattedTimestamp }}</div>
        </div>
        
        <!-- Delegation Information Component -->
        <DelegationInfo
          v-if="message.role === 'assistant' && message.metadata"
          :agentName="agentName"
          :reason="message.metadata.delegationReason || message.metadata.continuityReason"
          :confidence="message.metadata.confidence"
          :stickyContext="message.metadata.stickyContext"
          :continuityReason="message.metadata.continuityReason"
          :agentContext="message.metadata.agentContext"
          :delegationType="getDelegationType()"
          :agentSpecialization="getAgentSpecialization()"
        />
        
        <!-- Message Rating Component -->
        <MessageRating
          :messageId="message.id"
          :agentName="agentName"
          :messageRole="message.role"
        />
        
        <div v-if="showReturnToOrchestratorLink" class="return-to-orchestrator-link">
          <a href="#" @click.prevent="returnToOrchestrator">Return to Orchestrator</a>
        </div>
      </div>
      <ion-avatar v-if="senderType === 'user'" slot="end" class="message-avatar user-avatar">
        <ion-icon :icon="personCircleOutline" size="small"></ion-icon>
      </ion-avatar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, defineEmits } from 'vue';
import type { Message } from '@/services/sessionService';
import { marked } from 'marked';
import { IonAvatar, IonIcon } from '@ionic/vue';
import { personCircleOutline, cogOutline } from 'ionicons/icons';
import MessageRating from './MessageRating.vue';
import DelegationInfo from './DelegationInfo.vue';

const props = defineProps<{
  message: Message;
}>();

const emit = defineEmits([
  'returnToOrchestrator', 
  'viewAllAgentsClicked', 
  'viewAgentCapabilitiesClicked',
  'agentCapabilityRequestedFor'
]);

const senderType = computed(() => {
  if (props.message.role === 'user') return 'user';
  if (props.message.role === 'assistant') return 'agent';
  if (props.message.role === 'system') return 'system';
  return 'agent';
});

const isAgentListFromOrchestrator = computed(() => {
  if (props.message.metadata?.contentType === 'agentListFromOrchestrator') {
    return true;
  }
  if (agentName.value?.toLowerCase() === 'orchestrator' && props.message.content) {
    const content = props.message.content.toLowerCase();
    return content.includes('agent name:') && (content.includes('description:') || content.includes('domain:'));
  }
  return false;
});

const renderedText = computed(() => {
  if (!props.message.content) return '';

  if (isAgentListFromOrchestrator.value) {
    const lines = props.message.content.split('\n');
    const processedLines: string[] = [];
    // Regex to find "Agent Name: <name>, Description: <desc>" or similar patterns
    // It captures (Agent Name: )(<agent_name_here>)(, Description: ... or other trailing text)
    const agentLineRegex = /^(.*?Agent Name:\s*)([^,]+)(.*)$/i;

    for (const line of lines) {
      const match = line.match(agentLineRegex);
      if (match) {
        let prefix = match[1]; // e.g., "    Agent Name: " or just leading spaces if Agent Name is at start
        const agentNameValue = match[2].trim(); // e.g., "productivity/internal_rag_agent"
        const suffix = match[3] || ''; // e.g., ", Description: Handles tasks..."
        
        // Remove "Agent Name: " and any following spaces from the prefix part
        prefix = prefix.replace(/Agent Name:\s*/i, '');

        const sanitizedAgentName = agentNameValue.replace(/["'<>]/g, '');
        const link = `<a href="#" class="clickable-agent-name" data-agent-name="${sanitizedAgentName}">${agentNameValue}</a>`;
        processedLines.push(`${prefix}${link}${suffix}`);
      } else {
        // If the line doesn't match the agent name pattern, add it as is (e.g., headers, general text)
        // Basic escaping for non-HTML content to prevent XSS if it's not already handled
        const escapedLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        processedLines.push(escapedLine);
      }
    }
    return processedLines.join('<br>'); // Join lines with <br> for HTML display
  }

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
  if (props.message.metadata?.responding_agent_name) {
    return props.message.metadata.responding_agent_name;
  }
  if (props.message.metadata?.agentName) {
    return props.message.metadata.agentName;
  }
  return senderType.value === 'agent' ? 'AI' : null;
});

const showReturnToOrchestratorLink = computed(() => {
  return senderType.value === 'agent' && 
         agentName.value && 
         agentName.value.toLowerCase() !== 'ai' && 
         agentName.value.toLowerCase() !== 'orchestrator';
});

const showViewAllAgentsLink = computed(() => {
  return senderType.value === 'agent' &&
         agentName.value &&
         agentName.value.toLowerCase() === 'orchestrator';
});

const showViewAgentCapabilitiesLink = computed(() => {
  if (props.message.metadata?.isCapabilitiesResponse) {
    return false;
  }
  return senderType.value === 'agent' &&
         agentName.value &&
         agentName.value.toLowerCase() !== 'orchestrator' &&
         agentName.value.toLowerCase() !== 'ai';
});

const returnToOrchestrator = () => {
  console.log('[MessageItem.vue] returnToOrchestrator method called');
  emit('returnToOrchestrator');
};

const viewAllAgents = () => {
  console.log('[MessageItem.vue] viewAllAgents method called');
  emit('viewAllAgentsClicked');
};

const viewAgentCapabilities = () => {
  console.log('[MessageItem.vue] viewAgentCapabilities method called for agent:', agentName.value);
  // Pass the agent information so the parent knows which agent to ask about capabilities
  const agentInfo = {
    name: agentName.value,
    metadata: props.message.metadata
  };
  emit('viewAgentCapabilitiesClicked', agentInfo);
};

const handleMessageContentClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (target.tagName === 'A' && target.classList.contains('clickable-agent-name')) {
    event.preventDefault();
    const agentToQuery = target.dataset.agentName;
    if (agentToQuery) {
      console.log(`[MessageItem.vue] Clickable agent name clicked: ${agentToQuery}`);
      emit('agentCapabilityRequestedFor', agentToQuery);
    }
  }
};

const getDelegationType = (): 'new' | 'continuation' | 'handoff' | undefined => {
  if (!props.message.metadata) return undefined;
  
  if (props.message.metadata.stickyContext) {
    return 'continuation';
  }
  
  if (props.message.metadata.delegatedTo || props.message.metadata.isDelegated) {
    return 'handoff';
  }
  
  return 'new';
};

const getAgentSpecialization = (): string | undefined => {
  if (!props.message.metadata || !agentName.value) return undefined;
  
  const name = agentName.value.toLowerCase();
  
  // Map agent names to their specializations
  const specializations: Record<string, string> = {
    'hr assistant': 'Human Resources & Employee Benefits',
    'golf rules agent': 'Golf Rules & Regulations',
    'blog post': 'Content Creation & Writing',
    'calendar': 'Scheduling & Time Management', 
    'email triage': 'Email Management & Communication',
    'content': 'Content Strategy & Marketing',
    'external rag': 'External Knowledge & Research',
    'internal rag': 'Internal Documentation & Knowledge',
    'hiverarchy': 'Advanced Content Creation & Strategy'
  };
  
  for (const [key, specialization] of Object.entries(specializations)) {
    if (name.includes(key)) {
      return specialization;
    }
  }
  
  return `${agentName.value} Specialist`;
};

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

.message-text :deep(a.clickable-agent-name) {
  color: var(--ion-color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.message-text :deep(a.clickable-agent-name:hover) {
  color: var(--ion-color-primary-shade);
}

.message-timestamp {
  font-size: 0.75em;
  margin-top: 6px;
  text-align: right;
  opacity: 0.8;
}

.message-item--agent .message-timestamp {
}

.return-to-orchestrator-link,
.agent-action-link {
  margin-top: 8px;
  font-size: 0.85em;
  text-align: left;
  padding-left: 8px;
}

.return-to-orchestrator-link a {
  color: var(--ion-color-primary);
  text-decoration: none;
}

.return-to-orchestrator-link a:hover {
  text-decoration: underline;
}

.agent-action-link {
  margin-left: 5px;
}

.agent-action-link a {
  color: var(--ion-color-primary);
  text-decoration: none;
}

.agent-action-link a:hover {
  text-decoration: underline;
}
</style> 