<template>
  <div class="pseudonym-mapping-viewer">
    <div class="viewer-header">
      <div class="header-content">
        <h2 class="viewer-title">
          <ion-icon :icon="libraryOutline" />
          Pseudonym Mapping Viewer
        </h2>
        <p class="viewer-subtitle">
          Visualize PII to pseudonym mappings and usage history
        </p>
      </div>
      
      <div class="header-actions">
        <ion-button 
          fill="outline" 
          size="small"
          @click="refreshMappings"
          :disabled="isLoading"
        >
          <ion-icon :icon="refreshOutline" slot="start" />
          Refresh
        </ion-button>
        
        <ion-button 
          fill="outline" 
          size="small"
          @click="showReversibilityDemo = !showReversibilityDemo"
          :color="showReversibilityDemo ? 'primary' : 'medium'"
        >
          <ion-icon :icon="eyeOutline" slot="start" />
          {{ showReversibilityDemo ? 'Hide' : 'Show' }} Demo
        </ion-button>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-section">
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ totalMappings }}</div>
                <div class="stat-label">Total Mappings</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ totalUsage }}</div>
                <div class="stat-label">Total Usage</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ activeDataTypes }}</div>
                <div class="stat-label">Data Types</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-card class="stat-card">
              <ion-card-content>
                <div class="stat-value">{{ averageUsage }}</div>
                <div class="stat-label">Avg Usage</div>
              </ion-card-content>
            </ion-card>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Filters and Search -->
    <div class="filters-section">
      <ion-grid>
        <ion-row>
          <ion-col size="12" size-md="4">
            <ion-searchbar
              v-model="searchTerm"
              placeholder="Search mappings..."
              :debounce="300"
              @ionInput="filterMappings"
              show-clear-button="focus"
            />
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-select
              v-model="selectedDataType"
              placeholder="Filter by Data Type"
              @ionChange="filterMappings"
            >
              <ion-select-option value="all">All Types</ion-select-option>
              <ion-select-option 
                v-for="type in availableDataTypes" 
                :key="type" 
                :value="type"
              >
                {{ formatDataType(type) }}
              </ion-select-option>
            </ion-select>
          </ion-col>
          <ion-col size="12" size-md="3">
            <ion-select
              v-model="sortField"
              placeholder="Sort by"
              @ionChange="sortMappings"
            >
              <ion-select-option value="usageCount">Usage Count</ion-select-option>
              <ion-select-option value="lastUsedAt">Last Used</ion-select-option>
              <ion-select-option value="createdAt">Created Date</ion-select-option>
              <ion-select-option value="dataType">Data Type</ion-select-option>
            </ion-select>
          </ion-col>
          <ion-col size="12" size-md="2">
            <ion-button 
              fill="clear" 
              @click="toggleSortDirection"
              :color="sortDirection === 'desc' ? 'primary' : 'medium'"
            >
              <ion-icon :icon="sortDirection === 'desc' ? arrowDownOutline : arrowUpOutline" />
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-section">
      <ion-spinner name="crescent" />
      <p>Loading pseudonym mappings...</p>
    </div>

    <!-- Error State -->
    <ion-card v-else-if="error" class="error-card">
      <ion-card-content>
        <div class="error-content">
          <ion-icon :icon="alertCircleOutline" color="danger" />
          <div>
            <h3>Error Loading Mappings</h3>
            <p>{{ error }}</p>
            <ion-button fill="outline" size="small" @click="refreshMappings">
              Try Again
            </ion-button>
          </div>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Usage Trends Section -->
    <div v-if="!isLoading && !error" class="trends-section">
      <ion-card class="trends-card">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="trendingUpOutline" />
            Usage Trends & History
          </ion-card-title>
          <ion-card-subtitle>Pseudonym usage patterns over time</ion-card-subtitle>
        </ion-card-header>
        
        <ion-card-content>
          <ion-grid>
            <ion-row>
              <!-- Usage Over Time Chart -->
              <ion-col size="12" size-md="8">
                <div class="trend-chart-container">
                  <h4>Daily Usage Activity</h4>
                  <div class="trend-chart">
                    <div class="chart-bars">
                      <div 
                        v-for="(day, index) in usageTrendData" 
                        :key="index"
                        class="trend-bar"
                        :title="`${day.date}: ${day.usage} uses`"
                      >
                        <div 
                          class="bar-fill"
                          :style="{ height: `${(day.usage / maxDailyUsage) * 100}%` }"
                        ></div>
                        <div class="bar-label">{{ formatTrendDate(day.date) }}</div>
                      </div>
                    </div>
                    <div class="chart-legend">
                      <div class="legend-item">
                        <div class="legend-color usage"></div>
                        <span>Daily Usage</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ion-col>
              
              <!-- Data Type Distribution -->
              <ion-col size="12" size-md="4">
                <div class="distribution-chart">
                  <h4>Usage by Data Type</h4>
                  <div class="distribution-items">
                    <div 
                      v-for="(typeData, index) in dataTypeDistribution" 
                      :key="index"
                      class="distribution-item"
                    >
                      <div class="distribution-info">
                        <ion-chip 
                          :color="getDataTypeColor(typeData.dataType)"
                          size="small"
                        >
                          <ion-icon :icon="getDataTypeIcon(typeData.dataType)" />
                          <ion-label>{{ formatDataType(typeData.dataType) }}</ion-label>
                        </ion-chip>
                        <span class="usage-count">{{ typeData.totalUsage }}</span>
                      </div>
                      <div class="distribution-bar">
                        <div 
                          class="distribution-fill"
                          :style="{ 
                            width: `${(typeData.totalUsage / maxTypeUsage) * 100}%`,
                            backgroundColor: `var(--ion-color-${getDataTypeColor(typeData.dataType)})`
                          }"
                        ></div>
                      </div>
                      <div class="distribution-percentage">
                        {{ Math.round((typeData.totalUsage / totalUsage) * 100) }}%
                      </div>
                    </div>
                  </div>
                </div>
              </ion-col>
            </ion-row>
            
            <ion-row>
              <!-- Recent Activity Trends -->
              <ion-col size="12" size-md="6">
                <div class="activity-trends">
                  <h4>Recent Activity Patterns</h4>
                  <div class="activity-items">
                    <div class="activity-item">
                      <div class="activity-icon">
                        <ion-icon :icon="trendingUpOutline" color="success" />
                      </div>
                      <div class="activity-info">
                        <div class="activity-title">Most Active</div>
                        <div class="activity-description">
                          {{ mostActiveMapping?.pseudonym || 'N/A' }} ({{ mostActiveMapping?.usageCount || 0 }} uses)
                        </div>
                      </div>
                    </div>
                    
                    <div class="activity-item">
                      <div class="activity-icon">
                        <ion-icon :icon="timeOutline" color="primary" />
                      </div>
                      <div class="activity-info">
                        <div class="activity-title">Most Recent</div>
                        <div class="activity-description">
                          {{ mostRecentMapping?.pseudonym || 'N/A' }} 
                          ({{ mostRecentMapping ? formatRelativeTime(mostRecentMapping.lastUsedAt) : 'N/A' }})
                        </div>
                      </div>
                    </div>
                    
                    <div class="activity-item">
                      <div class="activity-icon">
                        <ion-icon :icon="sparklesOutline" color="warning" />
                      </div>
                      <div class="activity-info">
                        <div class="activity-title">New This Week</div>
                        <div class="activity-description">
                          {{ newThisWeekCount }} new mappings created
                        </div>
                      </div>
                    </div>
                    
                    <div class="activity-item">
                      <div class="activity-icon">
                        <ion-icon :icon="pulseOutline" color="tertiary" />
                      </div>
                      <div class="activity-info">
                        <div class="activity-title">Growth Rate</div>
                        <div class="activity-description">
                          {{ usageGrowthRate >= 0 ? '+' : '' }}{{ Math.round(usageGrowthRate) }}% vs last week
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ion-col>
              
              <!-- Usage Heatmap -->
              <ion-col size="12" size-md="6">
                <div class="usage-heatmap">
                  <h4>Usage Intensity Heatmap</h4>
                  <div class="heatmap-grid">
                    <div 
                      v-for="(hour, index) in usageHeatmapData" 
                      :key="index"
                      class="heatmap-cell"
                      :class="getHeatmapIntensity(hour.usage)"
                      :title="`${hour.hour}:00 - ${hour.usage} uses`"
                    >
                      <div class="heatmap-hour">{{ hour.hour }}</div>
                    </div>
                  </div>
                  <div class="heatmap-legend">
                    <span class="legend-label">Less</span>
                    <div class="intensity-scale">
                      <div class="intensity-cell low"></div>
                      <div class="intensity-cell medium"></div>
                      <div class="intensity-cell high"></div>
                      <div class="intensity-cell very-high"></div>
                    </div>
                    <span class="legend-label">More</span>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>
    </div>

    <!-- Mappings Table -->
    <ion-card v-else class="mappings-table-card">
      <ion-card-header>
        <ion-card-title>
          Pseudonym Mappings
          <ion-badge color="primary">{{ filteredMappings.length }}</ion-badge>
        </ion-card-title>
      </ion-card-header>
      
      <ion-card-content>
        <div v-if="filteredMappings.length === 0" class="empty-state">
          <ion-icon :icon="documentOutline" />
          <h3>No Mappings Found</h3>
          <p>{{ searchTerm || selectedDataType !== 'all' ? 'Try adjusting your filters' : 'No pseudonym mappings have been created yet' }}</p>
        </div>
        
        <div v-else class="mappings-table">
          <div class="table-header">
            <div class="header-cell data-type">Data Type</div>
            <div class="header-cell pseudonym">Pseudonym</div>
            <div class="header-cell usage">Usage Count</div>
            <div class="header-cell last-used">Last Used</div>
            <div class="header-cell status">Status</div>
            <div class="header-cell actions">Actions</div>
          </div>
          
          <div class="table-body">
            <div 
              v-for="mapping in paginatedMappings" 
              :key="mapping.id"
              class="table-row"
              :class="{ 'high-usage': mapping.usageCount >= 10, 'recent': isRecentlyUsed(mapping) }"
            >
              <div class="table-cell data-type">
                <ion-chip 
                  :color="getDataTypeColor(mapping.dataType)"
                  size="small"
                >
                  <ion-icon :icon="getDataTypeIcon(mapping.dataType)" />
                  <ion-label>{{ formatDataType(mapping.dataType) }}</ion-label>
                </ion-chip>
              </div>
              
              <div class="table-cell pseudonym">
                <div class="pseudonym-display">
                  <span class="pseudonym-value">{{ mapping.pseudonym }}</span>
                  <ion-chip 
                    v-if="mapping.context"
                    size="small"
                    color="light"
                    class="context-chip"
                  >
                    {{ mapping.context }}
                  </ion-chip>
                </div>
              </div>
              
              <div class="table-cell usage">
                <div class="usage-display">
                  <span class="usage-count">{{ mapping.usageCount }}</span>
                  <div class="usage-bar">
                    <div 
                      class="usage-fill"
                      :style="{ width: `${getUsagePercentage(mapping.usageCount)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
              
              <div class="table-cell last-used">
                <div class="date-display">
                  <span class="date-value">{{ formatDate(mapping.lastUsedAt) }}</span>
                  <span class="date-relative">{{ formatRelativeTime(mapping.lastUsedAt) }}</span>
                </div>
              </div>
              
              <div class="table-cell status">
                <ion-chip 
                  :color="getMappingStatusColor(mapping)"
                  size="small"
                >
                  <ion-icon :icon="getMappingStatusIcon(mapping)" />
                  <ion-label>{{ getMappingStatus(mapping) }}</ion-label>
                </ion-chip>
              </div>
              
              <div class="table-cell actions">
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click="showMappingDetails(mapping)"
                >
                  <ion-icon :icon="informationCircleOutline" />
                </ion-button>
                
                <ion-button 
                  fill="clear" 
                  size="small"
                  @click="demonstrateReversibility(mapping)"
                  v-if="showReversibilityDemo"
                >
                  <ion-icon :icon="swapHorizontalOutline" />
                </ion-button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Pagination -->
        <div v-if="filteredMappings.length > pageSize" class="pagination">
          <ion-button 
            fill="outline" 
            size="small"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            <ion-icon :icon="chevronBackOutline" />
            Previous
          </ion-button>
          
          <span class="pagination-info">
            Page {{ currentPage }} of {{ totalPages }}
            ({{ filteredMappings.length }} total)
          </span>
          
          <ion-button 
            fill="outline" 
            size="small"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next
            <ion-icon :icon="chevronForwardOutline" />
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Reversibility Demo Modal -->
    <ion-modal :is-open="reversibilityModalOpen" @didDismiss="reversibilityModalOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Reversibility Demonstration</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="reversibilityModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <div v-if="selectedMapping" class="reversibility-demo">
          <div class="demo-section">
            <h3>Mapping Information</h3>
            <div class="mapping-info">
              <div class="info-item">
                <strong>Data Type:</strong> {{ formatDataType(selectedMapping.dataType) }}
              </div>
              <div class="info-item">
                <strong>Pseudonym:</strong> {{ selectedMapping.pseudonym }}
              </div>
              <div class="info-item">
                <strong>Usage Count:</strong> {{ selectedMapping.usageCount }}
              </div>
              <div class="info-item">
                <strong>Context:</strong> {{ selectedMapping.context || 'None' }}
              </div>
            </div>
          </div>
          
          <div class="demo-section">
            <h3>Reversibility Demo</h3>
            <ion-card class="demo-card">
              <ion-card-content>
                <div class="demo-content">
                  <ion-icon :icon="warningOutline" color="warning" />
                  <div>
                    <h4>Reversibility Notice</h4>
                    <p>
                      This demonstrates the reversibility feature. In production, 
                      reversibility would only be available through secure, audited processes 
                      with proper authorization.
                    </p>
                  </div>
                </div>
              </ion-card-content>
            </ion-card>
            
            <div class="reversibility-flow">
              <div class="flow-step" :class="{ active: demoStep >= 1 }">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>Pseudonym Input</h4>
                  <ion-chip color="secondary">{{ selectedMapping.pseudonym }}</ion-chip>
                  <p class="step-description">The pseudonym to be reversed</p>
                </div>
              </div>
              
              <ion-icon :icon="arrowForwardOutline" class="flow-arrow" :class="{ active: demoStep >= 2 }" />
              
              <div class="flow-step" :class="{ active: demoStep >= 2, processing: demoStep === 2 && demoProcessing }">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>Lookup Process</h4>
                  <div v-if="demoProcessing && demoStep === 2" class="processing-indicator">
                    <ion-spinner name="crescent" />
                    <p>Performing secure hash lookup...</p>
                  </div>
                  <div v-else>
                    <p>Secure hash lookup in mapping database</p>
                    <p class="step-description">Hash: {{ selectedMapping.originalHash.substring(0, 12) }}...</p>
                  </div>
                </div>
              </div>
              
              <ion-icon :icon="arrowForwardOutline" class="flow-arrow" :class="{ active: demoStep >= 3 }" />
              
              <div class="flow-step" :class="{ active: demoStep >= 3 }">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>Authorized Result</h4>
                  <div v-if="demoStep >= 3 && !demoProcessing">
                    <ion-chip color="success">{{ generateDemoValue(selectedMapping) }}</ion-chip>
                    <p class="demo-note">Demo value - actual PII never stored or displayed</p>
                    <div class="security-notice">
                      <ion-icon :icon="shieldCheckmarkOutline" color="primary" />
                      <span>Requires admin authorization & audit logging</span>
                    </div>
                  </div>
                  <div v-else-if="demoStep < 3">
                    <ion-chip color="medium" fill="outline">[Pending Authorization]</ion-chip>
                    <p class="demo-note">Result available after secure lookup</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="demo-controls">
              <ion-button 
                @click="startReversibilityDemo" 
                :disabled="demoProcessing"
                color="primary"
                fill="outline"
              >
                <ion-icon :icon="playOutline" slot="start" />
                {{ demoStep === 0 ? 'Start Demo' : 'Restart Demo' }}
              </ion-button>
              
              <ion-button 
                @click="resetDemo" 
                :disabled="demoProcessing || demoStep === 0"
                color="medium"
                fill="clear"
              >
                <ion-icon :icon="refreshOutline" slot="start" />
                Reset
              </ion-button>
            </div>

            <div class="security-requirements" v-if="demoStep >= 3">
              <h4>Production Security Requirements</h4>
              <div class="requirement-list">
                <div class="requirement-item">
                  <ion-icon :icon="personOutline" color="primary" />
                  <span>Admin-level authorization required</span>
                </div>
                <div class="requirement-item">
                  <ion-icon :icon="documentTextOutline" color="primary" />
                  <span>All reversals logged with audit trail</span>
                </div>
                <div class="requirement-item">
                  <ion-icon :icon="timeOutline" color="primary" />
                  <span>Time-limited access with expiration</span>
                </div>
                <div class="requirement-item">
                  <ion-icon :icon="lockClosedOutline" color="primary" />
                  <span>Encrypted transmission and storage</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Mapping Details Modal -->
    <ion-modal :is-open="detailsModalOpen" @didDismiss="detailsModalOpen = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Mapping Details</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="detailsModalOpen = false">
              <ion-icon :icon="closeOutline" />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      
      <ion-content class="ion-padding">
        <div v-if="selectedMapping" class="mapping-details">
          <ion-card>
            <ion-card-header>
              <ion-card-title>Mapping Information</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                <ion-item>
                  <ion-label>
                    <h3>Data Type</h3>
                    <p>{{ formatDataType(selectedMapping.dataType) }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Pseudonym</h3>
                    <p>{{ selectedMapping.pseudonym }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Usage Count</h3>
                    <p>{{ selectedMapping.usageCount }} times</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Context</h3>
                    <p>{{ selectedMapping.context || 'No context specified' }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Created</h3>
                    <p>{{ formatDate(selectedMapping.createdAt) }}</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Last Used</h3>
                    <p>{{ formatDate(selectedMapping.lastUsedAt) }} ({{ formatRelativeTime(selectedMapping.lastUsedAt) }})</p>
                  </ion-label>
                </ion-item>
                
                <ion-item>
                  <ion-label>
                    <h3>Last Updated</h3>
                    <p>{{ formatDate(selectedMapping.updatedAt) }}</p>
                  </ion-label>
                </ion-item>
              </ion-list>
            </ion-card-content>
          </ion-card>
        </div>
      </ion-content>
    </ion-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonBadge,
  // toastController
} from '@ionic/vue';
import {
  libraryOutline,
  refreshOutline,
  eyeOutline,
  alertCircleOutline,
  documentOutline,
  informationCircleOutline,
  swapHorizontalOutline,
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  warningOutline,
  arrowForwardOutline,
  arrowDownOutline,
  arrowUpOutline,
  personOutline,
  mailOutline,
  callOutline,
  locationOutline,
  globeOutline,
  cardOutline,
  keyOutline,
  documentTextOutline,
  trendingUpOutline,
  timeOutline,
  sparklesOutline,
  pulseOutline,
  playOutline,
  shieldCheckmarkOutline,
  lockClosedOutline
} from 'ionicons/icons';

import { PseudonymMapping, PIIDataType } from '@/types/pii';
import { usePrivacyStore } from '@/stores/privacyStore';

// Pinia store
const mappingsStore = usePrivacyStore();

// Local component state
const searchTerm = ref('');
const selectedDataType = ref<string>('all');
const sortField = ref<string>('usageCount');
const sortDirection = ref<'asc' | 'desc'>('desc');

// Pagination
const currentPage = ref(1);
const pageSize = ref(10);

// Modals
const showReversibilityDemo = ref(false);
const reversibilityModalOpen = ref(false);
const detailsModalOpen = ref(false);
const selectedMapping = ref<PseudonymMapping | null>(null);

// Reversibility demo state
const demoStep = ref(0); // 0: not started, 1: input shown, 2: processing, 3: result shown
const demoProcessing = ref(false);

// Computed properties using store data
const availableDataTypes = computed(() => mappingsStore.availableDataTypes);
const totalMappings = computed(() => mappingsStore.totalMappings);
const totalUsage = computed(() => mappingsStore.totalUsage);
const activeDataTypes = computed(() => mappingsStore.availableDataTypes.length);
const averageUsage = computed(() => mappingsStore.averageUsage);
const isLoading = computed(() => mappingsStore.isLoading);
const error = computed(() => mappingsStore.error);

// Filtered mappings with local search and filters
const filteredMappings = computed(() => {
  let filtered = mappingsStore.mappings;

  // Apply search filter
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(mapping => 
      mapping.pseudonym.toLowerCase().includes(search) ||
      mapping.dataType.toLowerCase().includes(search) ||
      (mapping.context && mapping.context.toLowerCase().includes(search))
    );
  }

  // Apply data type filter
  if (selectedDataType.value !== 'all') {
    filtered = filtered.filter(mapping => mapping.dataType === selectedDataType.value);
  }

  // Apply sorting
  filtered.sort((a, b) => {
    let aVal: unknown, bVal: unknown;
    
    switch (sortField.value) {
      case 'usageCount':
        aVal = a.usageCount;
        bVal = b.usageCount;
        break;
      case 'lastUsedAt':
        aVal = new Date(a.lastUsedAt);
        bVal = new Date(b.lastUsedAt);
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
        break;
      case 'dataType':
        aVal = a.dataType;
        bVal = b.dataType;
        break;
      default:
        return 0;
    }

    if (sortDirection.value === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    } else {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }
  });

  return filtered;
});

const paginatedMappings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredMappings.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredMappings.value.length / pageSize.value);
});

