<template>
  <ion-modal :is-open="isOpen" @willDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>Available Agents</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
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
              <p class="agent-description">{{ agent.description }}</p>
            </ion-label>
            <ion-icon :icon="chevronForwardOutline" slot="end" color="medium"></ion-icon>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
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
  chevronForwardOutline 
} from 'ionicons/icons';

interface Agent {
  name: string;
  description: string;
}

const props = defineProps<{
  isOpen: boolean;
  agents: Agent[];
}>();

const emit = defineEmits(['dismiss', 'agentSelected']);

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
</style> 