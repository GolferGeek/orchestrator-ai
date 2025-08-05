<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button color="primary"></ion-menu-button>
        </ion-buttons>
        <ion-title>Projects</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="createNewProject" fill="clear">
            <ion-icon :icon="addOutline" slot="start"></ion-icon>
            New Project
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Projects</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Refresher -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="projects-container">
        <!-- Loading state -->
        <div v-if="isLoading" class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Loading projects...</p>
        </div>

        <!-- Error state -->
        <div v-if="error && !isLoading" class="error-container">
          <ion-icon :icon="alertCircleOutline" color="danger" class="error-icon"></ion-icon>
          <h3>Failed to load projects</h3>
          <p>{{ error }}</p>
          <ion-button @click="fetchProjects" fill="outline">
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Retry
          </ion-button>
        </div>

        <!-- Empty state -->
        <div v-if="!isLoading && !error && projects.length === 0" class="empty-state">
          <ion-icon :icon="folderOutline" class="empty-icon"></ion-icon>
          <h2>No Projects Yet</h2>
          <p>Create your first project to get started with orchestrated workflows and multi-agent collaboration.</p>
          <ion-button @click="createNewProject" fill="solid">
            <ion-icon :icon="addOutline" slot="start"></ion-icon>
            Create First Project
          </ion-button>
        </div>

        <!-- Projects List -->
        <div v-if="!isLoading && !error && projects.length > 0" class="projects-list">
          <!-- Filter and Sort Controls -->
          <div class="controls-bar">
            <ion-segment v-model="statusFilter" @ionChange="filterProjects">
              <ion-segment-button value="all">
                <ion-label>All</ion-label>
              </ion-segment-button>
              <ion-segment-button value="active">
                <ion-label>Active</ion-label>
              </ion-segment-button>
              <ion-segment-button value="completed">
                <ion-label>Completed</ion-label>
              </ion-segment-button>
              <ion-segment-button value="paused">
                <ion-label>Paused</ion-label>
              </ion-segment-button>
            </ion-segment>
            
            <ion-select 
              v-model="sortBy" 
              placeholder="Sort by"
              interface="popover"
              @ionChange="sortProjects"
            >
              <ion-select-option value="created_desc">Newest First</ion-select-option>
              <ion-select-option value="created_asc">Oldest First</ion-select-option>
              <ion-select-option value="updated_desc">Recently Updated</ion-select-option>
              <ion-select-option value="name_asc">Name A-Z</ion-select-option>
              <ion-select-option value="status_asc">Status</ion-select-option>
            </ion-select>
          </div>

          <!-- Project Cards -->
          <div class="projects-grid">
            <ion-card 
              v-for="project in filteredProjects" 
              :key="project.id"
              @click="openProject(project)"
              class="project-card"
              button
            >
              <ion-card-header>
                <div class="project-header">
                  <div class="project-title-section">
                    <ion-card-title>{{ project.name }}</ion-card-title>
                    <ion-card-subtitle>{{ project.description || 'No description' }}</ion-card-subtitle>
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
                    <span>{{ project.orchestratorName }}</span>
                  </div>
                  <div class="meta-item">
                    <ion-icon :icon="calendarOutline"></ion-icon>
                    <span>{{ formatDate(project.createdAt) }}</span>
                  </div>
                  <div class="meta-item" v-if="project.lastActiveAt">
                    <ion-icon :icon="timeOutline"></ion-icon>
                    <span>{{ formatRelativeTime(project.lastActiveAt) }}</span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="progress-section" v-if="project.totalTasks > 0">
                  <div class="progress-info">
                    <span class="progress-label">Progress</span>
                    <span class="progress-stats">{{ project.completedTasks }}/{{ project.totalTasks }} tasks</span>
                  </div>
                  <ion-progress-bar 
                    :value="project.completedTasks / project.totalTasks"
                    :color="getProgressColor(project.completedTasks / project.totalTasks)"
                  ></ion-progress-bar>
                </div>

                <!-- Quick Actions -->
                <div class="project-actions">
                  <ion-button 
                    fill="clear" 
                    size="small"
                    @click.stop="openProject(project)"
                  >
                    <ion-icon :icon="eyeOutline" slot="start"></ion-icon>
                    View
                  </ion-button>
                  <ion-button 
                    v-if="project.status === 'active'"
                    fill="clear" 
                    size="small"
                    color="warning"
                    @click.stop="pauseProject(project)"
                  >
                    <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
                    Pause
                  </ion-button>
                  <ion-button 
                    v-if="project.status === 'paused'"
                    fill="clear" 
                    size="small"
                    color="success"
                    @click.stop="resumeProject(project)"
                  >
                    <ion-icon :icon="playOutline" slot="start"></ion-icon>
                    Resume
                  </ion-button>
                </div>
              </ion-card-content>
            </ion-card>
          </div>
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
  IonMenuButton,
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
  IonSelect,
  IonSelectOption,
  IonProgressBar,
  alertController,
} from '@ionic/vue';
import {
  addOutline,
  folderOutline,
  alertCircleOutline,
  refreshOutline,
  personOutline,
  calendarOutline,
  timeOutline,
  eyeOutline,
  pauseOutline,
  playOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';

// Mock project data structure
interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  orchestratorName: string;
  orchestratorType: string;
  createdAt: Date;
  lastActiveAt?: Date;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
}

