<template>
  <ion-list>
    <ion-list-header>
      <div class="sidebar-header">
        <span>Sessions</span>
        <ion-button fill="clear" size="small" @click="handleCreateNewSession">
          <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
          New
        </ion-button>
      </div>
    </ion-list-header>
    
    <div v-if="isLoading" class="loading-container">
      <ion-spinner name="crescent" size="small"></ion-spinner>
    </div>
    
    <div v-if="error" class="error-container">
      <ion-text color="danger"><small>{{ error }}</small></ion-text>
    </div>

    <!-- Session Groups -->
    <div v-if="!isLoading && groupedSessions">
      <!-- Today Sessions -->
      <div v-if="groupedSessions.today.length > 0" class="session-group">
        <div class="session-group-header">Today</div>
        <ion-menu-toggle :auto-hide="false" v-for="session in groupedSessions.today" :key="session.id">
          <div 
            class="session-item"
            :class="{ 'selected': session.id === selectedSessionId }"
            @click="() => selectSession(session.id)"
          >
            <div class="session-content">
              <div 
                class="session-name"
                :class="{ 'editing': editingSessionId === session.id }"
                @click.stop="editingSessionId === session.id ? null : startEditingSession(session)"
              >
                <input 
                  v-if="editingSessionId === session.id"
                  v-model="editingSessionName"
                  @blur="saveSessionName(session)"
                  @keyup.enter="saveSessionName(session)"
                  @keyup.escape="cancelEditingSession()"
                  ref="editInput"
                  class="session-name-input"
                />
                <span v-else>{{ getDisplayName(session) }}</span>
              </div>
              <div class="session-meta">
                <span class="session-time">{{ formatTime(session.updated_at) }}</span>
                <span v-if="getSessionAgents(session).length > 0" class="session-agents">
                  {{ getSessionAgents(session).join(', ') }}
                </span>
              </div>
            </div>
            <div class="session-actions">
              <ion-button fill="clear" size="small" @click.stop="() => handleDeleteSession(session)">
                <ion-icon :icon="trashOutline" size="small"></ion-icon>
              </ion-button>
            </div>
          </div>
        </ion-menu-toggle>
      </div>

      <!-- Yesterday Sessions -->
      <div v-if="groupedSessions.yesterday.length > 0" class="session-group">
        <div class="session-group-header">Yesterday</div>
        <ion-menu-toggle :auto-hide="false" v-for="session in groupedSessions.yesterday" :key="session.id">
          <div 
            class="session-item"
            :class="{ 'selected': session.id === selectedSessionId }"
            @click="() => selectSession(session.id)"
          >
            <div class="session-content">
              <div 
                class="session-name"
                @click.stop="startEditingSession(session)"
              >
                <span>{{ getDisplayName(session) }}</span>
              </div>
              <div class="session-meta">
                <span class="session-time">{{ formatTime(session.updated_at) }}</span>
              </div>
            </div>
            <div class="session-actions">
              <ion-button fill="clear" size="small" @click.stop="() => handleDeleteSession(session)">
                <ion-icon :icon="trashOutline" size="small"></ion-icon>
              </ion-button>
            </div>
          </div>
        </ion-menu-toggle>
      </div>

      <!-- Older Sessions -->
      <div v-if="groupedSessions.older.length > 0" class="session-group">
        <div class="session-group-header collapsible" @click="toggleOlderSessions">
          <ion-icon :icon="showOlderSessions ? chevronDownOutline : chevronForwardOutline" size="small"></ion-icon>
          Older ({{ groupedSessions.older.length }})
        </div>
        <div v-show="showOlderSessions">
          <ion-menu-toggle :auto-hide="false" v-for="session in groupedSessions.older" :key="session.id">
            <div 
              class="session-item"
              :class="{ 'selected': session.id === selectedSessionId }"
              @click="() => selectSession(session.id)"
            >
              <div class="session-content">
                <div class="session-name">
                  <span>{{ getDisplayName(session) }}</span>
                </div>
                <div class="session-meta">
                  <span class="session-time">{{ formatDate(session.updated_at) }}</span>
                </div>
              </div>
              <div class="session-actions">
                <ion-button fill="clear" size="small" @click.stop="() => handleDeleteSession(session)">
                  <ion-icon :icon="trashOutline" size="small"></ion-icon>
                </ion-button>
              </div>
            </div>
          </ion-menu-toggle>
        </div>
      </div>
    </div>

    <div v-if="!isLoading && sessions.length === 0 && !error" class="empty-state">
      <p><small>No sessions yet.</small></p>
      <ion-button fill="clear" size="small" @click="handleCreateNewSession">
        <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
        Create your first session
      </ion-button>
    </div>

    <!-- Agent Conversations -->
    <div class="agents-section">
      <div class="session-group-header collapsible" @click="toggleAgentsSection">
        <ion-icon :icon="showAgentsSection ? chevronDownOutline : chevronForwardOutline" size="small"></ion-icon>
        Agent Conversations
      </div>
      <div v-show="showAgentsSection">
        <AgentTreeView 
          @conversation-selected="handleConversationSelected"
          @agent-selected="handleAgentSelected"
          compact-mode
        />
      </div>
    </div>

    <!-- Developer Tools -->
    <div class="tools-section">
      <div class="session-group-header">Developer Tools</div>
      <div class="tool-item" @click="handleApiHealth">
        <ion-icon :icon="heartOutline" size="small"></ion-icon>
        <span>API Health</span>
      </div>
      <div class="tool-item" @click="handleAgentPool">
        <ion-icon :icon="layersOutline" size="small"></ion-icon>
        <span>Agent Pool</span>
      </div>
    </div>
  </ion-list>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonMenuToggle, IonSpinner, IonText, alertController, IonButton } from '@ionic/vue';
