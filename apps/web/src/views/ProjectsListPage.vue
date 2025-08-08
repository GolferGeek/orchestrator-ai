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
            <!-- View Mode Toggle -->
            <ion-segment v-model="viewMode" @ionChange="toggleViewMode">
              <ion-segment-button value="flat">
                <ion-icon :icon="listOutline"></ion-icon>
                <ion-label>Flat</ion-label>
              </ion-segment-button>
              <ion-segment-button value="hierarchical">
                <ion-icon :icon="gitBranchOutline"></ion-icon>
                <ion-label>Tree</ion-label>
              </ion-segment-button>
            </ion-segment>
            
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
          <div class="projects-grid" :class="{ 'hierarchical-view': viewMode === 'hierarchical' }">
            <ion-card 
              v-for="project in displayProjects" 
              :key="project.id"
              @click="openProject(project)"
              class="project-card"
              :class="{ 
                'project-card--hierarchical': viewMode === 'hierarchical',
                [`project-card--level-${project.hierarchyLevel || 0}`]: viewMode === 'hierarchical'
              }"
              button
            >
              <ion-card-header>
                <div class="project-header">
                  <div class="project-title-section">
                    <!-- Hierarchy indicator -->
                    <div v-if="viewMode === 'hierarchical' && project.hierarchyLevel && project.hierarchyLevel > 0" class="hierarchy-indicator">
                      <span v-for="level in project.hierarchyLevel" :key="level" class="hierarchy-level">└─</span>
                    </div>
                    
                    <div class="title-content">
                      <ion-card-title>{{ project.name }}</ion-card-title>
                      <ion-card-subtitle>{{ project.description || 'No description' }}</ion-card-subtitle>
                      
                      <!-- Project hierarchy info -->
                      <div v-if="viewMode === 'hierarchical'" class="hierarchy-info">
                        <span v-if="project.parentProjectId" class="hierarchy-badge parent">
                          <ion-icon :icon="chevronUpOutline"></ion-icon>
                          Subproject
                        </span>
                        <span v-if="project.subprojectCount && project.subprojectCount > 0" class="hierarchy-badge children">
                          <ion-icon :icon="chevronDownOutline"></ion-icon>
                          {{ project.subprojectCount }} subproject{{ project.subprojectCount !== 1 ? 's' : '' }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ion-badge 
                    :color="getStatusColor(mapBackendStatus(project.status))"
                    class="status-badge"
                  >
                    {{ mapBackendStatus(project.status) }}
                  </ion-badge>
                </div>
              </ion-card-header>

              <ion-card-content>
                <div class="project-meta">
                  <div class="meta-item">
                    <ion-icon :icon="personOutline"></ion-icon>
                    <span>Project ID: {{ project.id.substring(0, 8) }}</span>
                  </div>
                  <div class="meta-item">
                    <ion-icon :icon="calendarOutline"></ion-icon>
                    <span>{{ formatDate(project.createdAt) }}</span>
                  </div>
                  <div class="meta-item">
                    <ion-icon :icon="timeOutline"></ion-icon>
                    <span>{{ formatRelativeTime(new Date(project.updatedAt)) }}</span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="progress-section" v-if="project.status === 'running' || project.status === 'completed'">
                  <div class="progress-info">
                    <span class="progress-label">Status</span>
                    <span class="progress-stats">{{ project.status.replace('_', ' ') }}</span>
                  </div>
                  <ion-progress-bar 
                    :value="project.status === 'completed' ? 1 : 0.5"
                    :color="project.status === 'completed' ? 'success' : 'primary'"
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
                  
                  <!-- Hierarchical actions -->
                  <ion-button 
                    v-if="project.subprojectCount && project.subprojectCount > 0"
                    fill="clear" 
                    size="small"
                    color="tertiary"
                    @click.stop="createSubproject(project)"
                  >
                    <ion-icon :icon="addOutline" slot="start"></ion-icon>
                    Add Sub
                  </ion-button>
                  
                  <ion-button 
                    v-if="project.status === 'running'"
                    fill="clear" 
                    size="small"
                    color="warning"
                    @click.stop="pauseProject(project)"
                  >
                    <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
                    Pause
                  </ion-button>
                  <ion-button 
                    v-if="project.status === 'paused_for_human' || project.status === 'paused_on_error'"
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
  listOutline,
  gitBranchOutline,
  chevronUpOutline,
  chevronDownOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { projectsService, type Project } from '@/services/projectsService';

const router = useRouter();

// Reactive state
const projects = ref<Project[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const statusFilter = ref('all');
const sortBy = ref('created_desc');
const viewMode = ref<'flat' | 'hierarchical'>('flat');

// Additional computed properties for project statistics
const totalProjects = ref(0);
const currentPage = ref(0);
const itemsPerPage = ref(20);

// Computed properties
const filteredProjects = computed(() => {
  // Since filtering and sorting is now done by the backend API,
  // we just return the projects as-is
  return projects.value;
});

// Display projects based on view mode
const displayProjects = computed(() => {
  if (viewMode.value === 'hierarchical') {
    return buildHierarchicalProjects(projects.value);
  }
  return projects.value;
});

// Map status filter values to API status values
const mapStatusFilter = (filter: string): Project['status'] | undefined => {
  const statusMap: Record<string, Project['status']> = {
    'active': 'running',
    'completed': 'completed',
    'paused': 'paused_for_human'
  };
  return filter === 'all' ? undefined : statusMap[filter];
};

// Map sort values to API sort values
const mapSortValue = (sort: string) => {
  const [field, order] = sort.split('_');
  const fieldMap: Record<string, string> = {
    'created': 'created_at',
    'updated': 'updated_at',
    'name': 'name'
  };
  return {
    sortBy: fieldMap[field] || 'created_at',
    sortOrder: order as 'asc' | 'desc'
  };
};

// Helper functions for hierarchical display
const buildHierarchicalProjects = (projectList: Project[]): Project[] => {
  // Sort projects by hierarchy level first, then by creation date
  return projectList.sort((a, b) => {
    const aLevel = a.hierarchyLevel || 0;
    const bLevel = b.hierarchyLevel || 0;
    
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }
    // Within same level, sort by parent relationship
    if (a.parentProjectId && b.parentProjectId && a.parentProjectId === b.parentProjectId) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};

// Methods
const fetchProjects = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    const { sortBy: apiSortBy, sortOrder } = mapSortValue(sortBy.value);
    const status = mapStatusFilter(statusFilter.value);
    
    const response = await projectsService.getProjects({
      status,
      limit: itemsPerPage.value,
      offset: currentPage.value * itemsPerPage.value,
      sortBy: apiSortBy as 'created_at' | 'updated_at' | 'name',
      sortOrder,
      // For hierarchical view, include subprojects
      includeSubprojects: viewMode.value === 'hierarchical'
    });
    
    projects.value = response.projects.map(project => ({
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
      // Map backend status to frontend status for display
      displayStatus: mapBackendStatus(project.status)
    }));
    
    totalProjects.value = response.total;
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load projects';
  } finally {
    isLoading.value = false;
  }
};

// Map backend status to frontend display status
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
    message: `Are you sure you want to pause "${project.name || 'this project'}"? All active tasks will be paused.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Pause',
        role: 'destructive',
        handler: async () => {
          try {
            // Call backend API to pause project
            await projectsService.updateProject(project.id, {
              status: 'paused_for_human'
            });
            // Refresh projects list
            await fetchProjects();
          } catch (err) {
            console.error('Failed to pause project:', err);
            error.value = 'Failed to pause project';
          }
        }
      }
    ]
  });
  await alert.present();
};

const resumeProject = async (project: Project) => {
  const alert = await alertController.create({
    header: 'Resume Project',
    message: `Resume "${project.name || 'this project'}"? Paused tasks will continue execution.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Resume',
        handler: async () => {
          try {
            // Call backend API to resume project
            await projectsService.resumeProject(project.id, {
              reason: 'User requested resume'
            });
            // Refresh projects list
            await fetchProjects();
          } catch (err) {
            console.error('Failed to resume project:', err);
            error.value = 'Failed to resume project';
          }
        }
      }
    ]
  });
  await alert.present();
};

