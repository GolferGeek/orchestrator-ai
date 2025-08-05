<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/projects"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ project?.name || 'Project Details' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            v-if="project?.status === 'active'"
            fill="clear"
            color="warning"
            @click="pauseProject"
          >
            <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
            Pause
          </ion-button>
          <ion-button 
            v-if="project?.status === 'paused'"
            fill="clear"
            color="success"
            @click="resumeProject"
          >
            <ion-icon :icon="playOutline" slot="start"></ion-icon>
            Resume
          </ion-button>
          <ion-button 
            fill="clear"
            @click="openOptionsMenu"
          >
            <ion-icon :icon="ellipsisVerticalOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">{{ project?.name }}</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Refresher -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div v-if="isLoading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading project details...</p>
      </div>

      <div v-if="error && !isLoading" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger" class="error-icon"></ion-icon>
        <h3>Failed to load project</h3>
        <p>{{ error }}</p>
        <ion-button @click="fetchProject" fill="outline">
          <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
          Retry
        </ion-button>
      </div>

      <div v-if="project && !isLoading" class="project-detail-container">
        <!-- Project Overview -->
        <div class="overview-section">
          <ion-card>
            <ion-card-header>
              <div class="project-header">
                <div class="project-title-section">
                  <ion-card-title>{{ project.name }}</ion-card-title>
                  <ion-card-subtitle>{{ project.description }}</ion-card-subtitle>
                </div>
                <ion-badge 
                  :color="getStatusColor(project.status)"
                  class="status-badge"
                >
                  {{ project.status }}
                </ion-badge>
              </div>
            </ion-card-header>
            <ion-card-content>
              <div class="project-meta">
                <div class="meta-item">
                  <ion-icon :icon="personOutline"></ion-icon>
                  <span><strong>Orchestrator:</strong> {{ project.orchestratorName }}</span>
                </div>
                <div class="meta-item">
                  <ion-icon :icon="calendarOutline"></ion-icon>
                  <span><strong>Created:</strong> {{ formatDate(project.createdAt) }}</span>
                </div>
                <div class="meta-item" v-if="project.lastActiveAt">
                  <ion-icon :icon="timeOutline"></ion-icon>
                  <span><strong>Last Active:</strong> {{ formatRelativeTime(project.lastActiveAt) }}</span>
                </div>
                <div class="meta-item" v-if="project.targetDate">
                  <ion-icon :icon="flagOutline"></ion-icon>
                  <span><strong>Target Date:</strong> {{ formatDate(project.targetDate) }}</span>
                </div>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Progress Overview -->
        <div class="progress-section">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Progress Overview</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="progress-stats">
                <div class="stat-item">
                  <div class="stat-number">{{ project.totalTasks }}</div>
                  <div class="stat-label">Total Tasks</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number success">{{ project.completedTasks }}</div>
                  <div class="stat-label">Completed</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number primary">{{ project.activeTasks }}</div>
                  <div class="stat-label">Active</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number danger">{{ project.failedTasks }}</div>
                  <div class="stat-label">Failed</div>
                </div>
              </div>
              
              <div class="progress-bar-section" v-if="project.totalTasks > 0">
                <div class="progress-info">
                  <span class="progress-label">Overall Progress</span>
                  <span class="progress-percentage">{{ Math.round((project.completedTasks / project.totalTasks) * 100) }}%</span>
                </div>
                <ion-progress-bar 
                  :value="project.completedTasks / project.totalTasks"
                  :color="getProgressColor(project.completedTasks / project.totalTasks)"
                ></ion-progress-bar>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Task Management -->
        <div class="tasks-section">
          <ion-card>
            <ion-card-header>
              <div class="section-header">
                <ion-card-title>Tasks</ion-card-title>
                <ion-segment v-model="taskFilter" @ionChange="filterTasks">
                  <ion-segment-button value="all">
                    <ion-label>All</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="active">
                    <ion-label>Active</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="completed">
                    <ion-label>Completed</ion-label>
                  </ion-segment-button>
                  <ion-segment-button value="failed">
                    <ion-label>Failed</ion-label>
                  </ion-segment-button>
                </ion-segment>
              </div>
            </ion-card-header>
            <ion-card-content>
              <div v-if="filteredTasks.length === 0" class="no-tasks">
                <p>No {{ taskFilter === 'all' ? '' : taskFilter }} tasks found</p>
              </div>
              
              <ion-list v-else>
                <ion-item 
                  v-for="task in filteredTasks" 
                  :key="task.id"
                  @click="openTaskDetail(task)"
                  button
                >
                  <div class="task-content">
                    <div class="task-header">
                      <h3>{{ task.name }}</h3>
                      <ion-badge 
                        :color="getTaskStatusColor(task.status)"
                        class="task-status-badge"
                      >
                        {{ task.status }}
                      </ion-badge>
                    </div>
                    <p class="task-description">{{ task.description }}</p>
                    <div class="task-meta">
                      <span><strong>Agent:</strong> {{ task.agentName }}</span>
                      <span><strong>Created:</strong> {{ formatRelativeTime(task.createdAt) }}</span>
                      <span v-if="task.completedAt"><strong>Completed:</strong> {{ formatRelativeTime(task.completedAt) }}</span>
                    </div>
                  </div>
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- Project Actions -->
        <div class="actions-section">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Project Actions</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <div class="action-buttons">
                <ion-button 
                  fill="outline"
                  @click="chatWithOrchestrator"
                  class="action-btn"
                >
                  <ion-icon :icon="chatbubbleOutline" slot="start"></ion-icon>
                  Chat with Orchestrator
                </ion-button>
                <ion-button 
                  fill="outline"
                  @click="addTask"
                  class="action-btn"
                >
                  <ion-icon :icon="addOutline" slot="start"></ion-icon>
                  Add Task
                </ion-button>
                <ion-button 
                  fill="outline"
                  @click="exportProject"
                  class="action-btn"
                >
                  <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
                  Export Project
                </ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonProgressBar,
  alertController,
  actionSheetController,
  toastController,
} from '@ionic/vue';
import {
  pauseOutline,
  playOutline,
  ellipsisVerticalOutline,
  alertCircleOutline,
  refreshOutline,
  personOutline,
  calendarOutline,
  timeOutline,
  flagOutline,
  chevronForwardOutline,
  chatbubbleOutline,
  addOutline,
  downloadOutline,
} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  orchestratorName: string;
  orchestratorType: string;
  createdAt: Date;
  lastActiveAt?: Date;
  targetDate?: Date;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
}

