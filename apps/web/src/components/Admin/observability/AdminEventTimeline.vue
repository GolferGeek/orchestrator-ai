<template>
  <ion-card>
    <ion-card-header>
      <ion-card-title>
        <ion-icon :icon="timeOutline" />
        Event Timeline
        <ion-chip size="small" color="primary">
          {{ events.length }} events
        </ion-chip>
      </ion-card-title>
      <ion-card-subtitle v-if="events.length > 0">
        Most recent events (last {{ maxEvents }} shown)
      </ion-card-subtitle>
    </ion-card-header>
    
    <ion-card-content>
      <!-- Filters -->
      <div class="filters-section">
        <ion-searchbar
          v-model="searchQuery"
          placeholder="Search events..."
          debounce="300"
        />
        
        <div class="filter-chips">
          <ion-chip 
            :color="filterType === 'all' ? 'primary' : 'medium'"
            @click="filterType = 'all'"
          >
            <ion-label>All</ion-label>
          </ion-chip>
          
          <ion-chip 
            :color="filterType === 'agent.started' ? 'primary' : 'medium'"
            @click="filterType = 'agent.started'"
          >
            <ion-label>Started</ion-label>
          </ion-chip>
          
          <ion-chip 
            :color="filterType === 'agent.progress' ? 'primary' : 'medium'"
            @click="filterType = 'agent.progress'"
          >
            <ion-label>Progress</ion-label>
          </ion-chip>
          
          <ion-chip 
            :color="filterType === 'agent.completed' ? 'primary' : 'medium'"
            @click="filterType = 'agent.completed'"
          >
            <ion-label>Completed</ion-label>
          </ion-chip>
          
          <ion-chip 
            :color="filterType === 'agent.failed' ? 'primary' : 'medium'"
            @click="filterType = 'agent.failed'"
          >
            <ion-label>Failed</ion-label>
          </ion-chip>
        </div>
      </div>
      
      <!-- Events List -->
      <div class="events-list">
        <AdminEventRow
          v-for="event in filteredEvents"
          :key="eventKey(event)"
          :event="event"
          @conversation-click="handleConversationClick"
        />
        
        <div v-if="filteredEvents.length === 0" class="no-events">
          <ion-icon :icon="alertCircleOutline" size="large" />
          <p>{{ noEventsMessage }}</p>
        </div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonIcon,
  IonChip,
  IonLabel,
  IonSearchbar,
} from '@ionic/vue';
import {
  timeOutline,
  alertCircleOutline,
} from 'ionicons/icons';
import type { ObservabilityEvent } from '@/composables/useAdminObservabilityStream';
import AdminEventRow from './AdminEventRow.vue';

interface Props {
  events: ObservabilityEvent[];
  maxEvents?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxEvents: 100,
});

const emit = defineEmits<{
  (e: 'conversation-click', conversationId: string): void;
}>();

// Filters
const searchQuery = ref('');
const filterType = ref<string>('all');

// Filtered events
const filteredEvents = computed(() => {
  let result = [...props.events];
  
  // Type filter
  if (filterType.value !== 'all') {
    result = result.filter(e => e.hook_event_type === filterType.value);
  }
  
  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(e => {
      return (
        e.hook_event_type?.toLowerCase().includes(query) ||
        e.agent_slug?.toLowerCase().includes(query) ||
        e.username?.toLowerCase().includes(query) ||
        e.message?.toLowerCase().includes(query) ||
        e.conversation_id?.toLowerCase().includes(query) ||
        e.task_id?.toLowerCase().includes(query)
      );
    });
  }
  
  // Reverse to show most recent first
  return result.reverse();
});

const noEventsMessage = computed(() => {
  if (searchQuery.value) {
    return `No events matching "${searchQuery.value}"`;
  }
  if (filterType.value !== 'all') {
    return `No ${filterType.value} events`;
  }
  return 'No events yet. Events will appear here as agents execute.';
});

// Generate unique key for each event
function eventKey(event: ObservabilityEvent): string {
  return `${event.id || event.timestamp}-${event.task_id}-${event.hook_event_type}`;
}

function handleConversationClick(conversationId: string) {
  emit('conversation-click', conversationId);
}
</script>

<style scoped>
.filters-section {
  margin-bottom: 16px;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.filter-chips ion-chip {
  margin: 0;
  cursor: pointer;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 70vh;
  overflow-y: auto;
}

.no-events {
  text-align: center;
  padding: 48px 24px;
  color: var(--ion-color-medium);
}

.no-events ion-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.no-events p {
  font-size: 1rem;
  margin: 0;
}
</style>

