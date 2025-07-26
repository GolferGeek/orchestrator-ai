<template>
  <div class="mcp-details" v-if="mcp">
    <!-- MCP Header -->
    <div class="mcp-header">
      <div class="header-info">
        <h2 class="mcp-name">{{ mcp.name }}</h2>
        <p class="mcp-description">{{ mcp.description }}</p>
      </div>
      <div class="header-badges">
        <ion-badge :color="getStatusColor(mcp.status)" class="status-badge">
          {{ mcp.status }}
        </ion-badge>
        <ion-badge :color="getTypeColor(mcp.type)" fill="outline" class="type-badge">
          {{ mcp.type }}
        </ion-badge>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="quick-stats">
      <div class="stat-item">
        <ion-icon :icon="buildOutline" class="stat-icon"></ion-icon>
        <div class="stat-content">
          <div class="stat-value">{{ mcp.tools.length }}</div>
          <div class="stat-label">Tools</div>
        </div>
      </div>
      <div class="stat-item">
        <ion-icon :icon="extensionPuzzleOutline" class="stat-icon"></ion-icon>
        <div class="stat-content">
          <div class="stat-value">{{ mcp.capabilities.length }}</div>
          <div class="stat-label">Capabilities</div>
        </div>
      </div>
      <div class="stat-item" v-if="mcp.metrics">
        <ion-icon :icon="flashOutline" class="stat-icon"></ion-icon>
        <div class="stat-content">
          <div class="stat-value">{{ mcp.metrics.totalExecutions || 0 }}</div>
          <div class="stat-label">Executions</div>
        </div>
      </div>
      <div class="stat-item" v-if="mcp.metrics">
        <ion-icon :icon="timerOutline" class="stat-icon"></ion-icon>
        <div class="stat-content">
          <div class="stat-value">{{ formatExecutionTime(mcp.metrics.averageExecutionTime) }}</div>
          <div class="stat-label">Avg Time</div>
        </div>
      </div>
    </div>

    <!-- MCP Information -->
    <div class="info-section">
      <h3 class="section-title">
        <ion-icon :icon="informationCircleOutline" class="section-icon"></ion-icon>
        Service Information
      </h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Provider:</span>
          <span class="info-value">{{ mcp.provider }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Version:</span>
          <span class="info-value">{{ mcp.version }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">URL:</span>
          <span class="info-value url-value">{{ mcp.url }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Discovered:</span>
          <span class="info-value">{{ formatDate(mcp.discoveredAt) }}</span>
        </div>
        <div class="info-item" v-if="mcp.lastHeartbeat">
          <span class="info-label">Last Heartbeat:</span>
          <span class="info-value">{{ formatDate(mcp.lastHeartbeat) }}</span>
        </div>
        <div class="info-item" v-if="mcp.registeredAt">
          <span class="info-label">Registered:</span>
          <span class="info-value">{{ formatDate(mcp.registeredAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Capabilities -->
    <div class="capabilities-section" v-if="mcp.capabilities.length > 0">
      <h3 class="section-title">
        <ion-icon :icon="extensionPuzzleOutline" class="section-icon"></ion-icon>
        Capabilities
      </h3>
      <div class="capabilities-list">
        <div 
          v-for="capability in mcp.capabilities" 
          :key="capability.name"
          class="capability-item"
        >
          <div class="capability-header">
            <h4 class="capability-name">{{ capability.name }}</h4>
            <ion-badge :color="getCategoryColor(capability.category)" fill="outline" class="category-badge">
              {{ capability.category }}
            </ion-badge>
          </div>
          <p class="capability-description">{{ capability.description }}</p>
          <div class="capability-tools">
            <span class="tools-label">Tools:</span>
            <div class="tools-list">
              <ion-chip 
                v-for="toolName in capability.tools" 
                :key="toolName"
                color="primary"
                outline
                @click="executeToolByName(toolName)"
              >
                {{ toolName }}
              </ion-chip>
            </div>
          </div>
          <div class="capability-examples" v-if="capability.examples.length > 0">
            <span class="examples-label">Examples:</span>
            <ul class="examples-list">
              <li v-for="example in capability.examples" :key="example" class="example-item">
                {{ example }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Tools -->
    <div class="tools-section" v-if="mcp.tools.length > 0">
      <h3 class="section-title">
        <ion-icon :icon="buildOutline" class="section-icon"></ion-icon>
        Available Tools
      </h3>
      <div class="tools-list">
        <div 
          v-for="tool in mcp.tools" 
          :key="tool.name"
          class="tool-item"
          @click="$emit('execute-tool', mcp, tool)"
        >
          <div class="tool-header">
            <h4 class="tool-name">{{ tool.name }}</h4>
            <ion-button 
              fill="clear" 
              size="small"
              @click.stop="$emit('execute-tool', mcp, tool)"
            >
              <ion-icon :icon="playOutline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
          <p class="tool-description">{{ tool.description }}</p>
          <div class="tool-meta">
            <span class="param-count">
              {{ getParameterCount(tool.parameters) }} parameters
            </span>
            <span v-if="tool.examples.length > 0" class="example-count">
              {{ tool.examples.length }} examples
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics (if available) -->
    <div class="metrics-section" v-if="mcp.metrics">
      <h3 class="section-title">
        <ion-icon :icon="analyticsOutline" class="section-icon"></ion-icon>
        Performance Metrics
      </h3>
      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-value">{{ mcp.metrics.totalExecutions || 0 }}</div>
          <div class="metric-label">Total Executions</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ mcp.metrics.successfulExecutions || 0 }}</div>
          <div class="metric-label">Successful</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ mcp.metrics.failedExecutions || 0 }}</div>
          <div class="metric-label">Failed</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ formatSuccessRate(mcp.metrics) }}%</div>
          <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ formatExecutionTime(mcp.metrics.averageExecutionTime) }}</div>
          <div class="metric-label">Avg Time</div>
        </div>
        <div class="metric-item">
          <div class="metric-value">{{ (mcp.metrics.errorRate * 100).toFixed(1) }}%</div>
          <div class="metric-label">Error Rate</div>
        </div>
      </div>

      <!-- Tool Usage (if available) -->
      <div v-if="mcp.metrics.toolsUsed" class="tools-usage">
        <h4 class="usage-title">Tool Usage</h4>
        <div class="usage-chart">
          <div 
            v-for="(count, toolName) in mcp.metrics.toolsUsed" 
            :key="toolName"
            class="usage-item"
          >
            <span class="usage-tool">{{ toolName }}</span>
            <div class="usage-bar-container">
              <div 
                class="usage-bar" 
                :style="{ width: getUsagePercentage(count, mcp.metrics?.toolsUsed) + '%' }"
              ></div>
            </div>
            <span class="usage-count">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Metadata (if available) -->
    <div class="metadata-section" v-if="mcp.metadata && Object.keys(mcp.metadata).length > 0">
      <h3 class="section-title">
        <ion-icon :icon="codeOutline" class="section-icon"></ion-icon>
        Metadata
      </h3>
      <div class="metadata-content">
        <pre class="metadata-json">{{ JSON.stringify(mcp.metadata, null, 2) }}</pre>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions-section">
      <ion-button 
        @click="$emit('close')" 
        fill="outline"
        color="medium"
      >
        Close
      </ion-button>
    </div>
  </div>

  <!-- No MCP State -->
  <div v-else class="no-mcp">
    <ion-icon :icon="serverOutline" class="no-mcp-icon"></ion-icon>
    <h3>No MCP Selected</h3>
    <p>Please select an MCP service to view details.</p>
  </div>
