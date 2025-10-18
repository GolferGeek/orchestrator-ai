<template>
  <ion-modal :is-open="isOpen" @did-dismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>
          {{ conversation ? `Tasks - ${formatAgentName(conversation.agentName)}` : 'Tasks' }}
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">
            <ion-icon :icon="closeOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="task-details-content">
        <!-- Conversation Info -->
        <div v-if="conversation" class="conversation-summary">
          <div class="summary-card">
            <h3>Conversation Summary</h3>
            <div class="summary-stats">
              <div class="stat-item">
                <ion-icon :icon="checkmarkCircleOutline" color="success" />
                <span>{{ conversation.completedTasks }} Completed</span>
              </div>
              <div class="stat-item">
                <ion-icon :icon="timeOutline" color="warning" />
                <span>{{ conversation.activeTasks }} Active</span>
              </div>
              <div class="stat-item">
                <ion-icon :icon="closeCircleOutline" color="danger" />
                <span>{{ conversation.failedTasks }} Failed</span>
              </div>
              <div class="stat-item total">
                <ion-icon :icon="listOutline" />
                <span>{{ conversation.taskCount }} Total</span>
              </div>
            </div>
            <p class="last-active">
              Last active: {{ formatTime(conversation.lastActiveAt) }}
            </p>
          </div>
        </div>
        <!-- Task Actions -->
        <div class="task-actions">
          <ion-button
            fill="outline"
            @click="refreshTasks"
            :disabled="loading"
          >
            <ion-icon :icon="refreshOutline" slot="start" />
            Refresh
          </ion-button>
          <ion-button
            fill="solid"
            @click="showCreateTaskModal = true"
            :disabled="!conversation"
          >
            <ion-icon :icon="addOutline" slot="start" />
            New Task
          </ion-button>
        </div>
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <ion-spinner />
          <p>Loading tasks...</p>
        </div>
        <!-- Error State -->
        <div v-if="error" class="error-state">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <p>{{ error }}</p>
          <ion-button @click="refreshTasks">Retry</ion-button>
        </div>
        <!-- Tasks List -->
        <div v-if="!loading && !error" class="tasks-list">
          <div v-if="tasks.length === 0" class="no-tasks">
            <ion-icon :icon="documentOutline" />
            <h3>No Tasks Yet</h3>
            <p>Create a new task to get started</p>
          </div>
          <div
            v-for="task in tasks"
            :key="task.id"
            class="task-item"
            :class="[`status-${task.status}`]"
          >
            <div class="task-header">
              <div class="task-info">
                <h4>{{ task.method }}</h4>
                <div class="task-status">
                  <ion-badge :color="getStatusColor(task.status)">
                    {{ task.status }}
                  </ion-badge>
                  <span class="task-time">
                    {{ formatTime(new Date(task.createdAt)) }}
                  </span>
                </div>
              </div>
              <div class="task-actions-menu">
                <ion-button
                  fill="clear"
                  size="small"
                  @click="toggleTaskDetails(task.id)"
                >
                  <ion-icon :icon="chevronDownOutline" />
                </ion-button>
                <ion-button
                  v-if="task.status === 'running' || task.status === 'pending'"
                  fill="clear"
                  size="small"
                  color="danger"
                  @click="cancelTask(task)"
                >
                  <ion-icon :icon="stopOutline" />
                </ion-button>
              </div>
            </div>
            <!-- Progress Bar -->
            <div v-if="task.status === 'running'" class="task-progress">
              <TaskProgressBar
                :task-id="task.id"
                :initial-progress="task.progress"
                :show-message="true"
                :auto-update="true"
              />
            </div>
            <!-- Task Prompt Preview -->
            <div class="task-prompt">
              <p>{{ truncateText(task.prompt, 150) }}</p>
              <ion-button
                v-if="task.prompt.length > 150"
                fill="clear"
                size="small"
                @click="toggleTaskDetails(task.id)"
              >
                {{ expandedTasks.has(task.id) ? 'Show Less' : 'Show More' }}
              </ion-button>
            </div>
            <!-- Expanded Details -->
            <div v-if="expandedTasks.has(task.id)" class="task-details">
              <ion-accordion-group>
                <!-- Full Prompt -->
                <ion-accordion value="prompt">
                  <ion-item slot="header">
                    <ion-label>Full Prompt</ion-label>
                  </ion-item>
                  <div slot="content" class="task-detail-content">
                    <pre>{{ task.prompt }}</pre>
                  </div>
                </ion-accordion>
                <!-- Response -->
                <ion-accordion v-if="task.response" value="response">
                  <ion-item slot="header">
                    <ion-label>Response</ion-label>
                  </ion-item>
                  <div slot="content" class="task-detail-content">
                    <pre>{{ task.response }}</pre>
                  </div>
                </ion-accordion>
                <!-- Parameters -->
                <ion-accordion v-if="task.params" value="params">
                  <ion-item slot="header">
                    <ion-label>Parameters</ion-label>
                  </ion-item>
                  <div slot="content" class="task-detail-content">
                    <pre>{{ JSON.stringify(task.params, null, 2) }}</pre>
                  </div>
                </ion-accordion>
                <!-- Metadata -->
                <ion-accordion v-if="task.llmMetadata || task.evaluation" value="metadata">
                  <ion-item slot="header">
                    <ion-label>Metadata & Evaluation</ion-label>
                  </ion-item>
                  <div slot="content" class="task-detail-content">
                    <div v-if="task.llmMetadata">
                      <h5>LLM Metadata</h5>
                      <pre>{{ JSON.stringify(task.llmMetadata, null, 2) }}</pre>
                    </div>
                    <div v-if="task.evaluation">
                      <h5>Evaluation</h5>
                      <pre>{{ JSON.stringify(task.evaluation, null, 2) }}</pre>
                    </div>
                  </div>
                </ion-accordion>
                <!-- Error Details -->
                <ion-accordion v-if="task.errorMessage" value="error">
                  <ion-item slot="header">
                    <ion-label>Error Details</ion-label>
                  </ion-item>
                  <div slot="content" class="task-detail-content error-content">
                    <p><strong>Error:</strong> {{ task.errorMessage }}</p>
                    <pre v-if="task.errorData">{{ JSON.stringify(task.errorData, null, 2) }}</pre>
                  </div>
                </ion-accordion>
              </ion-accordion-group>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
    <!-- Create Task Modal -->
    <CreateTaskModal
      :is-open="showCreateTaskModal"
      :conversation="conversation"
      @close="showCreateTaskModal = false"
      @task-created="handleTaskCreated"
    />
  </ion-modal>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonBadge,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
} from '@ionic/vue';
import {
  closeOutline,
  refreshOutline,
  addOutline,
  alertCircleOutline,
  documentOutline,
  chevronDownOutline,
  stopOutline,
  checkmarkCircleOutline,
  timeOutline,
  closeCircleOutline,
  listOutline,
} from 'ionicons/icons';
import { tasksService } from '@/services/tasksService';
import TaskProgressBar from './TaskProgressBar.vue';
import CreateTaskModal from './CreateTaskModal.vue';
interface Task {
  id: string;
  agentConversationId: string;
  userId: string;
  method: string;
  prompt: string;
  params?: Record<string, unknown>;
  response?: string;
  responseMetadata?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progressMessage?: string;
  evaluation?: Record<string, unknown>;
  llmMetadata?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  errorData?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  timeoutSeconds: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface Conversation {
  id: string;
  agentName: string;
  agentType: string;
  startedAt: Date;
  lastActiveAt: Date;
  endedAt?: Date;
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
  metadata?: Record<string, unknown>;
}
// Props
const props = defineProps<{
  isOpen: boolean;
  conversation: Conversation | null;
}>();
// Events
const emit = defineEmits<{
  close: [];
  'task-action': [action: string, taskId: string];
}>();
// Reactive state
const loading = ref(false);
const error = ref<string | null>(null);
const tasks = ref<Task[]>([]);
const expandedTasks = ref(new Set<string>());
const showCreateTaskModal = ref(false);
// Methods
const refreshTasks = async () => {
  if (!props.conversation) return;
  loading.value = true;
  error.value = null;
  try {
    const response = await tasksService.listTasks({
      conversationId: props.conversation.id,
      limit: 100,
    });
    tasks.value = response.tasks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    // Subscribe to progress updates for running tasks
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tasks';
  } finally {
    loading.value = false;
  }
};
const toggleTaskDetails = (taskId: string) => {
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId);
  } else {
    expandedTasks.value.add(taskId);
  }
};
const cancelTask = async (task: Task) => {
  try {
    await tasksService.cancelTask(task.id);
    await refreshTasks();
    emit('task-action', 'cancel', task.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to cancel task';
  }
};
const handleTaskCreated = () => {
  showCreateTaskModal.value = false;
  refreshTasks();
};
// Utility functions
const formatAgentName = (name: string) => {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};
const truncateText = (text: string, maxLength: number) => {
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
};
const getStatusColor = (status: string) => {
  const colors = {
    pending: 'medium',
    running: 'primary',
    completed: 'success',
    failed: 'danger',
    cancelled: 'warning',
  };
  return colors[status as keyof typeof colors] || 'medium';
};
// Watch for conversation changes
watch(() => props.conversation, (newConversation) => {
  if (newConversation && props.isOpen) {
    refreshTasks();
  }
}, { immediate: true });
// Watch for modal open/close
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && props.conversation) {
      refreshTasks();
    }
  },
  { immediate: true },
);
</script>
<style scoped>
.task-details-content {
  padding: 16px;
}
.conversation-summary {
  margin-bottom: 24px;
}
.summary-card {
  background: var(--ion-color-step-50);
  border-radius: 12px;
  padding: 16px;
}
.summary-card h3 {
  margin: 0 0 12px 0;
  color: var(--ion-color-primary);
}
.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
}
.stat-item.total {
  font-weight: 600;
  color: var(--ion-color-primary);
}
.last-active {
  margin: 0;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}
