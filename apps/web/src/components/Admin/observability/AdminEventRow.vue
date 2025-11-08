<template>
  <div class="event-row" :class="`event-${eventTypeClass}`">
    <div class="event-icon">
      <ion-icon :icon="eventIcon" :color="eventColor" />
    </div>
    
    <div class="event-content">
      <div class="event-header">
        <span class="event-type">{{ event.hook_event_type }}</span>
        <span class="event-time">{{ formattedTime }}</span>
      </div>
      
      <div class="event-details">
        <div class="event-detail-row">
          <ion-chip 
            v-if="event.username"
            size="small"
            color="secondary"
          >
            <ion-icon :icon="personOutline" />
            <ion-label>{{ event.username }}</ion-label>
          </ion-chip>
          
          <ion-chip 
            v-if="event.agent_slug"
            size="small"
            color="primary"
          >
            <ion-icon :icon="constructOutline" />
            <ion-label>{{ event.agent_slug }}</ion-label>
          </ion-chip>
          
          <ion-chip 
            v-if="event.conversation_id"
            size="small"
            color="tertiary"
            @click="handleConversationClick"
            class="clickable"
          >
            <ion-icon :icon="chatbubbleOutline" />
            <ion-label>{{ truncateId(event.conversation_id) }}</ion-label>
          </ion-chip>
          
          <ion-chip 
            v-if="event.task_id"
            size="small"
            color="medium"
          >
            <ion-icon :icon="documentOutline" />
            <ion-label>{{ truncateId(event.task_id) }}</ion-label>
          </ion-chip>
        </div>
        
        <div v-if="event.message" class="event-message">
          {{ event.message }}
        </div>
        
        <ion-progress-bar 
          v-if="showProgress"
          :value="event.progress / 100"
          :color="progressColor"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonIcon,
  IonChip,
  IonLabel,
  IonProgressBar,
} from '@ionic/vue';
import {
  personOutline,
  constructOutline,
  chatbubbleOutline,
  documentOutline,
  playCircleOutline,
  pauseCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  arrowForwardCircleOutline,
  cloudUploadOutline,
  globeOutline,
  codeSlashOutline,
} from 'ionicons/icons';
import type { ObservabilityEvent } from '@/composables/useAdminObservabilityStream';

interface Props {
  event: ObservabilityEvent;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

// Format timestamp
const formattedTime = computed(() => {
  const date = props.event.created_at 
    ? new Date(props.event.created_at)
    : new Date(props.event.timestamp);
  
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
});

// Determine event icon and color based on event type
const eventIcon = computed(() => {
  const type = props.event.hook_event_type;
  
  if (type === 'agent.started') return playCircleOutline;
  if (type === 'agent.completed') return checkmarkCircleOutline;
  if (type === 'agent.failed') return closeCircleOutline;
  if (type === 'agent.progress') {
    const msg = props.event.message?.toLowerCase() || '';
    if (msg.includes('calling llm')) return codeSlashOutline;
    if (msg.includes('api')) return cloudUploadOutline;
    if (msg.includes('external')) return globeOutline;
    return arrowForwardCircleOutline;
  }
  
  return pauseCircleOutline;
});

const eventColor = computed(() => {
  const type = props.event.hook_event_type;
  
  if (type === 'agent.started') return 'primary';
  if (type === 'agent.completed') return 'success';
  if (type === 'agent.failed') return 'danger';
  if (type === 'agent.progress') return 'tertiary';
  
  return 'medium';
});

const eventTypeClass = computed(() => {
  const type = props.event.hook_event_type;
  return type.replace(/\./g, '-');
});

const showProgress = computed(() => {
  return props.event.progress !== undefined && props.event.progress > 0;
});

const progressColor = computed(() => {
  const progress = props.event.progress || 0;
  if (progress >= 100) return 'success';
  if (progress >= 50) return 'primary';
  return 'warning';
});

// Handlers
function handleConversationClick() {
  if (props.event.conversation_id) {
    emit('conversation-click', props.event.conversation_id);
  }
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.substring(0, 8)}...`;
}
</script>

<style scoped>
.event-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-left: 3px solid var(--ion-color-medium);
  background: var(--ion-color-step-50);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.event-row:hover {
  background: var(--ion-color-step-100);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.event-agent-started {
  border-left-color: var(--ion-color-primary);
}

.event-agent-completed {
  border-left-color: var(--ion-color-success);
}

.event-agent-failed {
  border-left-color: var(--ion-color-danger);
}

.event-agent-progress {
  border-left-color: var(--ion-color-tertiary);
}

.event-icon {
  font-size: 24px;
  padding-top: 2px;
}

.event-content {
  flex: 1;
  min-width: 0;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-type {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--ion-color-dark);
}

.event-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.event-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-detail-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.event-message {
  font-size: 0.875rem;
  color: var(--ion-color-step-700);
  margin-top: 4px;
}

.clickable {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.clickable:hover {
  transform: scale(1.05);
}

ion-chip {
  margin: 0;
}
</style>