const router = useRouter();

// Reactive state
const projects = ref<Project[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const statusFilter = ref('all');
const sortBy = ref('created_desc');

// Mock data for development
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Q1 Marketing Campaign',
    description: 'Comprehensive marketing strategy for product launch',
    status: 'active',
    orchestratorName: 'Marketing Manager',
    orchestratorType: 'orchestrator',
    createdAt: new Date('2024-01-15'),
    lastActiveAt: new Date('2024-01-20'),
    totalTasks: 12,
    completedTasks: 8,
    failedTasks: 0,
    activeTasks: 4,
  },
  {
    id: '2',
    name: 'Product Development Sprint',
    description: 'Feature development and testing coordination',
    status: 'completed',
    orchestratorName: 'Engineering Manager',
    orchestratorType: 'orchestrator',
    createdAt: new Date('2024-01-10'),
    lastActiveAt: new Date('2024-01-18'),
    totalTasks: 8,
    completedTasks: 8,
    failedTasks: 0,
    activeTasks: 0,
  },
  {
    id: '3',
    name: 'Budget Planning 2024',
    description: 'Annual budget planning and financial forecasting',
    status: 'paused',
    orchestratorName: 'Finance Manager',
    orchestratorType: 'orchestrator',
    createdAt: new Date('2024-01-05'),
    lastActiveAt: new Date('2024-01-12'),
    totalTasks: 6,
    completedTasks: 3,
    failedTasks: 0,
    activeTasks: 0,
  },
];

// Computed properties
const filteredProjects = computed(() => {
  let filtered = projects.value;
  
  // Filter by status
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter(project => project.status === statusFilter.value);
  }
  
  // Sort projects
  const [sortField, sortOrder] = sortBy.value.split('_');
  filtered.sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'created':
        aValue = a.createdAt.getTime();
        bValue = b.createdAt.getTime();
        break;
      case 'updated':
        aValue = a.lastActiveAt?.getTime() || 0;
        bValue = b.lastActiveAt?.getTime() || 0;
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'desc') {
      return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
    } else {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    }
  });
  
  return filtered;
});

// Methods
const fetchProjects = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    projects.value = mockProjects;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load projects';
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = async (event: CustomEvent) => {
  await fetchProjects();
  event.detail.complete();
};

const createNewProject = () => {
  router.push('/projects/new');
};

const openProject = (project: Project) => {
  router.push(`/projects/${project.id}`);
};

const pauseProject = async (project: Project) => {
  const alert = await alertController.create({
    header: 'Pause Project',
    message: `Are you sure you want to pause "${project.name}"? All active tasks will be paused.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Pause',
        role: 'destructive',
        handler: () => {
          // Update project status
          project.status = 'paused';
          project.activeTasks = 0;
        }
      }
    ]
  });
  await alert.present();
};

const resumeProject = async (project: Project) => {
  const alert = await alertController.create({
    header: 'Resume Project',
    message: `Resume "${project.name}"? Paused tasks will continue execution.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Resume',
        handler: () => {
          project.status = 'active';
          project.lastActiveAt = new Date();
        }
      }
    ]
  });
  await alert.present();
};

const filterProjects = () => {
  // Filtering is handled by computed property
};

const sortProjects = () => {
  // Sorting is handled by computed property
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
  fetchProjects();
});
</script>

<style scoped>
.projects-container {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.loading-container,
.error-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.error-icon,
.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-icon {
  color: var(--ion-color-medium);
}

.empty-state h2 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--ion-color-medium);
  margin-bottom: 2rem;
  max-width: 400px;
  line-height: 1.6;
}

.controls-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.controls-bar ion-segment {
  flex: 1;
  min-width: 300px;
}

.controls-bar ion-select {
  min-width: 150px;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.project-card {
  margin: 0;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
  margin-bottom: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--ion-color-medium);
}

.meta-item ion-icon {
  font-size: 1rem;
}

.progress-section {
  margin-bottom: 1rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ion-color-dark);
}

.progress-stats {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.project-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ion-color-step-150);
}

/* Responsive design */
@media (max-width: 768px) {
  .projects-container {
    padding: 0.5rem;
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .controls-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .controls-bar ion-segment {
    min-width: auto;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .project-card:hover {
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
  }
  
  .project-actions {
    border-top-color: var(--ion-color-step-200);
  }
}
</style>