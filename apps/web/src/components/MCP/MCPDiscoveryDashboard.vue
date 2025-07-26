<template>
  <div class="mcp-discovery-dashboard">
    <!-- Header -->
    <ion-card class="header-card">
      <ion-card-header>
        <ion-card-title>
          <ion-icon :icon="layersOutline" class="title-icon"></ion-icon>
          MCP Discovery Dashboard
        </ion-card-title>
        <ion-card-subtitle>
          Model Context Protocol Service Management
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <div class="header-actions">
          <ion-button 
            @click="refreshData" 
            :disabled="isLoading"
            fill="outline"
            size="small"
          >
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Refresh
          </ion-button>
          <ion-button 
            @click="triggerDiscovery" 
            :disabled="isDiscovering"
            color="primary"
            size="small"
          >
            <ion-icon :icon="searchOutline" slot="start"></ion-icon>
            {{ isDiscovering ? 'Discovering...' : 'Discover MCPs' }}
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>

    <!-- Health Status -->
    <MCPHealthCard 
      :health="healthInfo" 
      :stats="poolStats" 
      @refresh="refreshHealthData"
    />

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- MCP Services List -->
      <div class="services-section">
        <MCPServicesList 
          :mcps="mcpServices" 
          :loading="isLoading"
          @execute-tool="handleToolExecution"
          @view-details="handleViewDetails"
          @refresh="refreshMCPList"
        />
      </div>

      <!-- Statistics and Tools -->
      <div class="stats-section">
        <MCPPoolStats 
          :stats="poolStats" 
          :loading="isLoading"
          @type-filter="handleTypeFilter"
          @provider-filter="handleProviderFilter"
        />
        
        <MCPToolsOverview 
          :tools="availableTools" 
          :loading="isLoading"
          @execute-tool="handleToolExecution"
        />
      </div>
    </div>

    <!-- Discovery Results Modal -->
    <ion-modal :is-open="showDiscoveryResults" @did-dismiss="showDiscoveryResults = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Discovery Results</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showDiscoveryResults = false">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <MCPDiscoveryResults 
          :results="discoveryResults" 
          @close="showDiscoveryResults = false"
        />
      </ion-content>
    </ion-modal>

    <!-- Tool Execution Modal -->
    <ion-modal :is-open="showToolExecution" @did-dismiss="showToolExecution = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>Execute MCP Tool</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showToolExecution = false">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <MCPToolExecutor 
          :mcp="selectedMCP" 
          :tool="selectedTool"
          @execution-complete="handleExecutionComplete"
          @close="showToolExecution = false"
        />
      </ion-content>
    </ion-modal>

    <!-- MCP Details Modal -->
    <ion-modal :is-open="showMCPDetails" @did-dismiss="showMCPDetails = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ selectedMCP?.name || 'MCP Details' }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showMCPDetails = false">
              <ion-icon :icon="closeOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <MCPDetailsView 
          :mcp="selectedMCP" 
          @close="showMCPDetails = false"
          @execute-tool="handleToolExecution"
        />
      </ion-content>
    </ion-modal>

    <!-- Loading Overlay -->
    <ion-loading
      :is-open="isLoading && isInitialLoad"
      message="Loading MCP services..."
    />

    <!-- Toast for notifications -->
    <ion-toast
      :is-open="showToast"
      :message="toastMessage"
      :color="toastColor"
      :duration="3000"
      @did-dismiss="showToast = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonLoading,
  IonToast
} from '@ionic/vue';
import {
  layersOutline,
  refreshOutline,
  searchOutline,
  closeOutline
} from 'ionicons/icons';

import MCPHealthCard from './MCPHealthCard.vue';
import MCPServicesList from './MCPServicesList.vue';
import MCPPoolStats from './MCPPoolStats.vue';
import MCPToolsOverview from './MCPToolsOverview.vue';
import MCPDiscoveryResults from './MCPDiscoveryResults.vue';
import MCPToolExecutor from './MCPToolExecutor.vue';
import MCPDetailsView from './MCPDetailsView.vue';

import { mcpService } from '@/services/mcpService';
import type {
  MCPRegistration,
  MCPPoolStats as MCPPoolStatsType,
  MCPHealthInfo,
  MCPToolsInfo,
  MCPDiscoveryResult,
  MCPTool
} from '@/types/mcp';

