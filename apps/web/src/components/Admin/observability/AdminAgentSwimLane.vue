<template>
  <ion-card class="swim-lane" :class="`status-${activity.status}`">
    <ion-card-header>
      <div class="lane-header">
        <div class="lane-title">
          <ion-icon :icon="constructOutline" />
          <h3>{{ activity.agentSlug }}</h3>
          <ion-chip 
            :color="statusColor"
            size="small"
          >
            <ion-icon :icon="statusIcon" />
            <ion-label>{{ activity.status }}</ion-label>
          </ion-chip>
        </div>
        
        <div class="lane-stats">
          <ion-chip size="small">
            {{ activity.events.length }} events
          </ion-chip>
          
          <ion-chip size="small" v-if="lastEventTime">
            <ion-icon :icon="timeOutline" />
            {{ lastEventTime }}
          </ion-chip>
        </div>
      </div>
    </ion-card-header>
    
    <ion-card-content>
      <!-- Latest Event -->
      <div class="latest-event">
        <AdminEventRow
          :event="activity.lastEvent"
          @conversation-click="handleConversationClick"
        />
      </div>
      
      <!-- Event Timeline Visualization -->
      <div class="events-timeline">
        <div 
          v-for="event in recentEvents" 
          :key="eventKey(event)"
          class="timeline-dot"
          :class="`dot-${getEventType(event)}`"
          :title="event.message || event.hook_event_type"
        >
          <ion-icon :icon="getEventIcon(event)" size="small" />
        </div>
      </div>
      
      <!-- Expand/Collapse -->
      <ion-button 
        v-if="activity.events.length > 5"
        fill="clear" 
        size="small"
        @click="expanded = !expanded"
      >
        <ion-icon :icon="expanded ? chevronUpOutline : chevronDownOutline" />
        {{ expanded ? 'Show less' : `Show all ${activity.events.length} events` }}
      </ion-button>
      
      <!-- All Events (when expanded) -->
      <div v-if="expanded" class="all-events">
        <AdminEventRow
          v-for="event in activity.events"
          :key="eventKey(event)"
          :event="event"
          @conversation-click="handleConversationClick"
        />
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardContent,
  IonIcon,
  IonChip,
  IonLabel,
  IonButton,
} from '@ionic/vue';
import {
  constructOutline,
  timeOutline,
  checkmarkCircleOutline,
  playCircleOutline,
  closeCircleOutline,
  pauseCircleOutline,
  chevronUpOutline,
  chevronDownOutline,
  arrowForwardCircleOutline,
  codeSlashOutline,
  cloudUploadOutline,
  globeOutline,
} from 'ionicons/icons';
import type { AgentActivity, ObservabilityEvent } from '@/composables/useAdminObservabilityStream';
import AdminEventRow from './AdminEventRow.vue';

interface Props {
  activity: AgentActivity;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

const expanded = ref(false);

// Computed
const statusColor = computed(() => {
  switch (props.activity.status) {
    case 'active': return 'primary';
    case 'error': return 'danger';
    case 'idle': return 'success';
    default: return 'medium';
  }
});

const statusIcon = computed(() => {
  switch (props.activity.status) {
    case 'active': return playCircleOutline;
    case 'error': return closeCircleOutline;
    case 'idle': return checkmarkCircleOutline;
    default: return pauseCircleOutline;
  }
});

const recentEvents = computed(() => {
  // Last 20 events for timeline visualization
  return props.activity.events.slice(-20);
});

const lastEventTime = computed(() => {
  const event = props.activity.lastEvent;
  const date = event.created_at 
    ? new Date(event.created_at)
    : new Date(event.timestamp);
  
  const now = Date.now();
  const then = date.getTime();
  const diffSec = Math.floor((now - then) / 1000);
  
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
});

// Helpers
function eventKey(event: ObservabilityEvent): string {
  return `${event.id || event.timestamp}-${event.task_id}-${event.hook_event_type}`;
}

function getEventType(event: ObservabilityEvent): string {
  const type = event.hook_event_type;
  if (type === 'agent.started') return 'started';
  if (type === 'agent.completed') return 'completed';
  if (type === 'agent.failed') return 'failed';
  return 'progress';
}

function getEventIcon(event: ObservabilityEvent) {
  const type = event.hook_event_type;
  
  if (type === 'agent.started') return playCircleOutline;
  if (type === 'agent.completed') return checkmarkCircleOutline;
  if (type === 'agent.failed') return closeCircleOutline;
  if (type === 'agent.progress') {
    const msg = event.message?.toLowerCase() || '';
    if (msg.includes('calling llm')) return codeSlashOutline;
    if (msg.includes('api')) return cloudUploadOutline;
    if (msg.includes('external')) return globeOutline;
    return arrowForwardCircleOutline;
  }
  
  return pauseCircleOutline;
}

function handleConversationClick(conversationId: string) {
  emit('conversation-click', conversationId);
}
</script>

<style scoped>
.swim-lane {
  border-left: 4px solid var(--ion-color-medium);
  transition: all 0.3s ease;
}

.swim-lane.status-active {
  border-left-color: var(--ion-color-primary);
  box-shadow: 0 2px 8px rgba(var(--ion-color-primary-rgb), 0.2);
}

.swim-lane.status-error {
  border-left-color: var(--ion-color-danger);
  box-shadow: 0 2px 8px rgba(var(--ion-color-danger-rgb), 0.2);
}

.swim-lane.status-idle {
  border-left-color: var(--ion-color-success);
}

.lane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.lane-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lane-title h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.lane-stats {
  display: flex;
  gap: 8px;
  align-items: center;
}

.latest-event {
  margin-bottom: 16px;
}

.events-timeline {
  display: flex;
  gap: 4px;
  padding: 12px 0;
  border-top: 1px solid var(--ion-color-step-150);
  border-bottom: 1px solid var(--ion-color-step-150);
  overflow-x: auto;
}

.timeline-dot {
  min-width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ion-color-step-100);
  border: 2px solid var(--ion-color-step-200);
  transition: transform 0.2s ease;
  cursor: pointer;
}

.timeline-dot:hover {
  transform: scale(1.2);
}

.dot-started {
  background: var(--ion-color-primary);
  border-color: var(--ion-color-primary-shade);
  color: white;
}

.dot-completed {
  background: var(--ion-color-success);
  border-color: var(--ion-color-success-shade);
  color: white;
}

.dot-failed {
  background: var(--ion-color-danger);
  border-color: var(--ion-color-danger-shade);
  color: white;
}

.dot-progress {
  background: var(--ion-color-tertiary);
  border-color: var(--ion-color-tertiary-shade);
  color: white;
}

.all-events {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  background: var(--ion-color-step-50);
  border-radius: 4px;
}

ion-chip {
  margin: 0;
}
</style>

