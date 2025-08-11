<template>
  <div class="project-display">
    <div class="project-header">
      <div class="title-section">
        <h3 class="project-title">{{ project.title || project.name }}</h3>
        <div class="metadata">
          <ion-chip color="primary" outline>
            Project
          </ion-chip>
          <ion-chip :color="getStatusColor(project.status)" outline>
            {{ formatStatus(project.status) }}
          </ion-chip>
        </div>
      </div>
      
      <div class="header-actions">
        <ion-button fill="clear" size="small" @click="showProjectHistory = !showProjectHistory">
          <ion-icon :icon="timeOutline" />
        </ion-button>
        <ion-button fill="clear" size="small" @click="$emit('edit-requested', project)">
          <ion-icon :icon="createOutline" />
        </ion-button>
        <ion-button fill="clear" size="small" @click="downloadProject">
          <ion-icon :icon="downloadOutline" />
        </ion-button>
      </div>
    </div>

    <!-- Project Progress -->
    <div class="progress-section" v-if="project.steps && project.steps.length">
      <div class="progress-info">
        <span class="progress-label">
          Progress: {{ completedSteps }}/{{ totalSteps }} steps
        </span>
        <span class="progress-percentage">{{ progressPercentage }}%</span>
      </div>
      <ion-progress-bar :value="progressPercentage / 100" color="primary"></ion-progress-bar>
    </div>

    <!-- Project Steps/Tasks -->
    <div class="content-section">
      <div class="steps-container" v-if="project.steps && project.steps.length">
        <h4>Project Steps</h4>
        <div class="steps-list">
          <div 
            v-for="(step, index) in project.steps"
            :key="step.id || index"
            class="step-item"
            :class="{ 
              'completed': step.status === 'completed',
              'in-progress': step.status === 'in_progress',
              'pending': step.status === 'pending'
            }"
            @click="selectStep(step)"
          >
            <div class="step-marker">
              <ion-icon 
                v-if="step.status === 'completed'" 
                :icon="checkmarkCircleOutline" 
                color="success"
              />
              <ion-icon 
                v-else-if="step.status === 'in_progress'" 
                :icon="playCircleOutline" 
                color="primary"
              />
              <ion-icon 
                v-else 
                :icon="ellipseOutline" 
                color="medium"
              />
            </div>
            <div class="step-details">
              <div class="step-header">
                <span class="step-title">{{ step.title || step.name }}</span>
                <span class="step-status">{{ formatStatus(step.status) }}</span>
              </div>
              <p class="step-description" v-if="step.description">
                {{ step.description }}
              </p>
              <div class="step-meta" v-if="step.assignedTo || step.dueDate">
                <span v-if="step.assignedTo" class="assigned-to">
                  <ion-icon :icon="personOutline" />
                  {{ step.assignedTo }}
                </span>
                <span v-if="step.dueDate" class="due-date">
                  <ion-icon :icon="calendarOutline" />
                  {{ formatDate(step.dueDate) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Description/Plan -->
      <div class="project-content" v-if="project.description || project.plan">
        <h4>Project Overview</h4>
        <div class="content-display">
          <div 
            v-if="project.description"
            class="project-description"
            v-html="renderContent(project.description)"
          ></div>
          <div 
            v-if="project.plan"
            class="project-plan"
            v-html="renderContent(project.plan)"
          ></div>
        </div>
      </div>
    </div>

    <!-- Footer Info -->
    <div class="project-footer">
      <div class="timestamps">
        <span class="created">Created {{ formatDate(project.createdAt || project.created_at) }}</span>
        <span v-if="project.updatedAt !== project.createdAt" class="updated">
          Updated {{ formatDate(project.updatedAt || project.updated_at) }}
        </span>
      </div>
      
      <!-- Tags/Labels -->
      <div v-if="project.tags && project.tags.length" class="tags-section">
        <ion-chip
          v-for="tag in project.tags"
          :key="tag"
          size="small"
          color="light"
        >
          {{ tag }}
        </ion-chip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  IonChip,
  IonButton,
  IonIcon,
  IonProgressBar,
} from '@ionic/vue';
import {
  timeOutline,
  createOutline,
  downloadOutline,
  checkmarkCircleOutline,
  playCircleOutline,
  ellipseOutline,
  personOutline,
  calendarOutline,
} from 'ionicons/icons';
import { marked } from 'marked';

interface Props {
  project: any;
  conversationId?: string;
}

interface Emits {
  (e: 'project-updated', project: any): void;
  (e: 'step-updated', step: any): void;
  (e: 'edit-requested', project: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Reactive state
const showProjectHistory = ref(false);

// Computed properties
const totalSteps = computed(() => {
  return props.project.steps?.length || 0;
});

const completedSteps = computed(() => {
  return props.project.steps?.filter((step: any) => step.status === 'completed').length || 0;
});

const progressPercentage = computed(() => {
  if (totalSteps.value === 0) return 0;
  return Math.round((completedSteps.value / totalSteps.value) * 100);
});

// Methods
const getStatusColor = (status: string) => {
  const colors = {
    'completed': 'success',
    'in_progress': 'primary',
    'pending': 'medium',
    'blocked': 'warning',
    'cancelled': 'danger',
    'planning': 'secondary',
  };
  return colors[status as keyof typeof colors] || 'medium';
};

const formatStatus = (status: string) => {
  return status.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
};

const renderContent = (content: string) => {
  try {
    // Try to render as markdown first
    return marked(content);
  } catch (error) {
    // Fallback to plain text with line breaks
    return content.replace(/\n/g, '<br>');
  }
};

const selectStep = (step: any) => {
  emit('step-updated', step);
};

const downloadProject = () => {
  const projectData = {
    title: props.project.title || props.project.name,
    description: props.project.description,
    plan: props.project.plan,
    steps: props.project.steps,
    status: props.project.status,
    createdAt: props.project.createdAt || props.project.created_at,
    updatedAt: props.project.updatedAt || props.project.updated_at,
  };

  const content = JSON.stringify(projectData, null, 2);
  const filename = `${(props.project.title || props.project.name || 'project').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.project-display {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  border-bottom: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
}

.title-section {
  flex: 1;
}

.project-title {
  margin: 0 0 8px 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--ion-color-dark);
  line-height: 1.3;
}

.metadata {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  gap: 4px;
  margin-left: 16px;
}

.progress-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background: var(--ion-color-step-50);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.progress-percentage {
  font-size: 0.9em;
  color: var(--ion-color-medium);
}

.content-section {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.steps-container h4,
.project-content h4 {
  margin: 0 0 16px 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--ion-color-primary);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--ion-color-light);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.step-item:hover {
  background: var(--ion-color-step-50);
  border-color: var(--ion-color-primary-tint);
}

.step-item.completed {
  background: #f1f8e9;
  border-color: var(--ion-color-success-tint);
}

.step-item.in-progress {
  background: #e3f2fd;
  border-color: var(--ion-color-primary-tint);
}

.step-marker {
  margin-right: 12px;
  margin-top: 2px;
}

.step-marker ion-icon {
  font-size: 1.2em;
}

.step-details {
  flex: 1;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.step-title {
  font-weight: 500;
  color: var(--ion-color-dark);
}

.step-status {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  text-transform: capitalize;
}

.step-description {
  margin: 4px 0;
  font-size: 0.9em;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.step-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.assigned-to,
.due-date {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.assigned-to ion-icon,
.due-date ion-icon {
  font-size: 1em;
}

.project-content {
  margin-top: 24px;
}

.content-display {
  line-height: 1.6;
  color: var(--ion-color-dark);
}

.project-description,
.project-plan {
  margin-bottom: 16px;
}

.project-description :deep(h1),
.project-description :deep(h2),
.project-description :deep(h3),
.project-plan :deep(h1),
.project-plan :deep(h2),
.project-plan :deep(h3) {
  color: var(--ion-color-dark);
  margin-top: 24px;
  margin-bottom: 12px;
}

.project-description :deep(h1):first-child,
.project-description :deep(h2):first-child,
.project-plan :deep(h1):first-child,
.project-plan :deep(h2):first-child {
  margin-top: 0;
}

.project-footer {
  padding: 16px;
  border-top: 1px solid var(--ion-color-light);
  background: var(--ion-color-step-25);
}

.timestamps {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.created,
.updated {
  font-size: 0.85em;
  color: var(--ion-color-medium);
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .project-display {
    background: var(--ion-color-dark-shade);
  }
  
  .project-header {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .progress-section {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
  
  .step-item {
    border-color: var(--ion-color-dark-tint);
  }
  
  .step-item.completed {
    background: #1b5e20;
    border-color: var(--ion-color-success);
  }
  
  .step-item.in-progress {
    background: #1e3a8a;
    border-color: var(--ion-color-primary);
  }
  
  .project-footer {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-dark-tint);
  }
}
</style>