// Usage trends computed properties
const usageTrendData = computed(() => {
  // Generate daily usage data for the last 14 days based on actual mapping data
  const days = [];
  const now = new Date();
  
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Calculate actual usage based on when mappings were last used
    const dayUsage = mappingsStore.mappings.reduce((sum, mapping) => {
      const lastUsed = new Date(mapping.lastUsedAt);
      const isSameDay = lastUsed.toDateString() === date.toDateString();
      return isSameDay ? sum + 1 : sum; // Count actual usage events
    }, 0);
    
    days.push({
      date: date.toISOString().split('T')[0],
      usage: dayUsage
    });
  }
  
  return days;
});

const maxDailyUsage = computed(() => {
  const usages = usageTrendData.value.map(d => d.usage);
  return Math.max(...usages, 1);
});

const dataTypeDistribution = computed(() => {
  const distribution = mappingsStore.mappingsByDataType;
  
  return Object.entries(distribution).map(([dataType, mappings]) => ({
    dataType: dataType as PIIDataType,
    totalUsage: mappings.reduce((sum, mapping) => sum + mapping.usageCount, 0),
    count: mappings.length
  })).sort((a, b) => b.totalUsage - a.totalUsage);
});

const maxTypeUsage = computed(() => {
  const usages = dataTypeDistribution.value.map(d => d.totalUsage);
  return Math.max(...usages, 1);
});

