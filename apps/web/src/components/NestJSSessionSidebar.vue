<template>
  <ion-list>
    <ion-list-header>
      <div class="sidebar-header">
        <span>NestJS Sessions</span>
        <div class="api-badge">
          <span class="api-label nestjs">NestJS</span>
        </div>
      </div>
    </ion-list-header>
    
    <ion-item button @click="handleCreateNewSession" lines="none">
      <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
      <ion-label>New NestJS Chat</ion-label>
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
          <p>{{ session.name || 'NestJS Chat on ' + formatDate(session.created_at) }}</p>
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
            <p><small>No NestJS sessions yet.</small></p>
        </ion-label>
    </ion-item>

    <!-- NestJS specific tools section -->
    <ion-list-header class="tools-header">
      <span>NestJS Tools</span>
    </ion-list-header>
    
    <ion-item button lines="none" @click="handleNestJSAgentsList">
      <ion-icon :icon="peopleOutline" slot="start"></ion-icon>
      <ion-label>View NestJS Agents</ion-label>
    </ion-item>
    
    <ion-item button lines="none" @click="handleNestJSHealth">
      <ion-icon :icon="heartOutline" slot="start"></ion-icon>
      <ion-label>API Health Check</ion-label>
    </ion-item>
    
    <ion-item button lines="none" @click="handleAgentPool">
      <ion-icon :icon="layersOutline" slot="start"></ion-icon>
      <ion-label>Agent Pool Status</ion-label>
    </ion-item>
  </ion-list>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonMenuToggle, IonSpinner, IonText, alertController, IonButton } from '@ionic/vue';
import { addCircleOutline, chatbubbleEllipsesOutline, createOutline, trashOutline, peopleOutline, heartOutline, layersOutline } from 'ionicons/icons';
import { sessionService, Session } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { storeToRefs } from 'pinia';
import { apiManager } from '../services/apiManager';

const authStore = useAuthStore();
const sessionStore = useSessionStore();

const sessions = ref<Session[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const { currentSessionId: selectedSessionId } = storeToRefs(sessionStore);

// Ensure we're using NestJS endpoint when this sidebar is loaded
onMounted(async () => {
  const nestjsEndpoint = apiManager.availableEndpoints.find(ep => ep.technology === 'typescript-nestjs');
  if (nestjsEndpoint && apiManager.currentEndpoint.technology !== 'typescript-nestjs') {
    await apiManager.switchToEndpoint(nestjsEndpoint);
  }
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
    error.value = e.message || 'Could not load NestJS sessions.';
  } finally {
    isLoading.value = false;
  }
};

const selectSession = (sessionId: string) => {
  console.log('Selected NestJS session:', sessionId);
  sessionStore.setCurrentSessionId(sessionId);
};

const handleCreateNewSession = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const newSession = await sessionService.createSession({ name: 'New NestJS Chat' });
    sessions.value.unshift(newSession);
    selectSession(newSession.id);
  } catch (e: any) {
    error.value = e.message || 'Could not create new NestJS session.';
  } finally {
    isLoading.value = false;
  }
};

const handleNestJSAgentsList = () => {
  // Trigger a request to show available NestJS agents
  if (selectedSessionId.value) {
    console.log('Requesting NestJS agents list');
    // You could emit an event here or use a different mechanism
  }
};

const handleNestJSHealth = async () => {
  try {
    // Check NestJS health status
    const response = await fetch('http://localhost:4000/health');
    const healthData = await response.json();
    
    const alert = await alertController.create({
      header: 'NestJS Health Status',
      message: `Status: ${response.ok ? 'Healthy' : 'Unhealthy'}\nResponse: ${JSON.stringify(healthData, null, 2)}`,
      buttons: ['OK']
    });
    await alert.present();
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'NestJS Health Check Failed',
      message: `Error: ${error.message}`,
      buttons: ['OK']
    });
    await alert.present();
  }
};

const handleAgentPool = async () => {
  try {
    // Check agent pool status - this is NestJS specific
    const response = await fetch('http://localhost:4000/agent-pool');
    const poolData = await response.json();
    
    const alert = await alertController.create({
      header: 'Agent Pool Status',
      message: `Active Agents: ${poolData.agents?.length || 0}\nDetails: ${JSON.stringify(poolData, null, 2)}`,
      buttons: ['OK']
    });
    await alert.present();
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'Agent Pool Check Failed',
      message: `Error: ${error.message}`,
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
    header: 'Rename NestJS Session',
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
    header: 'Delete NestJS Session',
    message: 'Are you sure you want to delete this NestJS session? This action cannot be undone.',
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
            error.value = e.message || 'Could not delete NestJS session.';
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

.api-label.nestjs {
  background: var(--ion-color-secondary, #3dc2ff);
  color: var(--ion-color-secondary-contrast, #ffffff);
}

.selected-session {
  --background: var(--ion-color-secondary-tint);
  --color: var(--ion-color-secondary-contrast);
}

.session-actions {
  display: flex;
  gap: 4px;
}
</style> 