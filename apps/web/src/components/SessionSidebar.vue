<template>
  <ion-list>
    <ion-list-header>Chat Sessions</ion-list-header>
    <ion-item button @click="handleCreateNewSession" lines="none">
      <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
      <ion-label>New Chat</ion-label>
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
          <p>{{ session.name || 'Chat on ' + formatDate(session.created_at) }}</p>
          <p><small>Updated: {{ formatRelativeDate(session.updated_at) }}</small></p>
        </ion-label>
        <ion-button fill="clear" slot="end" @click.stop="() => handleEditSessionName(session)">
          <ion-icon :icon="createOutline" slot="icon-only"></ion-icon>
        </ion-button>
      </ion-item>
    </ion-menu-toggle>

    <ion-item v-if="!isLoading && sessions.length === 0 && !error" lines="none">
        <ion-label class="ion-text-center ion-padding-top">
            <p><small>No chat sessions yet.</small></p>
        </ion-label>
    </ion-item>
  </ion-list>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { IonList, IonListHeader, IonItem, IonLabel, IonIcon, IonMenuToggle, IonSpinner, IonText, alertController, IonButton } from '@ionic/vue';
import { addCircleOutline, chatbubbleEllipsesOutline, createOutline } from 'ionicons/icons';
import { sessionService, Session } from '@/services/sessionService';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore'; // We'll create this next
import { storeToRefs } from 'pinia';

const authStore = useAuthStore();
const sessionStore = useSessionStore();

const sessions = ref<Session[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

const { currentSessionId: selectedSessionId } = storeToRefs(sessionStore); // To highlight selected session

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
    error.value = e.message || 'Could not load sessions.';
  } finally {
    isLoading.value = false;
  }
};

const selectSession = (sessionId: string) => {
  console.log('Selected session:', sessionId);
  sessionStore.setCurrentSessionId(sessionId);
  // Potentially emit an event or use router to navigate if needed, 
  // or HomePage can watch currentSessionId from the store.
};

const handleCreateNewSession = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const newSession = await sessionService.createSession({ name: 'New Chat' }); // Or prompt for name
    sessions.value.unshift(newSession); // Add to top of the list
    selectSession(newSession.id);
  } catch (e: any) {
    error.value = e.message || 'Could not create new session.';
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  // This can be replaced with a proper date formatting library like date-fns for "X minutes ago"
  return date.toLocaleString(); 
};

const handleEditSessionName = async (session: Session) => {
  const alert = await alertController.create({
    header: 'Rename Session',
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
            console.log('Attempting to rename session', session.id, 'to', data.sessionName);
            // TODO: Implement actual API call to backend to update session name
            // e.g., await sessionService.updateSessionName(session.id, data.sessionName);
            // Then refresh the session list or update the specific session in the ref
            const index = sessions.value.findIndex(s => s.id === session.id);
            if (index !== -1) {
              sessions.value[index] = { ...sessions.value[index], name: data.sessionName };
            }
            // Or simply call fetchSessions(); to refresh the whole list
            // fetchSessions(); 
          } else {
            // Handle empty name if needed, e.g., show another alert or do nothing
            console.warn('Session name cannot be empty');
          }
        }
      }
    ]
  });
  await alert.present();
};

// Fetch sessions when the component is mounted and when authentication status changes
onMounted(fetchSessions);
watch(() => authStore.isAuthenticated, (isAuth) => {
  if (isAuth) {
    fetchSessions();
  } else {
    sessions.value = []; // Clear sessions if logged out
    sessionStore.setCurrentSessionId(null); // Clear selected session
  }
});

</script>

<style scoped>
.selected-session {
  --background: var(--ion-color-light-tint);
  /* Or use --ion-item-background with a specific color */
}
ion-label p small {
    font-size: 0.75em;
    color: var(--ion-color-medium-shade);
}
</style> 