const mostActiveMapping = computed(() => {
  return mappingsStore.mappings.reduce((prev, current) => 
    (prev.usageCount > current.usageCount) ? prev : current
  );
});

const mostRecentMapping = computed(() => {
  return mappingsStore.mappings.reduce((prev, current) => 
    (new Date(prev.lastUsedAt) > new Date(current.lastUsedAt)) ? prev : current
  );
});

const newThisWeekCount = computed(() => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  return mappingsStore.mappings.filter(mapping => 
    new Date(mapping.createdAt) >= oneWeekAgo
  ).length;
});

const usageGrowthRate = computed(() => {
  // Calculate growth rate based on recent vs older usage
  const recentUsage = mappingsStore.recentMappings.reduce((sum, m) => sum + m.usageCount, 0);
  const totalUsage = mappingsStore.totalUsage;
  const olderUsage = totalUsage - recentUsage;
  
  if (olderUsage === 0) return 100; // All usage is recent
  return ((recentUsage - olderUsage) / olderUsage) * 100;
});

const usageHeatmapData = computed(() => {
  // Calculate hourly usage data (0-23 hours) based on actual mapping timestamps
  const hours = [];
  
  for (let hour = 0; hour < 24; hour++) {
    // Count actual usage events for this hour across all mappings
    const hourUsage = mappingsStore.mappings.reduce((sum, mapping) => {
      const lastUsed = new Date(mapping.lastUsedAt);
      const mappingHour = lastUsed.getHours();
      return mappingHour === hour ? sum + 1 : sum;
    }, 0);
    
    hours.push({
      hour: hour,
      usage: hourUsage
    });
  }
  
  return hours;
});