interface ProjectTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  agentName: string;
  agentType: string;
  createdAt: Date;
  completedAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

const route = useRoute();
const router = useRouter();

// Reactive state
const project = ref<Project | null>(null);
const tasks = ref<ProjectTask[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const taskFilter = ref('all');

// Mock data
const mockProject: Project = {
  id: route.params.id as string,
  name: 'Q1 Marketing Campaign',
  description: 'Comprehensive marketing strategy for product launch',
  status: 'active',
  orchestratorName: 'Marketing Manager',
  orchestratorType: 'orchestrator',
  createdAt: new Date('2024-01-15'),
  lastActiveAt: new Date('2024-01-20'),
  targetDate: new Date('2024-03-31'),
  totalTasks: 12,
  completedTasks: 8,
  failedTasks: 1,
  activeTasks: 3,
};

const mockTasks: ProjectTask[] = [
  {
    id: '1',
    name: 'Market Research Analysis',
    description: 'Analyze target market and competitor landscape',
    status: 'completed',
    agentName: 'Market Research Agent',
    agentType: 'marketing',
    createdAt: new Date('2024-01-15'),
    completedAt: new Date('2024-01-16'),
    priority: 'high',
  },
  {
    id: '2',
    name: 'Content Strategy Development',
    description: 'Create comprehensive content strategy for campaign',
    status: 'active',
    agentName: 'Content Agent',
    agentType: 'marketing',
    createdAt: new Date('2024-01-16'),
    priority: 'high',
  },
  {
    id: '3',
    name: 'Social Media Calendar',
    description: 'Plan and schedule social media posts',
    status: 'completed',
    agentName: 'Social Media Agent',
    agentType: 'marketing',
    createdAt: new Date('2024-01-17'),
    completedAt: new Date('2024-01-18'),
    priority: 'medium',
  },
  {
    id: '4',
    name: 'Email Campaign Setup',
    description: 'Set up automated email marketing sequences',
    status: 'failed',
    agentName: 'Email Marketing Agent',
    agentType: 'marketing',
    createdAt: new Date('2024-01-18'),
    priority: 'medium',
  },
];

// Computed properties
const filteredTasks = computed(() => {
  if (taskFilter.value === 'all') {
    return tasks.value;
  }
  return tasks.value.filter(task => task.status === taskFilter.value);
});

// Methods
const fetchProject = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    project.value = mockProject;
    tasks.value = mockTasks;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load project';
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = async (event: CustomEvent) => {
  await fetchProject();
  event.detail.complete();
};

const pauseProject = async () => {
  const alert = await alertController.create({
    header: 'Pause Project',
    message: `Are you sure you want to pause "${project.value?.name}"? All active tasks will be paused.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Pause',
        role: 'destructive',
        handler: () => {
          if (project.value) {
            project.value.status = 'paused';
            project.value.activeTasks = 0;
          }
        }
      }
    ]
  });
  await alert.present();
};

const resumeProject = async () => {
  const alert = await alertController.create({
    header: 'Resume Project',
    message: `Resume "${project.value?.name}"? Paused tasks will continue execution.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Resume',
        handler: () => {
          if (project.value) {
            project.value.status = 'active';
            project.value.lastActiveAt = new Date();
          }
        }
      }
    ]
  });
  await alert.present();
};

