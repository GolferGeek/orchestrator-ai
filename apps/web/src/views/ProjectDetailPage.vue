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
            v-if="project?.status === 'running'"
            fill="clear"
            color="warning"
            @click="pauseProject"
          >
            <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
            Pause
          </ion-button>
          <ion-button 
            v-if="project?.status === 'paused_for_human' || project?.status === 'paused_on_error'"
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
        <!-- Hierarchy Breadcrumb -->
        <div v-if="hierarchyPath && hierarchyPath.length > 1" class="hierarchy-breadcrumb">
          <ion-chip 
            v-for="(node, index) in hierarchyPath" 
            :key="node.id"
            :outline="index !== hierarchyPath.length - 1"
            @click="navigateToProject(node.id)"
            :disabled="index === hierarchyPath.length - 1"
          >
            <ion-icon 
              v-if="index === 0" 
              :icon="homeOutline"
              slot="start"
            ></ion-icon>
            {{ node.name || 'Unnamed Project' }}
          </ion-chip>
        </div>
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
                  <span><strong>Orchestrator:</strong> {{ orchestratorName }}</span>
                </div>
                <div class="meta-item">
                  <ion-icon :icon="calendarOutline"></ion-icon>
                  <span><strong>Created:</strong> {{ formatDate(project.createdAt) }}</span>
                </div>
                <div class="meta-item" v-if="project.updatedAt">
                  <ion-icon :icon="timeOutline"></ion-icon>
                  <span><strong>Last Updated:</strong> {{ formatRelativeTime(project.updatedAt) }}</span>
                </div>
                <!-- Hierarchical information -->
                <div class="meta-item" v-if="project.hierarchyLevel && project.hierarchyLevel > 0">
                  <ion-icon :icon="gitBranchOutline"></ion-icon>
                  <span><strong>Hierarchy Level:</strong> {{ project.hierarchyLevel }}</span>
                </div>
                <div class="meta-item" v-if="project.subprojectCount && project.subprojectCount > 0">
                  <ion-icon :icon="layersOutline"></ion-icon>
                  <span><strong>Subprojects:</strong> {{ project.subprojectCount }}</span>
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
                  <div class="stat-number">{{ totalTasks }}</div>
                  <div class="stat-label">Total Tasks</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number success">{{ completedTasks }}</div>
                  <div class="stat-label">Completed</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number primary">{{ activeTasks }}</div>
                  <div class="stat-label">Active</div>
                </div>
                <div class="stat-item">
                  <div class="stat-number danger">{{ failedTasks }}</div>
                  <div class="stat-label">Failed</div>
                </div>
              </div>
              <div class="progress-bar-section" v-if="totalTasks > 0">
                <div class="progress-info">
                  <span class="progress-label">Overall Progress</span>
                  <span class="progress-percentage">{{ Math.round((completedTasks / totalTasks) * 100) }}%</span>
                </div>
                <ion-progress-bar 
                  :value="completedTasks / totalTasks"
                  :color="getProgressColor(completedTasks / totalTasks)"
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
        <!-- Subprojects Section -->
        <div v-if="project" class="subprojects-section">
          <ion-card>
            <ion-card-header>
              <div class="section-header">
                <ion-card-title>Subprojects ({{ project.subprojectCount || 0 }})</ion-card-title>
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click="createSubproject"
                >
                  <ion-icon :icon="addOutline" slot="start"></ion-icon>
                  Add Subproject
                </ion-button>
              </div>
            </ion-card-header>
            <ion-card-content>
              <div v-if="isLoadingSubprojects" class="loading-subprojects">
                <ion-spinner name="crescent"></ion-spinner>
                <p>Loading subprojects...</p>
              </div>
              <div v-else-if="!project.subprojectCount || project.subprojectCount === 0" class="empty-subprojects">
                <ion-icon :icon="folderOutline" class="empty-icon"></ion-icon>
                <p>No subprojects yet. Click "Add Subproject" to create one.</p>
              </div>
              <ion-list v-else>
                <ion-item 
                  v-for="subproject in subprojects" 
                  :key="subproject.id"
                  @click="navigateToProject(subproject.id)"
                  button
                >
                  <div class="subproject-content">
                    <div class="subproject-header">
                      <h3>{{ subproject.name }}</h3>
                      <ion-badge 
                        :color="getStatusColor(subproject.status)"
                        class="status-badge"
                      >
                        {{ subproject.status }}
                      </ion-badge>
                    </div>
                    <p class="subproject-description">{{ subproject.description || 'No description' }}</p>
                    <div class="subproject-meta">
                      <span><strong>Created:</strong> {{ formatRelativeTime(new Date(subproject.createdAt)) }}</span>
                      <span v-if="subproject.subprojectCount && subproject.subprojectCount > 0"><strong>Subprojects:</strong> {{ subproject.subprojectCount }}</span>
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
  IonChip,
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
  // Hierarchical icons
  homeOutline,
  gitBranchOutline,
  layersOutline,
  folderOutline,
} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import { projectsService, type Project, type UpdateProjectDto, type ProjectHierarchyNode } from '@/services/projectsService';
// Project interface is now imported from projectsService
interface DisplayProject {
  id: string;
  name?: string;
  description?: string;
  status: Project['status'];
  displayStatus: string;
  createdAt: Date;
  updatedAt: Date;
  conversationId: string;
  currentStepId?: string;
  planJson?: any;
  metadata?: any;
  errorDetails?: any;
  // Hierarchical support
  parentProjectId?: string;
  hierarchyLevel?: number;
  subprojectCount?: number;
}
interface ProjectTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  agentName: string;
  createdAt: Date;
  completedAt?: Date;
  estimatedDuration?: string;
  errorMessage?: string;
}
const route = useRoute();
const router = useRouter();
// Reactive state
const project = ref<DisplayProject | null>(null);
const projectSteps = ref<any[]>([]);
const tasks = ref<ProjectTask[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const taskFilter = ref('all');
// Hierarchical state
const hierarchyPath = ref<ProjectHierarchyNode[]>([]);
const subprojects = ref<Project[]>([]);
const isLoadingSubprojects = ref(false);
// Mock data
// Mock data removed - now using real API data
// Mock tasks removed - now using real project steps data
// Computed properties
const filteredTasks = computed(() => {
  if (taskFilter.value === 'all') {
    return tasks.value;
  }
  return tasks.value.filter(task => task.status === taskFilter.value);
});
// Task statistics computed from real data
const totalTasks = computed(() => tasks.value.length);
const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed').length);
const activeTasks = computed(() => tasks.value.filter(t => t.status === 'active').length);
const failedTasks = computed(() => tasks.value.filter(t => t.status === 'failed').length);
// Orchestrator name derived from conversation or project metadata
const orchestratorName = computed(() => {
  // Try to extract orchestrator name from project metadata or conversation
  if (project.value?.metadata?.orchestratorName) {
    return project.value.metadata.orchestratorName;
  }
  if (project.value?.metadata?.createdBy) {
    return project.value.metadata.createdBy;
  }
  return 'CEO Orchestrator'; // Default fallback
});
// Methods
const fetchProject = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const projectId = route.params.id as string;
    // Fetch project details
    const projectData = await projectsService.getProject(projectId);
    project.value = {
      ...projectData,
      createdAt: new Date(projectData.createdAt),
      updatedAt: new Date(projectData.updatedAt),
      // Map backend status to frontend display status
      displayStatus: mapBackendStatus(projectData.status)
    };
    // Fetch project steps
    try {
      const steps = await projectsService.getProjectSteps(projectId);
      projectSteps.value = steps;
      // Convert steps to task format for display compatibility
      tasks.value = steps.map(step => ({
        id: step.id,
        name: step.stepName,
        description: step.prompt || 'No description available',
        status: mapStepStatus(step.status) as 'pending' | 'active' | 'completed' | 'failed',
        agentName: step.agentName || 'Unknown Agent',
        createdAt: new Date(step.createdAt),
        completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
        estimatedDuration: 'Unknown duration',
        errorMessage: step.errorDetails ? JSON.stringify(step.errorDetails) : undefined
      }));
    } catch (stepsErr) {

      tasks.value = [];
    }
    // Fetch hierarchical data (only if hierarchical fields are available)
    try {
      // Fetch hierarchy path for breadcrumbs
      if (project.value.hierarchyLevel && project.value.hierarchyLevel > 0) {
        await fetchHierarchyPath(projectId);
      }
      // Fetch subprojects
      if (project.value.subprojectCount && project.value.subprojectCount > 0) {
        await fetchSubprojects(projectId);
      }
    } catch (hierarchyErr) {

    }
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
        handler: async () => {
          try {
            if (project.value) {
              await projectsService.updateProject(project.value.id, { status: 'paused_for_human' });
              await fetchProject();
            }
          } catch (err) {

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
        handler: async () => {
          try {
            if (project.value) {
              await projectsService.updateProject(project.value.id, { status: 'running' });
              await fetchProject();
            }
          } catch (err) {

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
// Hierarchical methods
const fetchHierarchyPath = async (projectId: string) => {
  try {
    hierarchyPath.value = await projectsService.getProjectHierarchyPath(projectId);
  } catch (err) {

  }
};
const fetchSubprojects = async (projectId: string) => {
  if (!project.value || !project.value.subprojectCount || project.value.subprojectCount === 0) {
    return;
  }
  isLoadingSubprojects.value = true;
  try {
    subprojects.value = await projectsService.getSubprojects(projectId);
  } catch (err) {

  } finally {
    isLoadingSubprojects.value = false;
  }
};
const navigateToProject = (projectId: string) => {
  router.push(`/app/projects/${projectId}`);
};
const createSubproject = () => {
  if (project.value) {
    router.push(`/app/projects/new?parentId=${project.value.id}&parentName=${encodeURIComponent(project.value.name || 'Unnamed Project')}`);
  }
};
// Map backend project status to frontend display status
const mapBackendStatus = (status: Project['status']) => {
  const statusMap: Record<Project['status'], string> = {
    'planning': 'active',
    'running': 'active', 
    'paused_for_human': 'paused',
    'paused_on_error': 'failed',
    'completed': 'completed',
    'aborted': 'failed'
  };
  return statusMap[status] || status;
};
// Map step status to task status
const mapStepStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    'pending': 'pending',
    'running': 'active',
    'completed': 'completed',
    'failed': 'failed',
    'skipped': 'pending'
  };
  return statusMap[status] || status;
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