</template>

<script setup lang="ts">
import {
  IonBadge,
  IonIcon,
  IonButton,
  IonChip
} from '@ionic/vue';
import {
  buildOutline,
  extensionPuzzleOutline,
  flashOutline,
  timerOutline,
  informationCircleOutline,
  playOutline,
  analyticsOutline,
  codeOutline,
  serverOutline
} from 'ionicons/icons';

import type { MCPRegistration, MCPTool, MCPMetrics } from '@/types/mcp';

// Props
interface Props {
  mcp?: MCPRegistration | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'execute-tool': [mcp: MCPRegistration, tool: MCPTool];
  'close': [];
}>();

// Methods
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online': return 'success';
    case 'offline': return 'danger';
    case 'discovering': return 'warning';
    default: return 'medium';
  }
};

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'database': return 'primary';
    case 'api': return 'secondary';
    case 'file': return 'tertiary';
    case 'communication': return 'success';
    case 'computation': return 'warning';
    case 'external': return 'medium';
    default: return 'dark';
  }
};

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'data': return 'primary';
    case 'api': return 'secondary';
    case 'file': return 'tertiary';
    case 'computation': return 'warning';
    case 'communication': return 'success';
    default: return 'medium';
  }
};

const formatDate = (date: Date): string => {
  return date.toLocaleString();
};

const formatExecutionTime = (avgTime?: number): string => {
  if (!avgTime) return 'N/A';
  if (avgTime < 1000) return `${Math.round(avgTime)}ms`;
  return `${(avgTime / 1000).toFixed(1)}s`;
};

const formatSuccessRate = (metrics: MCPMetrics): string => {
  if (!metrics.totalExecutions) return '100';
  const successRate = ((metrics.totalExecutions - (metrics.failedExecutions || 0)) / metrics.totalExecutions) * 100;
  return Math.round(successRate).toString();
};