import { addCircleOutline, chatbubbleEllipsesOutline, createOutline, trashOutline, heartOutline, layersOutline, chevronDownOutline, chevronForwardOutline } from 'ionicons/icons';
import { sessionService, Session } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { storeToRefs } from 'pinia';
import { apiService } from '../services/apiService';
import AgentTreeView from '@/components/AgentTreeView.vue';

const authStore = useAuthStore();
const sessionStore = useSessionStore();

const sessions = ref<Session[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Session editing state
const editingSessionId = ref<string | null>(null);
const editingSessionName = ref<string>('');
const editInput = ref<HTMLInputElement | null>(null);

// UI state
const showOlderSessions = ref(false);
const showAgentsSection = ref(true);

const { currentSessionId: selectedSessionId } = storeToRefs(sessionStore);

// Helper functions for date/time formatting
const isToday = (date: string) => {
  const today = new Date();
  const sessionDate = new Date(date);
  return today.toDateString() === sessionDate.toDateString();
};

const isYesterday = (date: string) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sessionDate = new Date(date);
  return yesterday.toDateString() === sessionDate.toDateString();
};

const formatTime = (date: string) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDisplayName = (session: Session) => {
  if (session.name && session.name !== 'New Orchestrator AI Chat') {
    return session.name;
  }
  // Auto-generate name based on date/time
  const date = new Date(session.created_at);
  if (isToday(session.created_at)) {
    return `Chat ${formatTime(session.created_at)}`;
  }
  return `Chat ${date.toLocaleDateString()}`;
};

const getSessionAgents = (session: Session) => {
  // TODO: Extract agents from session messages when available
  // For now, return empty array
  return [];
};

// Computed property for grouped sessions
const groupedSessions = computed(() => {
  const groups = {
    today: [] as Session[],
    yesterday: [] as Session[],
    older: [] as Session[]
  };

  sessions.value.forEach(session => {
    if (isToday(session.updated_at)) {
      groups.today.push(session);
    } else if (isYesterday(session.updated_at)) {
      groups.yesterday.push(session);
    } else {
      groups.older.push(session);
    }
  });

  // Sort each group by updated_at descending
  groups.today.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  groups.yesterday.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  groups.older.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return groups;
});

