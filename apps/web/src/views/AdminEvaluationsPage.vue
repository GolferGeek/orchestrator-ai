<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Admin Evaluations</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="refreshData" :disabled="isLoading">
            <ion-icon :icon="refreshOutline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button fill="clear" @click="showExportModal = true">
            <ion-icon :icon="downloadOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <!-- Tab Navigation -->
      <ion-segment v-model="activeTab" @ionChange="onTabChange">
        <ion-segment-button value="overview">
          <ion-label>Overview</ion-label>
        </ion-segment-button>
        <ion-segment-button value="evaluations">
          <ion-label>All Evaluations</ion-label>
        </ion-segment-button>
        <ion-segment-button value="analytics">
          <ion-label>Analytics</ion-label>
        </ion-segment-button>
        <ion-segment-button value="workflows">
          <ion-label>Workflows</ion-label>
        </ion-segment-button>
      </ion-segment>

      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'">
        <AdminEvaluationOverview 
          :analytics="analytics"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>

      <!-- All Evaluations Tab -->
      <div v-if="activeTab === 'evaluations'">
        <AdminEvaluationsList 
          :evaluations="evaluations"
          :pagination="pagination"
          :is-loading="isLoading"
          :filters="filters"
          @filter-change="onFilterChange"
          @page-change="onPageChange"
          @refresh="refreshData"
        />
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'">
        <AdminAnalyticsView 
          :analytics="analytics"
          :workflow-analytics="workflowAnalytics"
          :constraint-analytics="constraintAnalytics"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>

      <!-- Workflows Tab -->
      <div v-if="activeTab === 'workflows'">
        <AdminWorkflowsView 
          :workflow-analytics="workflowAnalytics"
          :is-loading="isLoading"
          @refresh="refreshData"
        />
      </div>

      <!-- Error State -->
      <ion-card v-if="error" color="danger">
        <ion-card-content>
          <ion-text color="light">
            <h3>Error Loading Admin Data</h3>
            <p>{{ error }}</p>
          </ion-text>
          <ion-button fill="clear" color="light" @click="refreshData">
            Try Again
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>

    <!-- Export Modal -->
    <AdminExportModal 
      :is-open="showExportModal"
      @dismiss="showExportModal = false"
      @export="onExport"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue';
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
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonText
} from '@ionic/vue';
import {
  refreshOutline,
  downloadOutline
} from 'ionicons/icons';

// Import admin components (we'll create these)
import AdminEvaluationOverview from '@/components/Admin/AdminEvaluationOverview.vue';
import AdminEvaluationsList from '@/components/Admin/AdminEvaluationsList.vue';
import AdminAnalyticsView from '@/components/Admin/AdminAnalyticsView.vue';
import AdminWorkflowsView from '@/components/Admin/AdminWorkflowsView.vue';
import AdminExportModal from '@/components/Admin/AdminExportModal.vue';

// Import admin service
import { useAdminEvaluationStore } from '@/stores/adminEvaluationStore';

const adminStore = useAdminEvaluationStore();

// Reactive state
const activeTab = ref('overview');
const showExportModal = ref(false);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Data from store
const evaluations = ref<any[]>([]);
const pagination = ref<any>({});
const analytics = ref<any>(null);
const workflowAnalytics = ref<any>(null);
const constraintAnalytics = ref<any>(null);

// Filters
const filters = reactive({
  page: 1,
  limit: 20,
  minRating: undefined,
  maxRating: undefined,
  agentName: '',
  userEmail: '',
  startDate: '',
  endDate: '',
  hasNotes: undefined,
  hasWorkflowSteps: undefined,
  hasConstraints: undefined
});

onMounted(async () => {
  await refreshData();
});

async function refreshData() {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Load data based on active tab
    switch (activeTab.value) {
      case 'overview':
        await loadOverviewData();
        break;
      case 'evaluations':
        await loadEvaluationsData();
        break;
      case 'analytics':
        await loadAnalyticsData();
        break;
      case 'workflows':
        await loadWorkflowData();
        break;
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load admin data';
    console.error('Admin data loading error:', err);
  } finally {
    isLoading.value = false;
  }
}

async function loadOverviewData() {
  analytics.value = await adminStore.fetchAnalytics();
}

async function loadEvaluationsData() {
  const result = await adminStore.fetchAllEvaluations(filters);
  evaluations.value = result.evaluations;
  pagination.value = result.pagination;
}

async function loadAnalyticsData() {
  const [analyticsData, workflowData, constraintData] = await Promise.all([
    adminStore.fetchAnalytics(),
    adminStore.fetchWorkflowAnalytics(),
    adminStore.fetchConstraintAnalytics()
  ]);
  
  analytics.value = analyticsData;
  workflowAnalytics.value = workflowData;
  constraintAnalytics.value = constraintData;
}

async function loadWorkflowData() {
  workflowAnalytics.value = await adminStore.fetchWorkflowAnalytics();
}

async function onTabChange(event: CustomEvent) {
  activeTab.value = event.detail.value;
  await refreshData();
}

function onFilterChange(newFilters: any) {
  Object.assign(filters, newFilters);
  loadEvaluationsData();
}

function onPageChange(page: number) {
  filters.page = page;
  loadEvaluationsData();
}

async function onExport(exportOptions: any) {
  try {
    isLoading.value = true;
    await adminStore.exportEvaluations(exportOptions);
    showExportModal.value = false;
  } catch (err: any) {
    error.value = err.message || 'Export failed';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.ion-padding {
  padding: 16px;
}

ion-segment {
  margin-bottom: 20px;
}

.error-card {
  margin: 20px 0;
}
</style>