// Reactive state
const isLoading = ref(false);
const isInitialLoad = ref(true);
const isDiscovering = ref(false);
const mcpServices = ref<MCPRegistration[]>([]);
const poolStats = ref<MCPPoolStatsType | null>(null);
const healthInfo = ref<MCPHealthInfo | null>(null);
const availableTools = ref<MCPToolsInfo | null>(null);
const discoveryResults = ref<MCPDiscoveryResult | null>(null);

// Modal states
const showDiscoveryResults = ref(false);
const showToolExecution = ref(false);
const showMCPDetails = ref(false);

// Selected items for modals
const selectedMCP = ref<MCPRegistration | null>(null);
const selectedTool = ref<MCPTool | null>(null);

// Toast notifications
const showToast = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger' | 'warning'>('success');

// Filter states
const typeFilter = ref<string | null>(null);
const providerFilter = ref<string | null>(null);

// Computed filtered services
const filteredMCPServices = computed(() => {
  let filtered = mcpServices.value;
  
  if (typeFilter.value) {
    filtered = filtered.filter(mcp => mcp.type === typeFilter.value);
  }
  
  if (providerFilter.value) {
    filtered = filtered.filter(mcp => mcp.provider === providerFilter.value);
  }
  
  return filtered;
});

// Methods
const showToastMessage = (message: string, color: 'success' | 'danger' | 'warning' = 'success') => {
  toastMessage.value = message;
  toastColor.value = color;
  showToast.value = true;
};

const refreshData = async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      refreshHealthData(),
      refreshMCPList(),
      refreshStats(),
      refreshTools()
    ]);
    showToastMessage('Data refreshed successfully');
  } catch (error) {
    console.error('Error refreshing data:', error);
    showToastMessage('Failed to refresh data', 'danger');
  } finally {
    isLoading.value = false;
    isInitialLoad.value = false;
  }
};

const refreshHealthData = async () => {
  try {
    healthInfo.value = await mcpService.getPoolHealth();
  } catch (error) {
    console.error('Error fetching health data:', error);
  }
};

const refreshMCPList = async () => {
  try {
    mcpServices.value = await mcpService.getRegisteredMCPs();
  } catch (error) {
    console.error('Error fetching MCP list:', error);
    showToastMessage('Failed to load MCP services', 'danger');
  }
};

const refreshStats = async () => {
  try {
    poolStats.value = await mcpService.getPoolStats();
  } catch (error) {
    console.error('Error fetching pool stats:', error);
  }
};

const refreshTools = async () => {
  try {
    availableTools.value = await mcpService.getAllAvailableTools();
  } catch (error) {
    console.error('Error fetching available tools:', error);
  }
};

const triggerDiscovery = async () => {
  isDiscovering.value = true;
  try {
    discoveryResults.value = await mcpService.triggerDiscovery();
    showDiscoveryResults.value = true;
    
    // Refresh data after discovery
    await refreshData();
    
    showToastMessage(
      `Discovery completed: ${discoveryResults.value.totalFound} services found`
    );
  } catch (error) {
    console.error('Error during discovery:', error);
    showToastMessage('Discovery failed', 'danger');
  } finally {
    isDiscovering.value = false;
  }
};

const handleToolExecution = (mcp: MCPRegistration | null, tool: MCPTool) => {
  if (!mcp) return;
  selectedMCP.value = mcp;
  selectedTool.value = tool;
  showToolExecution.value = true;
};

const handleViewDetails = (mcp: MCPRegistration) => {
  selectedMCP.value = mcp;
  showMCPDetails.value = true;
};

const handleExecutionComplete = (result: any) => {
  showToolExecution.value = false;
  
  if (result.success) {
    showToastMessage('Tool executed successfully');
  } else {
    showToastMessage(`Tool execution failed: ${result.error}`, 'danger');
  }
  
  // Refresh data to update metrics
  refreshData();
};

const handleTypeFilter = (type: string | null) => {
  typeFilter.value = type;
};

const handleProviderFilter = (provider: string | null) => {
  providerFilter.value = provider;
};

// Lifecycle
onMounted(() => {
  refreshData();
  
  // Set up periodic refresh
  const interval = setInterval(refreshHealthData, 30000); // 30 seconds
  
  // Cleanup on unmount
  return () => clearInterval(interval);
});
</script>

<style scoped>
.mcp-discovery-dashboard {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-card {
  margin-bottom: 16px;
}

.title-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.header-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .header-actions {
    flex-direction: column;
  }
}

.services-section {
  min-height: 400px;
}

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>