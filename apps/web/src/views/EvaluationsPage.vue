<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Evaluations</ion-title>
        <ion-buttons slot="end">
          <ion-button 
            fill="clear" 
            @click="refreshEvaluations"
            :disabled="evaluationsStore.isLoading"
          >
            <ion-icon :icon="refreshOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="ion-padding">
      <!-- Evaluation Type Tabs -->
      <ion-card class="tabs-card">
        <ion-card-content>
          <ion-segment v-model="selectedTab" @ionChange="handleTabChange">
            <ion-segment-button value="tasks">
              <ion-label>Task Evaluations</ion-label>
            </ion-segment-button>
            <ion-segment-button value="deliverables">
              <ion-label>Deliverable Evaluations</ion-label>
            </ion-segment-button>
          </ion-segment>
        </ion-card-content>
      </ion-card>
      <!-- Filters Section -->
      <ion-card class="filters-card">
        <ion-card-header>
          <ion-card-title>Filters</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <ion-col size="12" size-md="6">
                <ion-item>
                  <ion-select 
                    v-model="localFilters.minRating" 
                    placeholder="Minimum Rating"
                    @ionChange="applyFilters"
                  >
                    <ion-select-option :value="undefined">All Ratings</ion-select-option>
                    <ion-select-option :value="1">1+ Stars</ion-select-option>
                    <ion-select-option :value="2">2+ Stars</ion-select-option>
                    <ion-select-option :value="3">3+ Stars</ion-select-option>
                    <ion-select-option :value="4">4+ Stars</ion-select-option>
                    <ion-select-option :value="5">5 Stars</ion-select-option>
                  </ion-select>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="6">
                <ion-item>
                  <ion-input 
                    v-model="localFilters.agentName" 
                    placeholder="Filter by Agent Name"
                    @ionInput="debounceFilter"
                  ></ion-input>
                </ion-item>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="12" size-md="6">
                <ion-item>
                  <ion-checkbox 
                    v-model="localFilters.hasNotes" 
                    @ionChange="applyFilters"
                  ></ion-checkbox>
                  <ion-label class="ion-margin-start">Has Notes Only</ion-label>
                </ion-item>
              </ion-col>
              <ion-col size="12" size-md="6">
                <ion-button 
                  fill="clear" 
                  @click="clearAllFilters"
                  :disabled="evaluationsStore.isLoading"
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
      <div v-if="evaluationsStore.isLoading && !evaluationsStore.hasEvaluations" class="ion-text-center ion-padding">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading evaluations...</p>
      </div>
      <!-- Error State -->
      <ion-card v-else-if="evaluationsStore.error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <h3>Error Loading Evaluations</h3>
            <p>{{ evaluationsStore.error }}</p>
          </ion-text>
          <ion-button 
            fill="clear" 
            color="light" 
            @click="refreshEvaluations"
          >
            Try Again
          </ion-button>
        </ion-card-content>
      </ion-card>
      <!-- Empty State -->
      <ion-card v-else-if="(!evaluationsStore.hasEvaluations || filteredEvaluations.length === 0) && !evaluationsStore.isLoading">
        <ion-card-content class="ion-text-center">
          <ion-icon :icon="starOutline" size="large" color="medium"></ion-icon>
          <h3>No {{ selectedTab === 'deliverables' ? 'Deliverable' : 'Task' }} Evaluations Found</h3>
          <p v-if="!evaluationsStore.hasEvaluations">You haven't rated any messages yet.</p>
          <p v-else-if="filteredEvaluations.length === 0 && selectedTab === 'deliverables'">
            No evaluations found for deliverable-associated tasks. Switch to "Task Evaluations" to see all your ratings.
          </p>
          <p v-else>No evaluations match your current filters.</p>
          <ion-button fill="clear" @click="clearAllFilters">
            Clear Filters
          </ion-button>
        </ion-card-content>
      </ion-card>
      <!-- Evaluations List -->
      <div v-else>
        <!-- Pagination Info -->
        <ion-item lines="none" class="pagination-info">
          <ion-label>
            <p>
              Showing {{ filteredEvaluations.length }} {{ selectedTab === 'deliverables' ? 'deliverable' : 'task' }} evaluations
              of {{ evaluationsStore.pagination.total }} total
              (Page {{ evaluationsStore.currentPageInfo }})
            </p>
          </ion-label>
        </ion-item>
        <!-- Evaluation Cards -->
        <ion-card 
          v-for="evaluation in filteredEvaluations" 
          :key="evaluation.id"
          button
          @click="openEvaluationDetails(evaluation)"
          class="evaluation-card"
        >
          <ion-card-header>
            <ion-row>
              <ion-col size="8">
                <ion-card-subtitle>
                  {{ evaluation.metadata?.agentName || 'Task Agent' }}
                  <ion-chip 
                    v-if="selectedTab === 'deliverables' && evaluation.metadata?.deliverableType" 
                    outline 
                    color="tertiary"
                    size="small"
                  >
                    {{ evaluation.metadata.deliverableType }}
                  </ion-chip>
                </ion-card-subtitle>
                <ion-card-title class="evaluation-title">
                  {{ truncateContent(evaluation.content) }}
                </ion-card-title>
              </ion-col>
              <ion-col size="4" class="ion-text-right">
                <div class="rating-display">
                  <ion-icon 
                    v-for="starIndex in 5" 
                    :key="starIndex"
                    :icon="starIndex <= (evaluation.userRating || 0) ? starIcon : starOutline"
                    :color="starIndex <= (evaluation.userRating || 0) ? 'warning' : 'medium'"
                    size="small"
                  ></ion-icon>
                </div>
                <ion-text color="medium">
                  <small>{{ formatDate(evaluation.timestamp) }}</small>
                </ion-text>
              </ion-col>
            </ion-row>
          </ion-card-header>
          <ion-card-content>
            <ion-row v-if="evaluation.userNotes">
              <ion-col>
                <ion-text color="medium">
                  <p class="notes-preview">{{ truncateNotes(evaluation.userNotes) }}</p>
                </ion-text>
              </ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6" v-if="evaluation.speedRating">
                <ion-chip outline color="primary">
                  <ion-icon :icon="timerOutline"></ion-icon>
                  <ion-label>Speed: {{ evaluation.speedRating }}/5</ion-label>
                </ion-chip>
              </ion-col>
              <ion-col size="6" v-if="evaluation.accuracyRating">
                <ion-chip outline color="success">
                  <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
                  <ion-label>Accuracy: {{ evaluation.accuracyRating }}/5</ion-label>
                </ion-chip>
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
                  @click="evaluationsStore.loadPreviousPage()"
                  :disabled="evaluationsStore.pagination.page <= 1 || evaluationsStore.isLoading"
                >
                  <ion-icon :icon="chevronBackOutline" slot="start"></ion-icon>
                  Previous
                </ion-button>
              </ion-col>
              <ion-col class="ion-text-center">
                <ion-text>
                  <strong>Page {{ evaluationsStore.pagination.page }} of {{ evaluationsStore.pagination.totalPages }}</strong>
                </ion-text>
              </ion-col>
              <ion-col size="auto">
                <ion-button 
                  fill="clear" 
                  @click="evaluationsStore.loadNextPage()"
                  :disabled="!evaluationsStore.hasMorePages || evaluationsStore.isLoading"
                >
                  Next
                  <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
                </ion-button>
              </ion-col>
            </ion-row>
          </ion-card-content>
        </ion-card>
      </div>
      <!-- Loading overlay for pagination -->
      <div v-if="evaluationsStore.isLoading && evaluationsStore.hasEvaluations" class="loading-overlay">
        <ion-spinner name="crescent"></ion-spinner>
      </div>
    </ion-content>
    <!-- Evaluation Details Modal -->
    <EvaluationDetailsModal 
      :is-open="showDetailsModal"
      :evaluation="selectedEvaluation"
      @dismiss="closeEvaluationDetails"
    />
  </ion-page>