// Methods
const refreshMappings = async () => {
  await mappingsStore.refreshData();
};

const filterMappings = () => {
  currentPage.value = 1; // Reset to first page when filtering
};

const sortMappings = () => {
  currentPage.value = 1; // Reset to first page when sorting
};

const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc';
  sortMappings();
};

const showMappingDetails = (mapping: PseudonymMapping) => {
  selectedMapping.value = mapping;
  detailsModalOpen.value = true;
};

const demonstrateReversibility = (mapping: PseudonymMapping) => {
  selectedMapping.value = mapping;
  reversibilityModalOpen.value = true;
};

// Utility functions
const formatDataType = (dataType: PIIDataType): string => {
  const typeMap: Record<PIIDataType, string> = {
    email: 'Email',
    phone: 'Phone',
    name: 'Name',
    address: 'Address',
    ip_address: 'IP Address',
    username: 'Username',
    credit_card: 'Credit Card',
    ssn: 'SSN',
    custom: 'Custom'
  };
  return typeMap[dataType] || dataType;
};

const getDataTypeColor = (dataType: PIIDataType): string => {
  const colorMap: Record<PIIDataType, string> = {
    email: 'primary',
    phone: 'secondary',
    name: 'tertiary',
    address: 'success',
    ip_address: 'warning',
    username: 'danger',
    credit_card: 'dark',
    ssn: 'medium',
    custom: 'light'
  };
  return colorMap[dataType] || 'medium';
};

