<template>
  <div class="admin-evaluations-list">
    <!-- Filters Section -->
    <ion-card class="filters-card">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="filterOutline" style="margin-right: 8px;"></ion-icon>
          Advanced Filters
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-grid>
          <ion-row>
            <!-- Rating Filters -->
            <ion-col size="12" size-md="6" size-lg="3">
              <ion-item>
                <ion-select 
                  v-model="localFilters.minRating" 
                  placeholder="Min Rating"
                  @ionChange="onFilterChange"
                >
                  <ion-select-option :value="undefined">Any</ion-select-option>
                  <ion-select-option :value="1">1+</ion-select-option>
                  <ion-select-option :value="2">2+</ion-select-option>
                  <ion-select-option :value="3">3+</ion-select-option>
                  <ion-select-option :value="4">4+</ion-select-option>
                  <ion-select-option :value="5">5</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="6" size-lg="3">
              <ion-item>
                <ion-select 
                  v-model="localFilters.maxRating" 
                  placeholder="Max Rating"
                  @ionChange="onFilterChange"
                >
                  <ion-select-option :value="undefined">Any</ion-select-option>
                  <ion-select-option :value="1">1</ion-select-option>
                  <ion-select-option :value="2">2</ion-select-option>
                  <ion-select-option :value="3">3</ion-select-option>
                  <ion-select-option :value="4">4</ion-select-option>
                  <ion-select-option :value="5">5</ion-select-option>
                </ion-select>
              </ion-item>
            </ion-col>
            <!-- Agent and User Filters -->
            <ion-col size="12" size-md="6" size-lg="3">
              <ion-item>
                <ion-input 
                  v-model="localFilters.agentName" 
                  placeholder="Agent Name"
                  @ionInput="debounceFilter"
                ></ion-input>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="6" size-lg="3">
              <ion-item>
                <ion-input 
                  v-model="localFilters.userEmail" 
                  placeholder="User Email"
                  @ionInput="debounceFilter"
                ></ion-input>
              </ion-item>
            </ion-col>
          </ion-row>
          <ion-row>
            <!-- Date Filters -->
            <ion-col size="12" size-md="6">
              <ion-item>
                <ion-input 
                  v-model="localFilters.startDate" 
                  type="date" 
                  placeholder="Start Date"
                  @ionChange="onFilterChange"
                ></ion-input>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="6">
              <ion-item>
                <ion-input 
                  v-model="localFilters.endDate" 
                  type="date" 
                  placeholder="End Date"
                  @ionChange="onFilterChange"
                ></ion-input>
              </ion-item>
            </ion-col>
          </ion-row>
          <ion-row>
            <!-- Boolean Filters -->
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-checkbox 
                  v-model="localFilters.hasNotes" 
                  @ionChange="onFilterChange"
                ></ion-checkbox>
                <ion-label class="ion-margin-start">Has Notes</ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-checkbox 
                  v-model="localFilters.hasWorkflowSteps" 
                  @ionChange="onFilterChange"
                ></ion-checkbox>
                <ion-label class="ion-margin-start">Has Workflow</ion-label>
              </ion-item>
            </ion-col>
            <ion-col size="12" size-md="4">
              <ion-item>
                <ion-checkbox 
                  v-model="localFilters.hasConstraints" 
                  @ionChange="onFilterChange"
                ></ion-checkbox>  
                <ion-label class="ion-margin-start">Has Constraints</ion-label>
              </ion-item>
            </ion-col>
          </ion-row>
          <ion-row>
            <ion-col size="12" class="ion-text-right">
              <ion-button 
                fill="clear" 
                @click="clearFilters"
                :disabled="isLoading"
              >
                <ion-icon :icon="closeOutline" slot="start"></ion-icon>
                Clear Filters
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>
      </ion-card-content>
    </ion-card>
    <!-- Loading State -->
    <div v-if="isLoading && !evaluations.length" class="ion-text-center ion-padding">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading evaluations...</p>
    </div>
    <!-- Evaluations List -->
    <div v-else-if="evaluations.length > 0">
      <!-- Results Info -->
      <ion-item lines="none" class="results-info">
        <ion-label>
          <p>
            Showing {{ evaluations.length }} of {{ pagination.total }} evaluations
            (Page {{ pagination.page }} of {{ pagination.totalPages }})
          </p>
        </ion-label>
      </ion-item>
      <!-- Evaluation Cards -->
      <ion-card 
        v-for="evaluation in evaluations" 
        :key="`${evaluation.task.id}-${evaluation.user.id}`"
        button
        @click="openEvaluationDetails(evaluation)"
        class="evaluation-card"
      >
        <ion-card-header>
          <ion-row>
            <!-- Task Info -->
            <ion-col size="12" size-md="8">
              <ion-card-subtitle>
                <ion-chip size="small" color="primary">
                  {{ evaluation.task.agentName }}
                </ion-chip>
                <span class="user-info">by {{ evaluation.user.email }}</span>
              </ion-card-subtitle>
              <ion-card-title class="evaluation-title">
                {{ truncateContent(evaluation.task.prompt) }}
              </ion-card-title>
            </ion-col>
            <!-- Rating and Date -->
            <ion-col size="12" size-md="4" class="ion-text-right">
              <div class="rating-display">
                <ion-icon 
                  v-for="starIndex in 5" 
                  :key="starIndex"
                  :icon="starIndex <= evaluation.evaluation.userRating ? starIcon : starOutline"
                  :color="starIndex <= evaluation.evaluation.userRating ? 'warning' : 'medium'"
                  size="small"
                ></ion-icon>
              </div>
              <ion-text color="medium">
                <small>{{ formatDate(evaluation.evaluation.evaluationTimestamp) }}</small>
              </ion-text>
            </ion-col>
          </ion-row>
        </ion-card-header>
        <ion-card-content>
          <!-- User Notes -->
          <ion-row v-if="evaluation.evaluation.userNotes">
            <ion-col>
              <ion-text color="medium">
                <p class="notes-preview">{{ truncateNotes(evaluation.evaluation.userNotes) }}</p>
              </ion-text>
            </ion-col>
          </ion-row>
          <!-- Ratings Row -->
          <ion-row>
            <ion-col size="6" v-if="evaluation.evaluation.speedRating">
              <ion-chip outline color="primary" size="small">
                <ion-icon :icon="timerOutline"></ion-icon>
                <ion-label>Speed: {{ evaluation.evaluation.speedRating }}/5</ion-label>
              </ion-chip>
            </ion-col>
            <ion-col size="6" v-if="evaluation.evaluation.accuracyRating">
              <ion-chip outline color="success" size="small">
                <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
                <ion-label>Accuracy: {{ evaluation.evaluation.accuracyRating }}/5</ion-label>
              </ion-chip>
            </ion-col>
          </ion-row>
          <!-- Metadata Row -->
          <ion-row>
            <ion-col size="6">
              <ion-text color="medium">
                <small>
                  <ion-icon :icon="personOutline" style="margin-right: 4px;"></ion-icon>
                  {{ evaluation.user.roles.join(', ') }}
                </small>
              </ion-text>
            </ion-col>
            <ion-col size="6" class="ion-text-right">
              <ion-text color="medium">
                <small>
                  <ion-icon :icon="timeOutline" style="margin-right: 4px;"></ion-icon>
                  {{ evaluation.llmInfo.responseTimeMs }}ms
                </small>
              </ion-text>
            </ion-col>
          </ion-row>
          <!-- Workflow and Constraints Indicators -->
          <ion-row v-if="evaluation.workflowSteps || evaluation.llmConstraints">
            <ion-col>
              <div class="feature-indicators">
                <ion-chip 
                  v-if="evaluation.workflowSteps" 
                  size="small" 
                  outline 
                  color="secondary"
                >
                  <ion-icon :icon="gitNetworkOutline"></ion-icon>
                  <ion-label>{{ evaluation.workflowSteps.completedSteps }}/{{ evaluation.workflowSteps.totalSteps }} steps</ion-label>
                </ion-chip>
                <ion-chip 
                  v-if="evaluation.llmConstraints" 
                  size="small" 
                  outline 
                  color="tertiary"
                >
                  <ion-icon :icon="codeOutline"></ion-icon>
                  <ion-label>{{ getTotalConstraints(evaluation.llmConstraints) }} constraints</ion-label>
                </ion-chip>
              </div>
            </ion-col>
          </ion-row>
        </ion-card-content>
      </ion-card>
      <!-- Pagination Controls -->
      <ion-card class="pagination-controls">
        <ion-card-content>
          <ion-row class="ion-align-items-center">
            <ion-col size="auto">
              <ion-button 
                fill="clear" 
                @click="previousPage"
                :disabled="pagination.page <= 1 || isLoading"
              >
                <ion-icon :icon="chevronBackOutline" slot="start"></ion-icon>
                Previous
              </ion-button>
            </ion-col>
            <ion-col class="ion-text-center">
              <ion-text>
                <strong>Page {{ pagination.page }} of {{ pagination.totalPages }}</strong>
              </ion-text>
            </ion-col>
            <ion-col size="auto">
              <ion-button 
                fill="clear" 
                @click="nextPage"
                :disabled="pagination.page >= pagination.totalPages || isLoading"
              >
                Next
                <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-card-content>
      </ion-card>
    </div>
    <!-- Empty State -->
    <ion-card v-else class="ion-text-center">
      <ion-card-content>
        <ion-icon :icon="starOutline" size="large" color="medium"></ion-icon>
        <h3>No Evaluations Found</h3>
        <p>No evaluations match your current filters.</p>
        <ion-button fill="clear" @click="clearFilters">
          Clear Filters
        </ion-button>
      </ion-card-content>
    </ion-card>
    <!-- Loading overlay for pagination -->
    <div v-if="isLoading && evaluations.length > 0" class="loading-overlay">
      <ion-spinner name="crescent"></ion-spinner>
    </div>
    <!-- Evaluation Details Modal -->
    <AdminEvaluationDetailsModal 
      :is-open="showDetailsModal"
      :evaluation="selectedEvaluation"
      @dismiss="closeEvaluationDetails"
    />
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonCheckbox,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonChip,
  IonCardSubtitle
} from '@ionic/vue';
import {
  filterOutline,
  closeOutline,
  starOutline,
  star,
  timerOutline,
  checkmarkCircleOutline,
  personOutline,
  timeOutline,
  gitNetworkOutline,
  codeOutline,
  chevronBackOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import AdminEvaluationDetailsModal from './AdminEvaluationDetailsModal.vue';
import type { EvaluationWithMessage, AllEvaluationsFilters } from '@/types/evaluation';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Props {
  evaluations: EvaluationWithMessage[];
  pagination: PaginationInfo;
  isLoading: boolean;
  filters: AllEvaluationsFilters;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  filterChange: [filters: AllEvaluationsFilters];
  pageChange: [page: number];
  refresh: [];
}>();
const localFilters = reactive({ ...props.filters });
const showDetailsModal = ref(false);
const selectedEvaluation = ref<EvaluationWithMessage | null>(null);
let filterTimeout: NodeJS.Timeout | null = null;
const starIcon = computed(() => star);
function onFilterChange() {
  emit('filterChange', { ...localFilters });
}
function debounceFilter() {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
  filterTimeout = setTimeout(() => {
    onFilterChange();
  }, 500);
}
function clearFilters() {
  Object.keys(localFilters).forEach(key => {
    if (key === 'page') {
      localFilters[key] = 1;
    } else if (key === 'limit') {
      localFilters[key] = 20;
    } else {
      localFilters[key] = undefined;
    }
  });
  onFilterChange();
}
function previousPage() {
  if (props.pagination.page > 1) {
    emit('pageChange', props.pagination.page - 1);
  }
}
function nextPage() {
  if (props.pagination.page < props.pagination.totalPages) {
    emit('pageChange', props.pagination.page + 1);
  }
}
function openEvaluationDetails(evaluation: EvaluationWithMessage) {
  selectedEvaluation.value = evaluation;
  showDetailsModal.value = true;
}
function closeEvaluationDetails() {
  showDetailsModal.value = false;
  selectedEvaluation.value = null;
}
function truncateContent(content: string, maxLength: number = 100): string {
  if (!content || content.length <= maxLength) return content || '';
  return content.substring(0, maxLength) + '...';
}
function truncateNotes(notes: string, maxLength: number = 150): string {
  if (!notes || notes.length <= maxLength) return notes || '';
  return notes.substring(0, maxLength) + '...';
}
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getTotalConstraints(constraints: Record<string, unknown>): number {
  if (!constraints) return 0;
  return (constraints.activeStateModifiers?.length || 0) + 
         (constraints.responseModifiers?.length || 0) + 
         (constraints.executedCommands?.length || 0);
}
</script>
<style scoped>
.admin-evaluations-list {
  max-width: 1200px;
  margin: 0 auto;
}
.filters-card {
  margin-bottom: 1rem;
}
.results-info {
  margin-bottom: 1rem;
  --background: transparent;
}
.evaluation-card {
  margin-bottom: 1rem;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.evaluation-card:hover {
  transform: translateY(-2px);
}
.evaluation-title {
  font-size: 1rem;
  line-height: 1.4;
  margin-top: 0.5rem;
}
.user-info {
  margin-left: 8px;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.rating-display {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}
.notes-preview {
  font-style: italic;
  margin: 0;
  font-size: 0.9rem;
}
.feature-indicators {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pagination-controls {
  margin-top: 1rem;
  position: sticky;
  bottom: 1rem;
}
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
ion-chip {
  margin: 2px;
}
@media (max-width: 768px) {
  .evaluation-title {
    font-size: 0.9rem;
  }
  .user-info {
    display: block;
    margin-left: 0;
    margin-top: 4px;
  }
  .rating-display {
    justify-content: flex-start;
    margin-top: 1rem;
  }
}
</style>