const filterProjects = () => {
  // Filtering is now done by the backend API, so refresh projects
  fetchProjects();
};

const sortProjects = () => {
  // Sorting is now done by the backend API, so refresh projects
  fetchProjects();
};

const toggleViewMode = () => {
  // Refresh projects when view mode changes to get appropriate data
  fetchProjects();
};

const createSubproject = (parentProject: Project) => {
  router.push(`/projects/new?parentId=${parentProject.id}&parentName=${encodeURIComponent(parentProject.name || 'Unnamed Project')}`);
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

.projects-grid.hierarchical-view {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

/* Hierarchical project styles */
.project-card--hierarchical {
  margin-left: 0;
  border-left: 3px solid transparent;
}

.project-card--level-0 {
  border-left-color: var(--ion-color-primary);
}

.project-card--level-1 {
  border-left-color: var(--ion-color-secondary);
  margin-left: 2rem;
}

.project-card--level-2 {
  border-left-color: var(--ion-color-tertiary);
  margin-left: 4rem;
}

.project-card--level-3 {
  border-left-color: var(--ion-color-warning);
  margin-left: 6rem;
}

.hierarchy-indicator {
  display: flex;
  align-items: center;
  margin-right: 0.5rem;
  color: var(--ion-color-medium);
  font-family: monospace;
  font-size: 0.8rem;
}

.hierarchy-level {
  margin-right: 0.25rem;
}

.title-content {
  flex: 1;
}

.project-title-section {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.hierarchy-info {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.hierarchy-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  padding: 0.2rem 0.4rem;
  border-radius: 0.25rem;
  color: var(--ion-color-dark);
}

.hierarchy-badge.parent {
  background-color: var(--ion-color-primary-tint);
  color: var(--ion-color-primary-shade);
}

.hierarchy-badge.children {
  background-color: var(--ion-color-secondary-tint);
  color: var(--ion-color-secondary-shade);
}

.hierarchy-badge ion-icon {
  font-size: 0.8rem;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .project-card:hover {
    box-shadow: 0 8px 24px rgba(255, 255, 255, 0.1);
  }
  
  .project-actions {
    border-top-color: var(--ion-color-step-200);
  }
  
  .hierarchy-badge.parent {
    background-color: var(--ion-color-primary-shade);
    color: var(--ion-color-primary-tint);
  }
  
  .hierarchy-badge.children {
    background-color: var(--ion-color-secondary-shade);
    color: var(--ion-color-secondary-tint);
  }
}
</style>