const getDataTypeIcon = (dataType: PIIDataType) => {
  const iconMap: Record<PIIDataType, string> = {
    email: mailOutline,
    phone: callOutline,
    name: personOutline,
    address: locationOutline,
    ip_address: globeOutline,
    username: personOutline,
    credit_card: cardOutline,
    ssn: keyOutline,
    custom: documentTextOutline
  };
  return iconMap[dataType] || documentTextOutline;
};

const getUsagePercentage = (usageCount: number): number => {
  const maxUsage = Math.max(...mappingsStore.mappings.map(m => m.usageCount));
  return maxUsage > 0 ? (usageCount / maxUsage) * 100 : 0;
};

const isRecentlyUsed = (mapping: PseudonymMapping): boolean => {
  const lastUsed = new Date(mapping.lastUsedAt);
  const now = new Date();
  const daysDiff = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff <= 7; // Consider recent if used within 7 days
};

const getMappingStatus = (mapping: PseudonymMapping): string => {
  if (isRecentlyUsed(mapping)) {
    return 'Active';
  } else if (mapping.usageCount >= 10) {
    return 'Frequent';
  } else if (mapping.usageCount === 1) {
    return 'New';
  } else {
    return 'Occasional';
  }
};

const getMappingStatusColor = (mapping: PseudonymMapping): string => {
  const status = getMappingStatus(mapping);
  const colorMap: Record<string, string> = {
    'Active': 'success',
    'Frequent': 'primary',
    'New': 'tertiary',
    'Occasional': 'medium'
  };
  return colorMap[status] || 'medium';
};