.task-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}
.error-state {
  color: var(--ion-color-danger);
}
.no-tasks {
  text-align: center;
  padding: 48px 24px;
  color: var(--ion-color-medium);
}
.no-tasks ion-icon {
  font-size: 3em;
  margin-bottom: 16px;
}
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.task-item {
  background: var(--ion-color-step-50);
  border-radius: 12px;
  padding: 16px;
  border-left: 4px solid var(--ion-color-medium);
}
.task-item.status-running {
  border-left-color: var(--ion-color-primary);
}
.task-item.status-completed {
  border-left-color: var(--ion-color-success);
}
.task-item.status-failed {
  border-left-color: var(--ion-color-danger);
}
.task-item.status-cancelled {
  border-left-color: var(--ion-color-warning);
}
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.task-info h4 {
  margin: 0 0 6px 0;
  font-weight: 600;
}
.task-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.task-time {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}
.task-actions-menu {
  display: flex;
  gap: 4px;
}
.task-progress {
  margin-bottom: 12px;
}
.task-prompt {
  margin-bottom: 8px;
}
.task-prompt p {
  margin: 0 0 4px 0;
  line-height: 1.4;
}
.task-details {
  margin-top: 16px;
}
.task-detail-content {
  padding: 12px;
  background: var(--ion-color-step-100);
  border-radius: 8px;
}
.task-detail-content pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85em;
  line-height: 1.4;
}
.task-detail-content h5 {
  margin: 0 0 8px 0;
  color: var(--ion-color-primary);
}
.error-content {
  background: var(--ion-color-danger-tint);
  border: 1px solid var(--ion-color-danger);
}
</style>
