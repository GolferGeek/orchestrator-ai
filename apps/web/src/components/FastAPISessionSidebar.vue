<template>
  <ion-list>
    <ion-list-header>
      <div class="sidebar-header">
        <span>Python Sessions</span>
        <div class="api-badge">
          <span class="api-label fastapi">Python</span>
        </div>
      </div>
    </ion-list-header>
    
    <ion-item button @click="handleCreateNewSession" lines="none">
      <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
      <ion-label>New Python Chat</ion-label>
    </ion-item>
    
    <div v-if="isLoading" class="ion-padding ion-text-center">
      <ion-spinner name="crescent"></ion-spinner>
    </div>
    
    <div v-if="error" class="ion-padding ion-text-center">
      <ion-text color="danger">{{ error }}</ion-text>
    </div>

    <ion-menu-toggle :auto-hide="false" v-for="session in sessions" :key="session.id">
      <ion-item 
        button 
        @click="() => selectSession(session.id)" 
        :class="{ 'selected-session': session.id === selectedSessionId }"
        lines="none"
        :detail="false"
      >
        <ion-icon :icon="chatbubbleEllipsesOutline" slot="start"></ion-icon>
        <ion-label>
          <p>{{ session.name || 'Python Chat on ' + formatDate(session.created_at) }}</p>
          <p><small>Updated: {{ formatRelativeDate(session.updated_at) }}</small></p>
        </ion-label>
        <div class="session-actions" slot="end">
          <ion-button fill="clear" @click.stop="() => handleEditSessionName(session)">
            <ion-icon :icon="createOutline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button fill="clear" color="danger" @click.stop="() => handleDeleteSession(session)">
            <ion-icon :icon="trashOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </div>
      </ion-item>
    </ion-menu-toggle>

    <ion-item v-if="!isLoading && sessions.length === 0 && !error" lines="none">
        <ion-label class="ion-text-center ion-padding-top">
            <p><small>No Python sessions yet.</small></p>
        </ion-label>
    </ion-item>

    <!-- Python specific tools section -->
    <ion-list-header class="tools-header">
      <span>Python Tools</span>
    </ion-list-header>
    
    <ion-item button lines="none" @click="handleFastAPIAgentsList">
      <ion-icon :icon="peopleOutline" slot="start"></ion-icon>
      <ion-label>View Python Agents</ion-label>
    </ion-item>
    
    <ion-item button lines="none" @click="handleFastAPIHealth">
      <ion-icon :icon="heartOutline" slot="start"></ion-icon>
      <ion-label>API Health Check</ion-label>
    </ion-item>
  </ion-list>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonMenuToggle, IonSpinner, IonText, alertController, IonButton } from '@ionic/vue';
import { addCircleOutline, chatbubbleEllipsesOutline, createOutline, trashOutline, peopleOutline, heartOutline } from 'ionicons/icons';
import { sessionService, Session } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { storeToRefs } from 'pinia';
import { fastapiApiService } from '../services/fastapiApiService';

const authStore = useAuthStore();
const sessionStore = useSessionStore();

const sessions = ref<Session[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const { currentSessionId: selectedSessionId } = storeToRefs(sessionStore);

// No need to switch API managers - we use dedicated FastAPI service
onMounted(() => {
  fetchSessions();
});

const fetchSessions = async () => {
  if (!authStore.isAuthenticated) {
    sessions.value = [];
    return;
  }
  isLoading.value = true;
  error.value = null;
  try {
    const response = await sessionService.listSessions();
    sessions.value = response.sessions;
  } catch (e: any) {
    error.value = e.message || 'Could not load Python sessions.';
  } finally {
    isLoading.value = false;
  }
};

const selectSession = (sessionId: string) => {
  console.log('Selected FastAPI session:', sessionId);
  sessionStore.setCurrentSessionId(sessionId);
};

const handleCreateNewSession = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const newSession = await sessionService.createSession({ name: 'New Python Chat' });
    sessions.value.unshift(newSession);
    selectSession(newSession.id);
  } catch (e: any) {
    error.value = e.message || 'Could not create new Python session.';
  } finally {
    isLoading.value = false;
  }
};

const handleFastAPIAgentsList = () => {
  // Trigger a request to show available FastAPI agents
  if (selectedSessionId.value) {
    // This will send a message to current session asking for agents
    console.log('Requesting FastAPI agents list');
    // You could emit an event here or use a different mechanism
  }
};