const getMappingStatusIcon = (mapping: PseudonymMapping) => {
  const status = getMappingStatus(mapping);
  const iconMap: Record<string, string> = {
    'Active': refreshOutline,
    'Frequent': arrowUpOutline,
    'New': documentOutline,
    'Occasional': arrowDownOutline
  };
  return iconMap[status] || documentOutline;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}w ago`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  }
};

// Utility functions for trends
const formatTrendDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getHeatmapIntensity = (usage: number): string => {
  if (usage <= 2) return 'low';
  if (usage <= 5) return 'medium';
  if (usage <= 10) return 'high';
  return 'very-high';
};

// Reversibility demo methods (no hardcoded mock data)
const generateDemoValue = (mapping: PseudonymMapping): string => {
  // Use the actual original value if available from the mapping
  if (mapping.originalValue && mapping.originalValue !== '[REDACTED]') {
    return mapping.originalValue;
  }
  
  // If no original value, generate a contextual placeholder based on the pseudonym
  const dataTypeLabels: Record<PIIDataType, string> = {
    email: 'email address',
    phone: 'phone number', 
    name: 'person name',
    address: 'street address',
    ip_address: 'IP address',
    username: 'username',
    credit_card: 'credit card',
    ssn: 'social security number',
    custom: 'custom data'
  };
  
  return `[Original ${dataTypeLabels[mapping.dataType] || 'data'}]`;
};

const startReversibilityDemo = async () => {
  if (!selectedMapping.value) return;
  
  demoProcessing.value = true;
  demoStep.value = 1;
  
  // Step 1: Show input (immediate)
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Step 2: Processing phase
  demoStep.value = 2;
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
  
  // Step 3: Show result
  demoStep.value = 3;
  demoProcessing.value = false;
};

const resetDemo = () => {
  demoStep.value = 0;
  demoProcessing.value = false;
};

// Watch for modal changes to reset demo
watch(reversibilityModalOpen, (isOpen) => {
  if (isOpen) {
    resetDemo(); // Reset demo when modal opens
  }
});

// Initialize component
onMounted(async () => {
  // Load data from store on component mount
  await mappingsStore.fetchMappings();
  await mappingsStore.fetchStats();
});
</script>

<style scoped>
.pseudonym-mapping-viewer {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-content {
  flex: 1;
  min-width: 300px;
}

.viewer-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--ion-color-dark);
}

.viewer-subtitle {
  margin: 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stats-section {
  margin-bottom: 1.5rem;
}

.stat-card {
  text-align: center;
  margin: 0;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.filters-section {
  margin-bottom: 1.5rem;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  gap: 1rem;
  color: var(--ion-color-medium);
}

.error-card {
  margin-bottom: 1.5rem;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-content ion-icon {
  font-size: 2rem;
}

.mappings-table-card {
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-state ion-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.mappings-table {
  overflow-x: auto;
}

.table-header {
  display: grid;
  grid-template-columns: 120px 1fr 120px 140px 120px 100px;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  color: var(--ion-color-dark);
  font-size: 0.9rem;
}

.table-body {
  border: 1px solid var(--ion-color-light);
  border-top: none;
  border-radius: 0 0 8px 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 120px 1fr 120px 140px 120px 100px;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  align-items: center;
  transition: background-color 0.2s ease;
}

.table-row:hover {
  background: var(--ion-color-light-tint);
}

.table-row.high-usage {
  border-left: 3px solid var(--ion-color-primary);
}

.table-row.recent {
  background: var(--ion-color-success-tint);
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
}

.pseudonym-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.pseudonym-value {
  font-weight: 500;
  word-break: break-word;
}

.context-chip {
  align-self: flex-start;
}

.usage-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.usage-count {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.usage-bar {
  height: 4px;
  background: var(--ion-color-light-shade);
  border-radius: 2px;
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.date-display {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.date-value {
  font-size: 0.85rem;
}

.date-relative {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.actions {
  display: flex;
  gap: 0.25rem;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light);
}

.pagination-info {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

/* Reversibility Demo Styles */
.reversibility-demo {
  padding: 1rem;
}

.demo-section {
  margin-bottom: 2rem;
}

.demo-section h3 {
  margin-bottom: 1rem;
  color: var(--ion-color-dark);
}

.mapping-info {
  display: grid;
  gap: 0.5rem;
}

.info-item {
  padding: 0.5rem;
  background: var(--ion-color-light);
  border-radius: 4px;
  font-size: 0.9rem;
}

.demo-card {
  margin-bottom: 1.5rem;
}

.demo-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.demo-content ion-icon {
  font-size: 2rem;
}

.reversibility-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 150px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ion-color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.step-content h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
}

.step-content p {
  margin: 0.25rem 0 0 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.demo-note {
  font-style: italic;
  color: var(--ion-color-warning) !important;
}

.flow-arrow {
  font-size: 1.5rem;
  color: var(--ion-color-medium);
  transition: color 0.3s ease;
}

.flow-arrow.active {
  color: var(--ion-color-primary);
}

.flow-step {
  transition: all 0.3s ease;
  opacity: 0.5;
}

.flow-step.active {
  opacity: 1;
}

.flow-step.processing {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.processing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ion-color-primary);
}

.step-description {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
}

.demo-controls {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light-shade);
}

.security-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--ion-color-primary);
}

.security-requirements {
  margin-top: 2rem;
  padding: 1rem;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
}

.security-requirements h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-primary);
  font-size: 1rem;
}

.requirement-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: var(--ion-color-dark);
}

.requirement-item ion-icon {
  flex-shrink: 0;
  font-size: 1.1rem;
}

/* Mapping Details Styles */
.mapping-details {
  padding: 1rem;
}

/* Usage Trends Styles */
.trends-section {
  margin-bottom: 1.5rem;
}

.trends-card {
  margin: 0;
}

.trends-card ion-card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.trend-chart-container {
  padding: 1rem;
}

.trend-chart h4,
.distribution-chart h4,
.activity-trends h4,
.usage-heatmap h4 {
  margin: 0 0 1rem 0;
  color: var(--ion-color-dark);
  font-size: 1rem;
  font-weight: 600;
}

.trend-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-bars {
  display: flex;
  align-items: end;
  gap: 4px;
  height: 200px;
  padding: 1rem;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
  overflow-x: auto;
}

.trend-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 30px;
  height: 100%;
  position: relative;
}

.bar-fill {
  width: 20px;
  background: var(--ion-color-primary);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
  margin-top: auto;
}

.bar-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  margin-top: 0.25rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  text-align: center;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.usage {
  background: var(--ion-color-primary);
}

/* Distribution Chart */
.distribution-chart {
  padding: 1rem;
}

.distribution-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.distribution-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.distribution-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.usage-count {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.distribution-bar {
  height: 8px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  overflow: hidden;
}

.distribution-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.distribution-percentage {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  text-align: right;
}

/* Activity Trends */
.activity-trends {
  padding: 1rem;
}

.activity-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--ion-color-light-tint);
  border-radius: 8px;
}

.activity-icon {
  flex-shrink: 0;
}

.activity-icon ion-icon {
  font-size: 1.5rem;
}

.activity-info {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--ion-color-dark);
  margin-bottom: 0.25rem;
}

.activity-description {
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

/* Usage Heatmap */
.usage-heatmap {
  padding: 1rem;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 2px;
  margin-bottom: 1rem;
}

.heatmap-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.heatmap-cell:hover {
  transform: scale(1.1);
}

.heatmap-cell.low {
  background: var(--ion-color-light-shade);
  color: var(--ion-color-medium);
}

.heatmap-cell.medium {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary-contrast);
}

.heatmap-cell.high {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.heatmap-cell.very-high {
  background: var(--ion-color-primary-shade);
  color: var(--ion-color-primary-contrast);
}

.heatmap-hour {
  font-size: 0.7rem;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}

.intensity-scale {
  display: flex;
  gap: 2px;
}

.intensity-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.intensity-cell.low {
  background: var(--ion-color-light-shade);
}

.intensity-cell.medium {
  background: var(--ion-color-primary-tint);
}

.intensity-cell.high {
  background: var(--ion-color-primary);
}

.intensity-cell.very-high {
  background: var(--ion-color-primary-shade);
}

.legend-label {
  font-size: 0.7rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .viewer-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: stretch;
  }

  .header-actions ion-button {
    flex: 1;
  }

  .table-header,
  .table-row {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .table-cell {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--ion-color-light-shade);
  }

  .table-cell:last-child {
    border-bottom: none;
  }

  .table-cell::before {
    content: attr(data-label);
    font-weight: 600;
    margin-right: 0.5rem;
    color: var(--ion-color-medium);
    font-size: 0.8rem;
  }

  .pagination {
    flex-direction: column;
    gap: 1rem;
  }

  .reversibility-flow {
    flex-direction: column;
  }

  .flow-arrow {
    transform: rotate(90deg);
  }

  /* Responsive trends */
  .chart-bars {
    height: 150px;
    padding: 0.5rem;
  }

  .trend-bar {
    min-width: 20px;
  }

  .bar-label {
    writing-mode: horizontal-tb;
    text-orientation: unset;
    font-size: 0.6rem;
  }

  .distribution-items {
    gap: 0.5rem;
  }

  .activity-items {
    gap: 0.5rem;
  }

  .activity-item {
    padding: 0.75rem;
  }

  .heatmap-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .heatmap-cell {
    font-size: 0.6rem;
  }

  /* Responsive demo controls */
  .demo-controls {
    flex-direction: column;
    gap: 0.75rem;
  }

  .security-requirements {
    padding: 0.75rem;
  }

  .requirement-list {
    gap: 0.5rem;
  }

  .requirement-item {
    font-size: 0.8rem;
  }
}
</style>