const openOptionsMenu = async () => {
  const actionSheet = await actionSheetController.create({
    header: 'Project Options',
    buttons: [
      {
        text: 'Edit Project',
        icon: 'create-outline',
        handler: () => {
          // Navigate to edit page
        }
      },
      {
        text: 'Duplicate Project',
        icon: 'copy-outline',
        handler: () => {
          // Duplicate project logic
        }
      },
      {
        text: 'Delete Project',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => {
          deleteProject();
        }
      },
      {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel'
      }
    ]
  });
  await actionSheet.present();
};

const deleteProject = async () => {
  const alert = await alertController.create({
    header: 'Delete Project',
    message: `Are you sure you want to delete "${project.value?.name}"? This action cannot be undone.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          const toast = await toastController.create({
            message: 'Project deleted successfully',
            duration: 2000,
            color: 'success',
          });
          await toast.present();
          router.push('/projects');
        }
      }
    ]
  });
  await alert.present();
};

const filterTasks = () => {
  // Filtering is handled by computed property
};

const openTaskDetail = (task: ProjectTask) => {
  // Navigate to task detail or show modal
  console.log('Open task detail:', task);
};

const chatWithOrchestrator = () => {
  // Navigate to organization page and start conversation with orchestrator
  router.push('/organization');
};

const addTask = async () => {
  const toast = await toastController.create({
    message: 'Add task functionality coming soon',
    duration: 2000,
    color: 'primary',
  });
  await toast.present();
};

const exportProject = async () => {
  const toast = await toastController.create({
    message: 'Export functionality coming soon',
    duration: 2000,
    color: 'primary',
  });
  await toast.present();
};

const getStatusColor = (status: string) => {
  const colors = {
    active: 'success',
    completed: 'primary',
    paused: 'warning',
    failed: 'danger',
  };
  return colors[status as keyof typeof colors] || 'medium';
};

const getTaskStatusColor = (status: string) => {
  const colors = {
    pending: 'medium',
    active: 'primary',
    completed: 'success',
    failed: 'danger',
  };
  return colors[status as keyof typeof colors] || 'medium';
};

const getProgressColor = (progress: number) => {
  if (progress >= 0.8) return 'success';
  if (progress >= 0.5) return 'primary';
  if (progress >= 0.2) return 'warning';
  return 'danger';
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString();
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

// Lifecycle
onMounted(() => {
  fetchProject();
});
</script>

<style scoped>
.project-detail-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.overview-section,
.progress-section,
.tasks-section,
.actions-section {
  margin-bottom: 1.5rem;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.project-title-section {
  flex: 1;
  min-width: 0;
}

.status-badge {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 600;
}

.project-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.meta-item ion-icon {
  font-size: 1rem;
  color: var(--ion-color-medium);
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
  background: var(--ion-color-step-50);
  border-radius: 8px;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.stat-number.success {
  color: var(--ion-color-success);
}

.stat-number.primary {
  color: var(--ion-color-primary);
}

.stat-number.danger {
  color: var(--ion-color-danger);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
}

.progress-bar-section {
  margin-top: 1rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.progress-percentage {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.no-tasks {
  text-align: center;
  padding: 2rem;
  color: var(--ion-color-medium);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.task-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.task-status-badge {
  font-size: 0.7rem;
  flex-shrink: 0;
}

.task-description {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.action-btn {
  flex: 1;
  min-width: 200px;
}

/* Responsive design */
@media (max-width: 768px) {
  .project-detail-container {
    padding: 0.5rem;
  }
  
  .progress-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .task-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .action-btn {
    min-width: auto;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .stat-item {
    background: var(--ion-color-step-100);
  }
}
</style>