</template>
<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonCheckbox,
  IonLabel,
  IonSpinner,
  IonText,
  IonChip,
  IonSegment,
  IonSegmentButton
} from '@ionic/vue';
import {
  refreshOutline,
  closeOutline,
  starOutline,
  star,
  timerOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline
} from 'ionicons/icons';
import { useEvaluationsStore } from '@/stores/evaluationsStore';
import type { EvaluationWithMessage, AllEvaluationsFilters } from '@/types/evaluation';
import EvaluationDetailsModal from '@/components/EvaluationDetailsModal.vue';
const evaluationsStore = useEvaluationsStore();
const showDetailsModal = ref(false);
const selectedEvaluation = ref<EvaluationWithMessage | null>(null);
const selectedTab = ref('tasks'); // Default to task evaluations
const localFilters = ref<AllEvaluationsFilters>({
  page: 1,
  limit: 20
});
let filterTimeout: NodeJS.Timeout | null = null;
// Computed property for star icon
const starIcon = computed(() => star);
// Computed property to filter evaluations based on selected tab
const filteredEvaluations = computed(() => {
  const allEvaluations = evaluationsStore.evaluations;
  if (selectedTab.value === 'deliverables') {
    // Show evaluations that have deliverable type (indicating they're from deliverable-associated tasks)
    // This includes tasks that created deliverables, regardless of whether they were rated before or after the task_id was linked
    return allEvaluations.filter(evaluation =>
      evaluation.metadata?.deliverableType ||
      // Also include evaluations where the task likely created a deliverable based on agent name patterns
      (evaluation.metadata?.agentName &&
       (evaluation.metadata.agentName.includes('content') ||
        evaluation.metadata.agentName.includes('document') ||
        evaluation.metadata.agentName.includes('report') ||
        evaluation.metadata.agentName.includes('analysis')))
    );
  } else {
    // Show all task evaluations (including those that may have created deliverables)
    return allEvaluations;
  }
});
onMounted(() => {
  evaluationsStore.fetchEvaluations();
});
function refreshEvaluations() {
  evaluationsStore.refreshEvaluations();
}
function handleTabChange() {
  // Optionally reset pagination when switching tabs
  localFilters.value.page = 1;
}
function applyFilters() {
  evaluationsStore.applyFilters(localFilters.value);
}
function debounceFilter() {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
  filterTimeout = setTimeout(() => {
    applyFilters();
  }, 500);
}
function clearAllFilters() {
  localFilters.value = {
    page: 1,
    limit: 20
  };
  evaluationsStore.clearFilters();
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
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}
function truncateNotes(notes: string, maxLength: number = 150): string {
  if (notes.length <= maxLength) return notes;
  return notes.substring(0, maxLength) + '...';
}
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
<style scoped>
.tabs-card {
  margin-bottom: 1rem;
}
.tabs-card ion-segment {
  width: 100%;
}
.filters-card {
  margin-bottom: 1rem;
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
}
.rating-display {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}
.notes-preview {
  font-style: italic;
  margin: 0;
}
.pagination-info {
  margin-bottom: 1rem;
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
</style>