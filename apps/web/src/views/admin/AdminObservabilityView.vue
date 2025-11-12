<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button />
        </ion-buttons>
        <ion-title>System Observability</ion-title>
        <ion-buttons slot="end">
          <!-- Connection Status -->
          <ion-chip 
            :color="isConnected ? 'success' : (isConnecting ? 'warning' : 'danger')"
            size="small"
          >
            <ion-icon 
              :icon="isConnected ? checkmarkCircle : (isConnecting ? hourglassOutline : closeCircle)" 
            />
            {{ isConnected ? 'Connected' : (isConnecting ? 'Connecting...' : 'Disconnected') }}
          </ion-chip>
          
          <!-- Control Buttons -->
          <ion-button 
            fill="clear" 
            @click="streamStore.clearEvents()"
            :disabled="!isConnected"
          >
            <ion-icon :icon="trashOutline" />
          </ion-button>
          
          <ion-button 
            fill="clear" 
            @click="isConnected ? streamStore.disconnect() : streamStore.connect()"
          >
            <ion-icon :icon="isConnected ? stopCircle : playCircle" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Error Display -->
      <ion-card v-if="error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <strong>Connection Error:</strong> {{ error }}
          </ion-text>
        </ion-card-content>
      </ion-card>

      <!-- Tab Navigation -->
      <ion-segment v-model="selectedTab" @ion-change="onTabChange">
        <ion-segment-button value="timeline">
          <ion-icon :icon="listOutline" />
          <ion-label>Timeline</ion-label>
        </ion-segment-button>
        
        <ion-segment-button value="swimlanes">
          <ion-icon :icon="layersOutline" />
          <ion-label>Swim Lanes</ion-label>
        </ion-segment-button>
        
        <ion-segment-button value="analytics">
          <ion-icon :icon="pulseOutline" />
          <ion-label>Analytics</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Timeline Tab -->
        <div v-show="selectedTab === 'timeline'" class="tab-panel">
          <AdminEventTimeline 
            :events="recentEvents"
            @conversation-click="handleConversationClick"
          />
        </div>

        <!-- Swim Lanes Tab -->
        <div v-show="selectedTab === 'swimlanes'" class="tab-panel">
          <div class="swim-lanes-container">
            <AdminAgentSwimLane
              v-for="(activity, agentSlug) in agentActivities"
              :key="agentSlug"
              :activity="activity"
              @conversation-click="handleConversationClick"
            />
            
            <ion-card v-if="Object.keys(agentActivities).length === 0">
              <ion-card-content>
                <ion-text color="medium">
                  <p>No active agents. Events will appear here when agents start executing.</p>
                </ion-text>
              </ion-card-content>
            </ion-card>
          </div>
        </div>

        <!-- Analytics Tab -->
        <div v-show="selectedTab === 'analytics'" class="tab-panel">
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="statsChartOutline" />
                Event Statistics
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-grid>
                <ion-row>
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ totalEvents }}</div>
                      <div class="stat-label">Total Events</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ activeAgents }}</div>
                      <div class="stat-label">Active Agents</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ uniqueConversations }}</div>
                      <div class="stat-label">Conversations</div>
                    </div>
                  </ion-col>
                  
                  <ion-col size="6" size-md="3">
                    <div class="quick-stat">
                      <div class="stat-value">{{ lastHeartbeatText }}</div>
                      <div class="stat-label">Last Update</div>
                    </div>
                  </ion-col>
                </ion-row>
              </ion-grid>
            </ion-card-content>
          </ion-card>

          <!-- Event Type Breakdown -->
          <ion-card>
            <ion-card-header>
              <ion-card-title>
                <ion-icon :icon="pieChartOutline" />
                Event Types
              </ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                <ion-item 
                  v-for="(count, type) in eventTypeBreakdown" 
                  :key="type"
                >
                  <ion-label>
                    <h3>{{ type }}</h3>
                    <p>{{ count }} events</p>
                  </ion-label>
                  <ion-chip slot="end" color="primary">
                    {{ count }}
                  </ion-chip>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>

    <!-- Conversation Detail Modal -->
    <ConversationDetailView 
      v-if="selectedConversationId"
      :conversation-id="selectedConversationId"
      :is-open="showConversationDetail"
      @close="handleCloseConversationDetail"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonChip,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonList,
  IonItem,
} from '@ionic/vue';
import {
  checkmarkCircle,
  closeCircle,
  hourglassOutline,
  trashOutline,
  playCircle,
  stopCircle,
  listOutline,
  layersOutline,
  pulseOutline,
  statsChartOutline,
  pieChartOutline,
} from 'ionicons/icons';
import { useAdminObservabilityStream } from '@/composables/useAdminObservabilityStream';
import AdminEventTimeline from '@/components/Admin/observability/AdminEventTimeline.vue';
import AdminAgentSwimLane from '@/components/Admin/observability/AdminAgentSwimLane.vue';
import ConversationDetailView from '@/components/Admin/observability/ConversationDetailView.vue';

// Stream connection
const streamStore = useAdminObservabilityStream();
const {
  isConnected,
  isConnecting,
  error,
  lastHeartbeat,
  recentEvents,
  agentActivities,
  eventsByConversation,
  allEvents,
} = streamStore;

// UI state
const selectedTab = ref('timeline');
const showConversationDetail = ref(false);
const selectedConversationId = ref<string | null>(null);

// Computed statistics
const totalEvents = computed(() => allEvents.value.length);

const activeAgents = computed(() => {
  return Object.values(agentActivities.value).filter(
    (a) => a.status === 'active'
  ).length;
});

const uniqueConversations = computed(() => {
  return Object.keys(eventsByConversation.value).length;
});

const lastHeartbeatText = computed(() => {
  if (!lastHeartbeat.value) return 'Never';
  const now = Date.now();
  const then = lastHeartbeat.value.getTime();
  const diffSec = Math.floor((now - then) / 1000);
  
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
});

const eventTypeBreakdown = computed(() => {
  const breakdown: Record<string, number> = {};
  for (const event of allEvents.value) {
    const type = event.hook_event_type || 'unknown';
    breakdown[type] = (breakdown[type] || 0) + 1;
  }
  return breakdown;
});

// Handlers
function onTabChange() {
  // Tab changed
}

function handleConversationClick(conversationId: string) {
  selectedConversationId.value = conversationId;
  showConversationDetail.value = true;
}

function handleCloseConversationDetail() {
  showConversationDetail.value = false;
  selectedConversationId.value = null;
}

// Lifecycle
onMounted(async () => {
  await streamStore.connect();
});

onUnmounted(() => {
  streamStore.disconnect();
});
</script>

<style scoped>
.tab-content {
  padding: 16px;
}

.tab-panel {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.swim-lanes-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-stat {
  text-align: center;
  padding: 12px;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin-top: 4px;
}
</style>

