<template>
  <ion-list>
    <ion-list-header>
      <div class="sidebar-header">
        <span>JavaScript Sessions</span>
        <div class="api-badge">
          <span class="api-label nestjs">JavaScript</span>
        </div>
      </div>
    </ion-list-header>
    
    <ion-item button @click="handleCreateNewSession" lines="none">
      <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
      <ion-label>New JavaScript Chat</ion-label>
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
          <p>{{ session.name || 'JavaScript Chat on ' + formatDate(session.created_at) }}</p>
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
            <p><small>No JavaScript sessions yet.</small></p>
        </ion-label>
    </ion-item>

    <!-- JavaScript specific tools section -->
    <ion-list-header class="tools-header">
      <span>JavaScript Tools</span>
    </ion-list-header>
    
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
import { addCircleOutline, chatbubbleEllipsesOutline, createOutline, trashOutline, heartOutline, layersOutline } from 'ionicons/icons';
import { sessionService, Session } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { storeToRefs } from 'pinia';
import { nestjsApiService } from '../services/nestjsApiService';

const authStore = useAuthStore();
const sessionStore = useSessionStore();

const sessions = ref<Session[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const { currentSessionId: selectedSessionId } = storeToRefs(sessionStore);

// No need to switch API managers - we use dedicated NestJS service
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
    error.value = e.message || 'Could not load JavaScript sessions.';
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
    const newSession = await sessionService.createSession({ name: 'New JavaScript Chat' });
    sessions.value.unshift(newSession);
    
    // Create the welcome message
    const welcomeMessage = {
      id: `orchestrator-welcome-${Date.now()}`,
      session_id: newSession.id,
      user_id: 'orchestrator',
      role: 'assistant' as const,
      content: `Welcome ${authStore.user?.display_name || authStore.user?.email || 'there'}, good to see you! 👋\n\nI'm your JavaScript orchestrator. How can I help you today?`,
      timestamp: new Date().toISOString(),
      order: 1,
      metadata: {
        agentName: 'JavaScript Orchestrator'
      }
    };
    
    console.log('Setting welcome message for new session:', welcomeMessage);
    
    // Set the session ID - this will trigger fetchMessagesForCurrentSession
    sessionStore.setCurrentSessionId(newSession.id);
    
    // Wait for the fetch to complete, then add our welcome message
    // We need to wait for the loading to finish first
    const checkAndAddWelcome = () => {
      if (!sessionStore.isLoadingMessages) {
        console.log('Adding welcome message after fetch completed');
        sessionStore.addMessageToCurrentSession(welcomeMessage);
        console.log('Welcome message added, current messages count:', sessionStore.currentSessionMessages.length);
      } else {
        console.log('Still loading messages, waiting...');
        setTimeout(checkAndAddWelcome, 50);
      }
    };
    
    // Start checking immediately
    setTimeout(checkAndAddWelcome, 50);
    
    console.log('Session ID set, welcome message will be added after fetch completes');
  } catch (e: any) {
    error.value = e.message || 'Could not create new JavaScript session.';
  } finally {
    isLoading.value = false;
  }
};

const handleNestJSHealth = async () => {
  try {
    // Use dedicated NestJS API service for health check
    const isHealthy = await nestjsApiService.healthCheck();
    
    if (isHealthy) {
      const alert = await alertController.create({
        header: 'JavaScript API Health Check',
        message: `✅ Status: Healthy\n📡 Endpoint: http://localhost:4000/health\n🔵 JavaScript API is running normally`,
        buttons: ['OK'],
        cssClass: 'formatted-alert'
      });
      await alert.present();
    } else {
      const alert = await alertController.create({
        header: 'JavaScript API Health Check',
        message: `❌ Status: Unhealthy\n📡 Endpoint: http://localhost:4000/health\n🔴 JavaScript API is not responding correctly`,
        buttons: ['OK'],
        cssClass: 'formatted-alert'
      });
      await alert.present();
    }
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'JavaScript Health Check Failed',
      message: `❌ Could not connect to JavaScript API\n\n🔗 Endpoint: http://localhost:4000/health\n💥 Error: ${error.message}\n\n💡 Make sure the JavaScript server is running on port 4000`,
      buttons: ['OK'],
      cssClass: 'formatted-alert'
    });
    await alert.present();
  }
};