// Get API base URL from environment variables
const getApiBaseUrl = () => {
        return import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:4000';
};

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
    sessions.value = Array.isArray(response.sessions) ? response.sessions : [];
  } catch (e: any) {
          error.value = e.message || 'Could not load Orchestrator AI sessions.';
  } finally {
    isLoading.value = false;
  }
};

const selectSession = (sessionId: string) => {
  console.log('Selected session:', sessionId);
  sessionStore.setCurrentSessionId(sessionId);
};

// Session editing functions
const startEditingSession = async (session: Session) => {
  editingSessionId.value = session.id;
  editingSessionName.value = session.name || getDisplayName(session);
  
  await nextTick();
  if (editInput.value) {
    editInput.value.focus();
    editInput.value.select();
  }
};

const saveSessionName = async (session: Session) => {
  if (editingSessionName.value.trim() && editingSessionName.value !== session.name) {
    try {
      // Update session name via API
      await sessionService.updateSessionName?.(session.id, editingSessionName.value.trim());
      
      // Update local sessions array
      const sessionIndex = sessions.value.findIndex(s => s.id === session.id);
      if (sessionIndex !== -1) {
        sessions.value[sessionIndex].name = editingSessionName.value.trim();
      }
    } catch (error) {
      console.error('Failed to update session name:', error);
      // Could show error toast here
    }
  }
  
  cancelEditingSession();
};

const cancelEditingSession = () => {
  editingSessionId.value = null;
  editingSessionName.value = '';
};

// UI functions
const toggleOlderSessions = () => {
  showOlderSessions.value = !showOlderSessions.value;
};

const toggleAgentsSection = () => {
  showAgentsSection.value = !showAgentsSection.value;
};

// Agent event handlers
const handleConversationSelected = (conversation: any) => {
  console.log('[SessionSidebar] Conversation selected:', conversation);
  // TODO: Switch to agent conversation view
};

const handleAgentSelected = (agent: any) => {
  console.log('[SessionSidebar] Agent selected:', agent);
  // TODO: Start new conversation with agent
};

const handleCreateNewSession = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    // Auto-generate a session name based on current time
    const now = new Date();
    const autoName = `Chat ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const newSession = await sessionService.createSession({ name: autoName });
    // Ensure sessions.value is an array before unshift
    if (!Array.isArray(sessions.value)) {
      sessions.value = [];
    }
    sessions.value.unshift(newSession);
    
    // Create the welcome message
    const welcomeMessage = {
      id: `orchestrator-welcome-${Date.now()}`,
      session_id: newSession.id,
      user_id: 'orchestrator',
      role: 'assistant' as const,
      content: `Welcome ${authStore.user?.displayName || authStore.user?.email || 'there'}, good to see you! 👋\n\nI'm your Orchestrator AI. How can I help you today?`,
      timestamp: new Date().toISOString(),
      order: 1,
      metadata: {
        agentName: 'Orchestrator AI'
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
          error.value = e.message || 'Could not create new Orchestrator AI session.';
  } finally {
    isLoading.value = false;
  }
};

const handleApiHealth = async () => {
  const apiBaseUrl = getApiBaseUrl();
  try {
    // Use dedicated NestJS API service for health check
    const isHealthy = await apiService.healthCheck();
    
    if (isHealthy) {
      const alert = await alertController.create({
        header: 'Orchestrator AI API Health Check',
        message: `✅ Status: Healthy\n📡 Endpoint: ${apiBaseUrl}/health\n🔵 Orchestrator AI API is running normally`,
        buttons: ['OK'],
        cssClass: 'formatted-alert'
      });
      await alert.present();
    } else {
      const alert = await alertController.create({
        header: 'Orchestrator AI API Health Check',
        message: `❌ Status: Unhealthy\n📡 Endpoint: ${apiBaseUrl}/health\n🔴 Orchestrator AI API is not responding correctly`,
        buttons: ['OK'],
        cssClass: 'formatted-alert'
      });
      await alert.present();
    }
  } catch (error: any) {
    const alert = await alertController.create({
              header: 'Orchestrator AI Health Check Failed',
        message: `❌ Could not connect to Orchestrator AI API\n\n🔗 Endpoint: ${apiBaseUrl}/health\n💥 Error: ${error.message}\n\n💡 Make sure the Orchestrator AI server is running on the configured port`,
      buttons: ['OK'],
      cssClass: 'formatted-alert'
    });
    await alert.present();
  }
};

