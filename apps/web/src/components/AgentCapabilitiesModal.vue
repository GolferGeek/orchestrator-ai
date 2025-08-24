<template>
  <ion-modal :is-open="isOpen" @willDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ modalTitle }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Single Agent Capabilities Mode -->
      <div v-if="singleAgent" class="agent-capabilities">
        <div class="agent-header">
          <ion-icon :icon="cogOutline" color="primary" class="agent-icon"></ion-icon>
          <div>
            <h2 class="agent-name">{{ singleAgent.name }}</h2>
            <p class="agent-description">{{ formatAgentDescription(singleAgent.description) }}</p>
          </div>
        </div>
        <div class="capabilities-section">
          <ion-text color="primary">
            <h3>My Capabilities:</h3>
          </ion-text>
          <ion-list>
            <ion-item v-for="(capability, index) in singleAgent.capabilities" :key="index" class="capability-item">
              <ion-icon :icon="checkmarkCircleOutline" slot="start" color="success"></ion-icon>
              <ion-label>
                <p>{{ capability }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </div>
      </div>
      <!-- Multiple Agents List Mode -->
      <div v-else>
        <div v-if="agents.length === 0" class="no-agents">
          <ion-text color="medium">
            <p>No agents are currently available.</p>
          </ion-text>
        </div>
        <div v-else class="agents-list">
          <ion-text color="primary">
            <h3>Here's what I can help you with:</h3>
          </ion-text>
          <ion-list>
            <ion-item 
              v-for="agent in agents" 
              :key="agent.name"
              button
              @click="selectAgent(agent)"
              class="agent-item"
            >
              <ion-icon :icon="cogOutline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h2 class="agent-name-link">{{ cleanAgentName(agent.name) }}</h2>
                <p class="agent-description">{{ formatAgentDescription(agent.description) }}</p>
              </ion-label>
              <ion-icon :icon="chevronForwardOutline" slot="end" color="medium"></ion-icon>
            </ion-item>
          </ion-list>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>
<script setup lang="ts">
import { defineProps, defineEmits, computed, withDefaults } from 'vue';
import { formatAgentDescription } from '@/utils/caseConverter';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonText,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import { 
  closeOutline, 
  cogOutline, 
  chevronForwardOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';
interface Agent {
  name: string;
  description: string;
}
interface AgentCapabilities {
  name: string;
  description: string;
  capabilities: string[];
  originalName?: string;
  type?: string;
}
const props = withDefaults(defineProps<{
  isOpen: boolean;
  agents?: Agent[];
  singleAgent?: AgentCapabilities | null;
}>(), {
  agents: () => [],
  singleAgent: null
});
const emit = defineEmits(['dismiss', 'agentSelected']);
const modalTitle = computed(() => {
  if (props.singleAgent) {
    return `${props.singleAgent.name} Capabilities`;
  }
  return 'Available Agents';
});
const onDismiss = () => {
  emit('dismiss');
};
const selectAgent = (agent: Agent) => {
  emit('agentSelected', agent);
  onDismiss();
};
const cleanAgentName = (name: string) => {
  // Remove common prefixes and suffixes to get clean agent names
  let cleanName = name.trim();
  // Remove "Agent Name:" prefix if present
  cleanName = cleanName.replace(/^Agent Name:\s*/i, '');
  // Remove "Agent" suffix if present
  cleanName = cleanName.replace(/\s+Agent$/i, '');
  // Remove "Agent" prefix if present  
  cleanName = cleanName.replace(/^Agent\s+/i, '');
  return cleanName || name; // Return original if cleaning resulted in empty string
};
</script>
<style scoped>
.no-agents {
  text-align: center;
  padding: 2rem 0;
}
.agents-list h3 {
  margin-bottom: 1rem;
}
.agent-item {
  --background: var(--ion-color-light);
  margin-bottom: 0.5rem;
  border-radius: 8px;
}
.agent-item:hover {
  --background: var(--ion-color-light-shade);
}
.agent-name-link {
  color: var(--ion-color-primary);
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}
.agent-item:hover .agent-name-link {
  color: var(--ion-color-primary-shade);
  text-decoration: underline;
}
.agent-description {
  margin-top: 0.25rem;
  margin-bottom: 0;
}
/* Single Agent Capabilities Styling */
.agent-capabilities {
  padding: 1rem 0;
}
.agent-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 12px;
}
.agent-icon {
  font-size: 2rem;
  margin-top: 0.25rem;
}
.agent-name {
  color: var(--ion-color-primary);
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}
.agent-header .agent-description {
  color: var(--ion-color-medium);
  margin: 0;
  line-height: 1.4;
}
.capabilities-section h3 {
  margin-bottom: 1rem;
  font-weight: 600;
}
.capability-item {
  --background: var(--ion-color-light);
  margin-bottom: 0.5rem;
  border-radius: 8px;
  --border-radius: 8px;
}
.capability-item ion-label p {
  color: var(--ion-color-dark);
  margin: 0;
  line-height: 1.4;
}
</style> 