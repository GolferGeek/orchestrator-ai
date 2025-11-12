<template>
  <ion-modal 
    :is-open="isOpen"
    @didDismiss="handleClose"
  >
    <ion-header>
      <ion-toolbar>
        <ion-title>Conversation Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleClose">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <!-- Loading Bar -->
      <ion-progress-bar 
        v-if="isLoading" 
        type="indeterminate"
        color="primary"
      />
    </ion-header>
    
    <ion-content>
      <!-- Error Display -->
      <ion-card v-if="error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <strong>Error:</strong> {{ error }}
          </ion-text>
        </ion-card-content>
      </ion-card>
      
      <!-- Conversation Info -->
      <ion-card v-if="conversation">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="chatbubbleOutline" />
            Conversation Info
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Conversation ID</h3>
                <p class="monospace">{{ conversation.id }}</p>
              </ion-label>
              <ion-button 
                slot="end" 
                fill="clear" 
                size="small"
                @click="copyToClipboard(conversation.id)"
              >
                <ion-icon :icon="copyOutline" />
              </ion-button>
            </ion-item>
            
            <ion-item>
              <ion-label>
                <h3>Agent</h3>
                <p>{{ conversation.agent_slug }}</p>
              </ion-label>
            </ion-item>
            
            <ion-item v-if="conversation.organization_slug">
              <ion-label>
                <h3>Organization</h3>
                <p>{{ conversation.organization_slug }}</p>
              </ion-label>
            </ion-item>
            
            <ion-item>
              <ion-label>
                <h3>Mode</h3>
                <p>{{ conversation.mode }}</p>
              </ion-label>
            </ion-item>
            
            <ion-item>
              <ion-label>
                <h3>Status</h3>
                <ion-chip :color="getStatusColor(conversation.status)">
                  {{ conversation.status }}
                </ion-chip>
              </ion-label>
            </ion-item>
            
            <ion-item>
              <ion-label>
                <h3>Created</h3>
                <p>{{ formatDate(conversation.created_at) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      
      <!-- Messages -->
      <ion-card v-if="conversation?.messages && conversation.messages.length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="chatbubblesOutline" />
            Messages ({{ conversation.messages.length }})
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="messages-list">
            <div 
              v-for="message in conversation.messages"
              :key="message.id"
              class="message-item"
              :class="`message-${message.role}`"
            >
              <div class="message-header">
                <ion-chip size="small" :color="message.role === 'user' ? 'primary' : 'secondary'">
                  {{ message.role }}
                </ion-chip>
                <span class="message-time">{{ formatTime(message.created_at) }}</span>
              </div>
              <div class="message-content">
                {{ message.content }}
              </div>
            </div>
          </div>
        </ion-card-content>
      </ion-card>
      
      <!-- Observability Events Timeline -->
      <ion-card v-if="eventTimeline.length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="timeOutline" />
            Event Timeline ({{ eventTimeline.length }} events)
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <div class="events-timeline">
            <AdminEventRow
              v-for="event in eventTimeline"
              :key="eventKey(event)"
              :event="event"
            />
          </div>
        </ion-card-content>
      </ion-card>
      
      <!-- Tasks -->
      <ion-card v-if="tasks.length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="documentTextOutline" />
            Related Tasks ({{ tasks.length }})
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item v-for="task in tasks" :key="task.id">
              <ion-label>
                <h3>{{ task.name }}</h3>
                <p>ID: {{ task.id }}</p>
              </ion-label>
              <ion-chip 
                slot="end" 
                :color="getStatusColor(task.status)"
              >
                {{ task.status }}
              </ion-chip>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      
      <!-- Deliverables -->
      <ion-card v-if="deliverables.length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="documentOutline" />
            Deliverables ({{ deliverables.length }})
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item v-for="deliverable in deliverables" :key="deliverable.id">
              <ion-label>
                <h3>{{ deliverable.title }}</h3>
                <p>Format: {{ deliverable.format }}</p>
                <p>{{ formatDate(deliverable.created_at) }}</p>
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
      
      <!-- Event Statistics -->
      <ion-card v-if="Object.keys(eventsByType).length > 0">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="statsChartOutline" />
            Event Statistics
          </ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item 
              v-for="(events, type) in eventsByType" 
              :key="type"
            >
              <ion-label>
                <h3>{{ type }}</h3>
              </ion-label>
              <ion-chip slot="end" color="primary">
                {{ events.length }}
              </ion-chip>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { watch, toRef } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonProgressBar,
  toastController,
} from '@ionic/vue';
import {
  closeOutline,
  chatbubbleOutline,
  chatbubblesOutline,
  copyOutline,
  timeOutline,
  documentTextOutline,
  documentOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useConversationDetail } from '@/composables/useConversationDetail';
import AdminEventRow from './AdminEventRow.vue';
import type { ObservabilityEvent } from '@/composables/useAdminObservabilityStream';

interface Props {
  conversationId: string;
  isOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'close'): void;
}>();

const {
  isLoading,
  error,
  conversation,
  events,
  tasks,
  deliverables,
  eventsByType,
  eventTimeline,
  fetchConversationDetail,
  clear,
} = useConversationDetail();

// Watch for conversation ID changes and fetch data
watch(
  [toRef(props, 'conversationId'), toRef(props, 'isOpen')],
  ([newConvId, newIsOpen]) => {
    if (newIsOpen && newConvId) {
      fetchConversationDetail(newConvId);
    }
  },
  { immediate: true }
);

// Handlers
function handleClose() {
  clear();
  emit('close');
}

function getStatusColor(status: string): string {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('complete') || statusLower.includes('success')) return 'success';
  if (statusLower.includes('fail') || statusLower.includes('error')) return 'danger';
  if (statusLower.includes('progress') || statusLower.includes('running')) return 'warning';
  return 'medium';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    const toast = await toastController.create({
      message: 'Copied to clipboard',
      duration: 2000,
      color: 'success',
      position: 'bottom',
    });
    await toast.present();
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

function eventKey(event: ObservabilityEvent): string {
  return `${event.id || event.timestamp}-${event.task_id}-${event.hook_event_type}`;
}
</script>

<style scoped>
ion-modal {
  --width: 90%;
  --max-width: 1200px;
  --height: 90%;
  --border-radius: 8px;
}

.monospace {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.message-item {
  padding: 12px;
  border-radius: 8px;
  background: var(--ion-color-step-50);
  border-left: 3px solid var(--ion-color-medium);
}

.message-user {
  border-left-color: var(--ion-color-primary);
}

.message-assistant {
  border-left-color: var(--ion-color-secondary);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.message-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.message-content {
  white-space: pre-wrap;
  line-height: 1.5;
  color: var(--ion-color-dark);
}

.events-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

ion-chip {
  margin: 0;
}
</style>