const handleFastAPIHealth = async () => {
  try {
    // Use dedicated FastAPI service for health check
    const isHealthy = await fastapiApiService.healthCheck();
    
    if (isHealthy) {
      const alert = await alertController.create({
        header: 'Python API Health Status',
        message: `✅ Status: Healthy\n📡 Endpoint: http://localhost:8000/health\n🐍 Python API is running normally`,
        buttons: ['OK']
      });
      await alert.present();
    } else {
      const alert = await alertController.create({
        header: 'Python API Health Status',
        message: `❌ Status: Unhealthy\n📡 Endpoint: http://localhost:8000/health\n🔴 Python API is not responding correctly`,
        buttons: ['OK']
      });
      await alert.present();
    }
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'Python Health Check Failed',
      message: `❌ Could not connect to Python API\n\n🔗 Endpoint: http://localhost:8000/health\n💥 Error: ${error.message}\n\n💡 Make sure the Python server is running on port 8000`,
      buttons: ['OK']
    });
    await alert.present();
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString(); 
};

const handleEditSessionName = async (session: Session) => {
  const alert = await alertController.create({
    header: 'Rename Python Session',
    inputs: [
      {
        name: 'sessionName',
        type: 'text',
        placeholder: 'Enter new session name',
        value: session.name || ''
      }
    ],
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Save',
        handler: async (data) => {
          if (data.sessionName && data.sessionName.trim() !== '') {
            const index = sessions.value.findIndex(s => s.id === session.id);
            if (index !== -1) {
              sessions.value[index] = { ...sessions.value[index], name: data.sessionName };
            }
          }
        }
      }
    ]
  });
  await alert.present();
};

const handleDeleteSession = async (session: Session) => {
  const alert = await alertController.create({
    header: 'Delete Python Session',
    message: 'Are you sure you want to delete this Python session? This action cannot be undone.',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          try {
            isLoading.value = true;
            await sessionService.deleteSession(session.id);
            sessions.value = sessions.value.filter(s => s.id !== session.id);
            if (selectedSessionId.value === session.id) {
              sessionStore.setCurrentSessionId(null);
            }
          } catch (e: any) {
            error.value = e.message || 'Could not delete Python session.';
          } finally {
            isLoading.value = false;
          }
        }
      }
    ]
  });
  await alert.present();
};

watch(() => authStore.isAuthenticated, (isAuth) => {
  if (isAuth) {
    fetchSessions();
  } else {
    sessions.value = [];
    sessionStore.setCurrentSessionId(null);
  }
});

</script>

<style scoped>
.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tools-header {
  margin-top: 16px;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.api-badge {
  display: flex;
  align-items: center;
}

.api-label {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 500;
  white-space: nowrap;
}

.api-label.fastapi {
  background: var(--ion-color-primary, #3880ff);
  color: var(--ion-color-primary-contrast, #ffffff);
}

.selected-session {
  --background: var(--ion-color-primary, #3880ff);
  --color: #ffffff;
}

.selected-session ion-label,
.selected-session ion-label p,
.selected-session ion-label small {
  color: #ffffff !important;
}

.session-actions {
  display: flex;
  gap: 4px;
}

.session-actions ion-button {
  --color: rgba(255, 255, 255, 0.7);
  --color-hover: #ffffff;
  --color-focused: #ffffff;
}

.selected-session .session-actions ion-button {
  --color: rgba(255, 255, 255, 0.8) !important;
  --color-hover: #ffffff !important;
  --color-focused: #ffffff !important;
}

/* Override the danger color specifically for delete button in selected sessions */
.selected-session .session-actions ion-button[color="danger"] {
  --color: rgba(255, 255, 255, 0.9) !important;
  --color-hover: #ffffff !important;
  --color-focused: #ffffff !important;
  --ion-color-danger: rgba(255, 255, 255, 0.9) !important;
  --ion-color-danger-shade: #ffffff !important;
  --ion-color-danger-tint: rgba(255, 255, 255, 0.7) !important;
}

/* Target the icon specifically */
.selected-session .session-actions ion-button[color="danger"] ion-icon {
  color: rgba(255, 255, 255, 0.9) !important;
}

/* Make the chat bubble icon white in selected sessions */
.selected-session ion-icon[slot="start"] {
  color: #ffffff !important;
}
</style> 