const handleAgentPool = async () => {
  const apiBaseUrl = getApiBaseUrl();
  try {
    // Use dedicated NestJS API service for agent pool operations
    const [poolStats, agents] = await Promise.all([
      apiService.getAgentPoolStats(),
      apiService.getRegisteredAgents()
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
    
    formattedMessage += `📡 Endpoint: ${apiBaseUrl}/agent-pool/\n`;
    
    const alert = await alertController.create({
              header: 'Orchestrator AI Agent Pool Status',
      message: formattedMessage,
      buttons: ['OK'],
      cssClass: 'formatted-alert'
    });
    await alert.present();
  } catch (error: any) {
    const alert = await alertController.create({
      header: 'Agent Pool Check Failed',
      message: `❌ Could not connect to Agent Pool\n\n🔗 Endpoint: ${apiBaseUrl}/agent-pool/stats\n💥 Error: ${error.message}\n\n💡 Make sure the Orchestrator AI server is running on the configured port`,
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
    header: 'Rename Orchestrator AI Session',
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
    header: 'Delete Orchestrator AI Session',
    message: 'Are you sure you want to delete this Orchestrator AI session? This action cannot be undone.',
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
            error.value = e.message || 'Could not delete Orchestrator AI session.';
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
  padding: 8px 0;
}

.sidebar-header span {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Loading and Error States */
.loading-container {
  display: flex;
  justify-content: center;
  padding: 12px;
}

.error-container {
  padding: 8px 16px;
  text-align: center;
}

.empty-state {
  padding: 20px 16px;
  text-align: center;
  color: var(--ion-color-medium);
}

/* Session Groups */
.session-group {
  margin-bottom: 8px;
}

.session-group-header {
  padding: 8px 16px 4px 16px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.session-group-header.collapsible {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  user-select: none;
}

.session-group-header.collapsible:hover {
  color: var(--ion-color-primary);
}

/* Session Items */
.session-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-left: 3px solid transparent;
}

.session-item:hover {
  background-color: var(--ion-color-light);
}

.session-item.selected {
  background-color: var(--ion-color-primary-tint);
  border-left-color: var(--ion-color-primary);
}

.session-content {
  flex: 1;
  min-width: 0; /* Allows text to truncate */
}

.session-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ion-color-dark);
  margin-bottom: 2px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-name.editing {
  cursor: default;
}

.session-name:hover:not(.editing) {
  color: var(--ion-color-primary);
}

.session-name-input {
  width: 100%;
  border: 1px solid var(--ion-color-primary);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.9rem;
  font-weight: 500;
  background: white;
  outline: none;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.session-time {
  white-space: nowrap;
}

.session-agents {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.session-agents::before {
  content: "•";
  margin-right: 4px;
}

.session-actions {
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.session-item:hover .session-actions {
  opacity: 1;
}

/* Agent Conversations */
.agents-section {
  margin-top: 20px;
  border-top: 1px solid var(--ion-color-light);
  padding-top: 12px;
}

.agents-section :deep(.agent-tree-view) {
  width: 100%;
  min-width: 300px;
}

/* Developer Tools */
.tools-section {
  margin-top: 20px;
  border-top: 1px solid var(--ion-color-light);
  padding-top: 12px;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  transition: color 0.2s ease;
}

.tool-item:hover {
  color: var(--ion-color-primary);
  background-color: var(--ion-color-light);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .session-item {
    padding: 10px 12px;
  }
  
  .session-group-header {
    padding: 8px 12px 4px 12px;
  }
  
  .session-agents {
    display: none; /* Hide agent names on mobile to save space */
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .session-item.selected {
    background-color: var(--ion-color-primary-shade);
  }
  
  .session-name-input {
    background: var(--ion-color-dark);
    color: var(--ion-color-light);
    border-color: var(--ion-color-primary);
  }
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