const getParameterCount = (parameters: Record<string, any>): number => {
  if (!parameters || !parameters.properties) return 0;
  return Object.keys(parameters.properties).length;
};

const getUsagePercentage = (count: number, toolsUsed?: Record<string, number>): number => {
  if (!toolsUsed) return 0;
  const maxUsage = Math.max(...Object.values(toolsUsed));
  return maxUsage > 0 ? (count / maxUsage) * 100 : 0;
};

const executeToolByName = (toolName: string) => {
  if (!props.mcp) return;
  const tool = props.mcp.tools.find(t => t.name === toolName);
  if (tool) {
    emit('execute-tool', props.mcp, tool);
  }
};

</script>

<style scoped>
.mcp-details {
  padding: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.mcp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.header-info {
  flex: 1;
}

.mcp-name {
  margin: 0 0 8px 0;
  font-size: 1.3em;
  color: var(--ion-color-dark);
}

.mcp-description {
  margin: 0;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.header-badges {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.status-badge,
.type-badge {
  text-transform: capitalize;
}

.quick-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.stat-icon {
  font-size: 24px;
  color: var(--ion-color-primary);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.2em;
  font-weight: bold;
  color: var(--ion-color-dark);
}

.stat-label {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 1.1em;
  color: var(--ion-color-dark);
}

.section-icon {
  font-size: 20px;
  color: var(--ion-color-medium);
}

.info-section,
.capabilities-section,
.tools-section,
.metrics-section,
.metadata-section {
  margin-bottom: 24px;
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--ion-color-light);
  border-radius: 6px;
  font-size: 0.9em;
}

.info-label {
  color: var(--ion-color-medium);
  font-weight: 500;
}

.info-value {
  color: var(--ion-color-dark);
  text-align: right;
  max-width: 60%;
}

.url-value {
  word-break: break-all;
  font-family: monospace;
  font-size: 0.8em;
}

.capabilities-list,
.tools-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.capability-item,
.tool-item {
  border: 1px solid var(--ion-color-light-shade);
  border-radius: 8px;
  padding: 16px;
  background: var(--ion-color-light);
}

.tool-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-item:hover {
  border-color: var(--ion-color-primary);
  transform: translateY(-1px);
}

.capability-header,
.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.capability-name,
.tool-name {
  margin: 0;
  font-size: 1em;
  color: var(--ion-color-dark);
}

.category-badge {
  font-size: 0.75em;
  text-transform: capitalize;
}

.capability-description,
.tool-description {
  margin: 0 0 12px 0;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.capability-tools {
  margin-bottom: 12px;
}

.tools-label,
.examples-label {
  font-size: 0.85em;
  color: var(--ion-color-medium);
  font-weight: 500;
  display: block;
  margin-bottom: 6px;
}

.tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.examples-list {
  margin: 0;
  padding-left: 16px;
}

.example-item {
  font-size: 0.85em;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.tool-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.metric-item {
  text-align: center;
  padding: 12px;
  background: var(--ion-color-light);
  border-radius: 8px;
}

.metric-value {
  font-size: 1.4em;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 4px;
}

.metric-label {
  font-size: 0.8em;
  color: var(--ion-color-medium);
}

.tools-usage {
  border-top: 1px solid var(--ion-color-light-shade);
  padding-top: 16px;
}

.usage-title {
  margin: 0 0 12px 0;
  font-size: 1em;
  color: var(--ion-color-dark);
}

.usage-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.usage-item {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 12px;
  align-items: center;
  font-size: 0.85em;
}

.usage-tool {
  color: var(--ion-color-dark);
  font-weight: 500;
}

.usage-bar-container {
  background: var(--ion-color-light-shade);
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
}

.usage-bar {
  height: 100%;
  background: var(--ion-color-primary);
  transition: width 0.3s ease;
}

.usage-count {
  color: var(--ion-color-medium);
  text-align: right;
  min-width: 30px;
}

.metadata-content {
  background: var(--ion-color-light);
  border-radius: 6px;
  padding: 12px;
}

.metadata-json {
  margin: 0;
  font-family: monospace;
  font-size: 0.8em;
  color: var(--ion-color-dark);
  white-space: pre-wrap;
  word-break: break-word;
}

.actions-section {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ion-color-light-shade);
}

.no-mcp {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--ion-color-medium);
}

.no-mcp-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.no-mcp h3 {
  margin: 16px 0 8px 0;
  color: var(--ion-color-dark);
}

@media (max-width: 768px) {
  .mcp-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .header-badges {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .quick-stats {
    grid-template-columns: 1fr 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .usage-item {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>