const handleAgentPool = async () => {
  try {
    // Use dedicated NestJS API service for agent pool operations
    const [poolStats, agents] = await Promise.all([
      nestjsApiService.getAgentPoolStats(),
      nestjsApiService.getRegisteredAgents()
    ]);
    
    // Format the agent pool data nicely
    let formattedMessage = `🤖 Pool Statistics:\n`;
    formattedMessage += `   Total: ${poolStats.total || 0}\n`;
    formattedMessage += `   Online: ${poolStats.online || 0}\n`;
    formattedMessage += `   Offline: ${poolStats.offline || 0}\n\n`;
    
    if (poolStats.byType) {
      formattedMessage += `📊 Agents by Type:\n`;
      if (poolStats.byType.orchestrator > 0) formattedMessage += `   🎯 Orchestrator: ${poolStats.byType.orchestrator}\n`;
      if (poolStats.byType.specialist > 0) formattedMessage += `   🔧 Specialist: ${poolStats.byType.specialist}\n`;
      if (poolStats.byType.manager > 0) formattedMessage += `   👔 Manager: ${poolStats.byType.manager}\n`;
      if (poolStats.byType.external > 0) formattedMessage += `   🌐 External: ${poolStats.byType.external}\n`;
      formattedMessage += `\n`;
    }
    
    if (agents && agents.length > 0) {
      formattedMessage += `✅ Registered Agents:\n`;
      agents.forEach((agent: any, index: number) => {
        const statusIcon = agent.status === 'online' ? '🟢' : '🔴';
        formattedMessage += `${index + 1}. ${statusIcon} ${agent.name || agent.id}\n`;
        if (agent.type) formattedMessage += `   Type: ${agent.type}\n`;
        if (agent.description) formattedMessage += `   Description: ${agent.description}\n`;
        if (agent.capabilities && agent.capabilities.length > 0) {
          formattedMessage += `   Capabilities: ${agent.capabilities.slice(0, 3).join(', ')}${agent.capabilities.length > 3 ? '...' : ''}\n`;
        }
        if (agent.lastHeartbeat) {
          const lastSeen = new Date(agent.lastHeartbeat).toLocaleTimeString();
          formattedMessage += `   Last Seen: ${lastSeen}\n`;
        }
        formattedMessage += `\n`;
      });
    } else {
      formattedMessage += `ℹ️ No agents currently registered in the pool\n`;
    }
    
    formattedMessage += `📡 Endpoint: http://localhost:4000/agent-pool/\n`;
    
    const alert = await alertController.create({
      header: 'JavaScript Agent Pool Status',
      message: formattedMessage,
      buttons: ['OK'],
      cssClass: 'formatted-alert'
    });
    await alert.present();
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'Agent Pool Check Failed',
      message: `❌ Could not connect to Agent Pool\n\n🔗 Endpoint: http://localhost:4000/agent-pool/stats\n💥 Error: ${error.message}\n\n💡 Make sure the JavaScript server is running on port 4000`,
      buttons: ['OK'],
      cssClass: 'formatted-alert'
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
    header: 'Rename JavaScript Session',
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
    header: 'Delete JavaScript Session',
    message: 'Are you sure you want to delete this JavaScript session? This action cannot be undone.',
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
            error.value = e.message || 'Could not delete JavaScript session.';
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
  --background: var(--ion-color-secondary, #3dc2ff);
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

/* Improve alert dialog formatting */
:global(.formatted-alert .alert-message) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace !important;
  white-space: pre-line !important;
  text-align: left !important;
  line-height: 1.4 !important;
  font-size: 14px !important;
}
</style> 