<template>
  <div class="dev-tools-panel" :class="{ 'panel-visible': isVisible, 'panel-minimized': isMinimized }">
    <!-- Panel Toggle Button -->
    <button 
      @click="togglePanel" 
      class="panel-toggle"
      :class="{ 'toggle-visible': isVisible }"
      :title="isVisible ? 'Hide Developer Panel' : 'Show Developer Panel'"
    >
      <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
      </svg>
      <span class="toggle-text">{{ isVisible ? 'Hide' : 'Dev Tools' }}</span>
    </button>

    <!-- Main Panel -->
    <div class="panel-container" v-if="isVisible">
      <!-- Panel Header -->
      <div class="panel-header">
        <div class="header-left">
          <h2 class="panel-title">
            <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Developer Tools
          </h2>
          
          <!-- Status Indicators -->
          <div class="status-indicators">
            <div class="status-indicator" :class="getConnectionStatus()">
              <div class="status-dot"></div>
              <span class="status-text">{{ getConnectionText() }}</span>
            </div>
            
            <div class="status-indicator" :class="getMemoryStatus()">
              <div class="status-dot"></div>
              <span class="status-text">Memory: {{ getMemoryText() }}</span>
            </div>
          </div>
        </div>
        
        <div class="header-controls">
          <button @click="toggleMinimize" class="control-button" :title="isMinimized ? 'Expand Panel' : 'Minimize Panel'">
            <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9" v-if="isMinimized"/>
              <polyline points="18,15 12,9 6,15" v-else/>
            </svg>
          </button>
          
          <button @click="refreshData" :disabled="refreshing" class="control-button" title="Refresh All Data">
            <svg class="control-icon" :class="{ 'animate-spin': refreshing }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0120.49 9z"/>
            </svg>
          </button>
          
          <button @click="togglePanel" class="control-button" title="Close Panel">
            <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Panel Content -->
      <div class="panel-content" v-if="!isMinimized">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="setActiveTab(tab.id)"
            class="tab-button"
            :class="{ active: activeTab === tab.id }"
          >
            <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path :d="tab.icon"/>
            </svg>
            <span class="tab-label">{{ tab.label }}</span>
            <div class="tab-badge" v-if="tab.badge">{{ tab.badge }}</div>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Run Metadata Tab -->
          <div class="tab-pane" :class="{ active: activeTab === 'metadata' }">
            <div class="tab-pane-header">
              <h3>Request Metadata</h3>
              <div class="metadata-controls">
                <button @click="clearMetadata" class="clear-button" :disabled="!hasMetadata">
                  <svg class="clear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                  Clear
                </button>
                
                <div class="auto-capture-toggle">
                  <input 
                    type="checkbox" 
                    id="auto-capture" 
                    v-model="autoCapture"
                    @change="toggleAutoCapture"
                  />
                  <label for="auto-capture">Auto-capture</label>
                </div>
              </div>
            </div>
            
            <div class="metadata-content">
              <RunMetadataPanel :metadata="currentMetadata" />
              
              <div class="metadata-history" v-if="metadataHistory.length > 0">
                <h4>Recent Requests</h4>
                <div class="history-list">
                  <div 
                    v-for="metadata in metadataHistory.slice(0, 5)" 
                    :key="metadata.runId"
                    class="history-item"
                    :class="{ active: metadata.runId === currentMetadata?.runId }"
                    @click="selectMetadata(metadata)"
                  >
                    <div class="history-info">
                      <span class="history-id">{{ formatRunId(metadata.runId) }}</span>
                      <span class="history-provider">{{ metadata.provider }}</span>
                    </div>
                    <div class="history-metrics">
                      <span class="history-duration">{{ formatDuration(metadata.duration) }}</span>
                      <span class="history-cost">${{ formatCost(metadata.cost) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Local Models Tab -->
          <div class="tab-pane" :class="{ active: activeTab === 'models' }">
            <LocalModelStatus ref="localModelStatus" />
          </div>

          <!-- Routing Visualization Tab -->
          <div class="tab-pane" :class="{ active: activeTab === 'routing' }">
            <RoutingVisualization ref="routingVisualization" />
          </div>

          <!-- System Health Tab -->
          <div class="tab-pane" :class="{ active: activeTab === 'health' }">
            <div class="health-dashboard">
              <div class="health-overview">
                <h3>System Health Overview</h3>
                <div class="health-cards">
                  <div class="health-card" :class="systemHealth.overall">
                    <div class="health-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                      </svg>
                    </div>
                    <div class="health-content">
                      <span class="health-value">{{ formatHealthStatus(systemHealth.overall) }}</span>
                      <span class="health-label">Overall Status</span>
                    </div>
                  </div>

                  <div class="health-card">
                    <div class="health-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                      </svg>
                    </div>
                    <div class="health-content">
                      <span class="health-value">{{ formatDuration(systemHealth.avgResponseTime) }}</span>
                      <span class="health-label">Avg Response Time</span>
                    </div>
                  </div>

                  <div class="health-card">
                    <div class="health-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
                      </svg>
                    </div>
                    <div class="health-content">
                      <span class="health-value">{{ systemHealth.modelsHealthy }}/{{ systemHealth.modelsTotal }}</span>
                      <span class="health-label">Healthy Models</span>
                    </div>
                  </div>

                  <div class="health-card">
                    <div class="health-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                      </svg>
                    </div>
                    <div class="health-content">
                      <span class="health-value">${{ formatCost(systemHealth.totalCost) }}</span>
                      <span class="health-label">Total Cost</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Active Alerts -->
              <div class="alerts-section" v-if="activeAlerts.length > 0">
                <h4>Active Alerts ({{ activeAlerts.length }})</h4>
                <div class="alerts-list">
                  <div 
                    v-for="alert in activeAlerts.slice(0, 3)" 
                    :key="alert.id"
                    class="alert-item"
                    :class="`alert-${alert.severity}`"
                  >
                    <div class="alert-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div class="alert-content">
                      <div class="alert-message">{{ alert.message }}</div>
                      <div class="alert-time">{{ formatAlertTime(alert.timestamp) }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Quick Actions -->
              <div class="quick-actions">
                <h4>Quick Actions</h4>
                <div class="actions-grid">
                  <button @click="performHealthCheck" :disabled="performingAction" class="action-button">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                    </svg>
                    Health Check
                  </button>
                  
                  <button @click="optimizeMemory" :disabled="performingAction" class="action-button">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    </svg>
                    Optimize Memory
                  </button>
                  
                  <button @click="emergencyRestart" :disabled="performingAction" class="action-button emergency">
                    <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="23 4 23 10 17 10"/>
                      <polyline points="1 20 1 14 7 14"/>
                      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0120.49 9z"/>
                    </svg>
                    Emergency Restart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Mini Panel (when minimized) -->
    <div class="mini-panel" v-if="isVisible && isMinimized">
      <div class="mini-content">
        <div class="mini-status">
          <div class="mini-indicator" :class="getConnectionStatus()"></div>
          <span class="mini-text">{{ getMiniStatusText() }}</span>
        </div>
        <button @click="toggleMinimize" class="mini-expand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import RunMetadataPanel from './RunMetadataPanel.vue'
import LocalModelStatus from './LocalModelStatus.vue'
import RoutingVisualization from './RoutingVisualization.vue'

interface RunMetadata {
  runId: string
  provider: string
  model: string
  tier: string
  duration: number
  cost: number
  timestamp: string
  inputTokens?: number
  outputTokens?: number
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical'
  avgResponseTime: number
  modelsTotal: number
  modelsHealthy: number
  totalCost: number
}

interface Alert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
}

interface Tab {
  id: string
  label: string
  icon: string
  badge?: string
}

export default defineComponent({
  name: 'DevToolsPanel',
  components: {
    RunMetadataPanel,
    LocalModelStatus,
    RoutingVisualization
  },
  data() {
    return {
      isVisible: false,
      isMinimized: false,
      activeTab: 'metadata',
      refreshing: false,
      performingAction: false,
      autoCapture: true,
      currentMetadata: null as RunMetadata | null,
      metadataHistory: [] as RunMetadata[],
      systemHealth: {
        overall: 'healthy',
        avgResponseTime: 0,
        modelsTotal: 0,
        modelsHealthy: 0,
        totalCost: 0
      } as SystemHealth,
      activeAlerts: [] as Alert[],
      connectionStatus: 'connected',
      memoryPressure: 'low',
      tabs: [
        {
          id: 'metadata',
          label: 'Metadata',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        {
          id: 'models',
          label: 'Models',
          icon: 'M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z'
        },
        {
          id: 'routing',
          label: 'Routing',
          icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z'
        },
        {
          id: 'health',
          label: 'Health',
          icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
        }
      ] as Tab[]
    }
  },
  computed: {
    hasMetadata(): boolean {
      return !!this.currentMetadata
    }
  },
  async created() {
    // Load saved state
    this.loadPanelState()
    
    // Initialize data
    await this.refreshData()
    
    // Set up event listeners for metadata capture
    if (this.autoCapture) {
      this.setupMetadataCapture()
    }
  },
  beforeUnmount() {
    this.savePanelState()
  },
  methods: {
    togglePanel() {
      this.isVisible = !this.isVisible
      if (this.isVisible && this.isMinimized) {
        this.isMinimized = false
      }
      this.savePanelState()
    },

    toggleMinimize() {
      this.isMinimized = !this.isMinimized
      this.savePanelState()
    },

    setActiveTab(tabId: string) {
      this.activeTab = tabId
      this.savePanelState()
    },

    async refreshData() {
      this.refreshing = true
      try {
        // Fetch system health data
        const response = await fetch('/api/llm/production/operations/status')
        const data = await response.json()
        
        this.systemHealth = {
          overall: data.system.healthy ? 'healthy' : (data.memory.pressure === 'critical' ? 'critical' : 'warning'),
          avgResponseTime: data.system.averageResponseTime,
          modelsTotal: data.system.modelsTotal,
          modelsHealthy: data.system.modelsHealthy,
          totalCost: data.memory.currentUsageGB * 0.001 // Rough estimate
        }
        
        this.activeAlerts = data.activeAlerts || []
        this.connectionStatus = data.system.ollamaConnected ? 'connected' : 'disconnected'
        this.memoryPressure = data.memory.pressure
        
        // Update tab badges
        this.updateTabBadges()
        
        // Refresh child components
        if (this.$refs.localModelStatus) {
          await (this.$refs.localModelStatus as { fetchModelStatus: () => Promise<void> }).fetchModelStatus()
        }
      } catch (error) {
        console.error('Failed to refresh dev tools data:', error)
        this.connectionStatus = 'disconnected'
      } finally {
        this.refreshing = false
      }
    },

    updateTabBadges() {
      // Update health tab badge with alert count
      const healthTab = this.tabs.find(t => t.id === 'health')
      if (healthTab) {
        healthTab.badge = this.activeAlerts.length > 0 ? this.activeAlerts.length.toString() : undefined
      }
      
      // Update metadata tab badge with history count
      const metadataTab = this.tabs.find(t => t.id === 'metadata')
      if (metadataTab) {
        metadataTab.badge = this.metadataHistory.length > 0 ? this.metadataHistory.length.toString() : undefined
      }
    },

    setupMetadataCapture() {
      // This would integrate with your LLM service to capture metadata
      // For now, we'll simulate with a periodic check
      setInterval(() => {
        this.checkForNewMetadata()
      }, 5000)
    },

    async checkForNewMetadata() {
      // This would check for new LLM requests and capture their metadata
      // Implementation would depend on your specific LLM service integration
    },

    captureMetadata(metadata: RunMetadata) {
      this.currentMetadata = metadata
      this.metadataHistory.unshift(metadata)
      
      // Keep only last 20 items
      if (this.metadataHistory.length > 20) {
        this.metadataHistory = this.metadataHistory.slice(0, 20)
      }
      
      this.updateTabBadges()
    },

    selectMetadata(metadata: RunMetadata) {
      this.currentMetadata = metadata
    },

    clearMetadata() {
      this.currentMetadata = null
      this.metadataHistory = []
      this.updateTabBadges()
    },

    toggleAutoCapture() {
      if (this.autoCapture) {
        this.setupMetadataCapture()
      }
    },

    async performHealthCheck() {
      this.performingAction = true
      try {
        await fetch('/api/llm/production/monitoring/health-check', {
          method: 'POST'
        })
        await this.refreshData()
      } catch (error) {
        console.error('Health check failed:', error)
      } finally {
        this.performingAction = false
      }
    },

    async optimizeMemory() {
      this.performingAction = true
      try {
        await fetch('/api/llm/production/memory/optimize', {
          method: 'POST'
        })
        await this.refreshData()
      } catch (error) {
        console.error('Memory optimization failed:', error)
      } finally {
        this.performingAction = false
      }
    },

    async emergencyRestart() {
      if (!confirm('This will restart all local models. Continue?')) {
        return
      }
      
      this.performingAction = true
      try {
        await fetch('/api/llm/production/operations/emergency-restart', {
          method: 'POST'
        })
        await this.refreshData()
      } catch (error) {
        console.error('Emergency restart failed:', error)
      } finally {
        this.performingAction = false
      }
    },

    // State management
    loadPanelState() {
      try {
        const saved = localStorage.getItem('dev-tools-panel-state')
        if (saved) {
          const state = JSON.parse(saved)
          this.isVisible = state.isVisible || false
          this.isMinimized = state.isMinimized || false
          this.activeTab = state.activeTab || 'metadata'
          this.autoCapture = state.autoCapture !== undefined ? state.autoCapture : true
        }
      } catch (error) {
        console.error('Failed to load panel state:', error)
      }
    },

    savePanelState() {
      try {
        const state = {
          isVisible: this.isVisible,
          isMinimized: this.isMinimized,
          activeTab: this.activeTab,
          autoCapture: this.autoCapture
        }
        localStorage.setItem('dev-tools-panel-state', JSON.stringify(state))
      } catch (error) {
        console.error('Failed to save panel state:', error)
      }
    },

    // Status methods
    getConnectionStatus(): string {
      return this.connectionStatus
    },

    getConnectionText(): string {
      return this.connectionStatus === 'connected' ? 'Connected' : 'Disconnected'
    },

    getMemoryStatus(): string {
      return `memory-${this.memoryPressure}`
    },

    getMemoryText(): string {
      return this.memoryPressure.charAt(0).toUpperCase() + this.memoryPressure.slice(1)
    },

    getMiniStatusText(): string {
      if (this.connectionStatus !== 'connected') return 'Disconnected'
      if (this.activeAlerts.length > 0) return `${this.activeAlerts.length} alerts`
      return 'All systems normal'
    },

    // Formatting methods
    formatRunId(runId: string): string {
      return runId.length > 8 ? `${runId.substring(0, 8)}...` : runId
    },

    formatDuration(duration: number): string {
      if (duration < 1000) return `${duration}ms`
      return `${(duration / 1000).toFixed(2)}s`
    },

    formatCost(cost: number): string {
      return cost.toFixed(6)
    },

    formatHealthStatus(status: string): string {
      return status.charAt(0).toUpperCase() + status.slice(1)
    },

    formatAlertTime(timestamp: string): string {
      return new Date(timestamp).toLocaleTimeString()
    }
  }
})
</script>

<style scoped>
.dev-tools-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  font-family: system-ui, -apple-system, sans-serif;
}

/* Panel Toggle Button */
.panel-toggle {
  position: absolute;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
}

.panel-toggle:hover {
  background: var(--primary-hover, #2563eb);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.panel-toggle.toggle-visible {
  background: var(--danger-color, #ef4444);
}

.panel-toggle.toggle-visible:hover {
  background: var(--danger-hover, #dc2626);
}

.toggle-icon {
  width: 16px;
  height: 16px;
}

.toggle-text {
  font-size: 14px;
}

/* Main Panel */
.panel-container {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 800px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--panel-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Panel Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--header-bg, #f8f9fa);
  border-bottom: 1px solid var(--border-color, #e1e5e9);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.title-icon {
  width: 18px;
  height: 18px;
  color: var(--primary-color, #3b82f6);
}

.status-indicators {
  display: flex;
  gap: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.connected .status-dot { background: #10b981; }
.status-indicator.disconnected .status-dot { background: #ef4444; }
.status-indicator.memory-low .status-dot { background: #10b981; }
.status-indicator.memory-medium .status-dot { background: #f59e0b; }
.status-indicator.memory-high .status-dot { background: #ef4444; }
.status-indicator.memory-critical .status-dot { background: #dc2626; }

.status-text {
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.header-controls {
  display: flex;
  gap: 8px;
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem; /* 44px minimum touch target */
  height: 2.75rem;
  background: transparent;
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary, #666666);
  transition: all 0.2s ease;
}

.control-button:hover:not(:disabled) {
  background: var(--hover-bg, #f5f5f5);
  color: var(--text-primary, #1a1a1a);
}

.control-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.control-icon {
  width: 16px;
  height: 16px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Panel Content */
.panel-content {
  height: 600px;
  display: flex;
  flex-direction: column;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  background: var(--tab-bg, #ffffff);
  border-bottom: 1px solid var(--border-color, #e1e5e9);
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem; /* Better touch target padding */
  min-height: 2.75rem; /* 44px minimum touch target */
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #666666);
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--text-primary, #1a1a1a);
  background: var(--hover-bg, #f5f5f5);
}

.tab-button.active {
  color: var(--primary-color, #3b82f6);
  border-bottom-color: var(--primary-color, #3b82f6);
}

.tab-icon {
  width: 14px;
  height: 14px;
}

.tab-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--primary-color, #3b82f6);
  color: white;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

/* Tab Content */
.tab-content {
  flex: 1;
  overflow: hidden;
}

.tab-pane {
  height: 100%;
  overflow-y: auto;
  display: none;
  padding: 20px;
}

.tab-pane.active {
  display: block;
}

.tab-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.tab-pane-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.metadata-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.clear-button {
  padding: 4px 8px;
  background: var(--danger-color, #ef4444);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.clear-button:hover:not(:disabled) {
  background: var(--danger-hover, #dc2626);
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auto-capture-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.auto-capture-toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
}

/* Metadata History */
.metadata-history {
  margin-top: 24px;
}

.metadata-history h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--history-bg, #f8f9fa);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: var(--hover-bg, #f5f5f5);
}

.history-item.active {
  border-color: var(--primary-color, #3b82f6);
  background: var(--primary-bg, #eff6ff);
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-id {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.history-provider {
  font-size: 11px;
  color: var(--text-secondary, #666666);
  text-transform: uppercase;
}

.history-metrics {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}

.history-duration, .history-cost {
  font-size: 11px;
  font-weight: 600;
}

.history-duration {
  color: var(--success-color, #10b981);
}

.history-cost {
  color: var(--warning-color, #f59e0b);
}

/* Health Dashboard */
.health-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.health-overview h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.health-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.health-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 8px;
}

.health-card.healthy {
  border-left: 4px solid #10b981;
}

.health-card.warning {
  border-left: 4px solid #f59e0b;
}

.health-card.critical {
  border-left: 4px solid #ef4444;
}

.health-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--icon-bg, #f3f4f6);
  color: var(--icon-color, #6b7280);
  flex-shrink: 0;
}

.health-icon svg {
  width: 16px;
  height: 16px;
}

.health-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.health-label {
  font-size: 12px;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

/* Alerts Section */
.alerts-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  border-left: 4px solid;
}

.alert-item.alert-critical {
  background: #fef2f2;
  border-left-color: #dc2626;
}

.alert-item.alert-high {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.alert-item.alert-medium {
  background: #fffbeb;
  border-left-color: #f59e0b;
}

.alert-item.alert-low {
  background: #f0f9ff;
  border-left-color: #0ea5e9;
}

.alert-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-content {
  flex: 1;
}

.alert-message {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 2px;
}

.alert-time {
  font-size: 11px;
  color: var(--text-secondary, #666666);
}

/* Quick Actions */
.quick-actions h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem; /* Better touch target padding */
  min-height: 2.75rem; /* 44px minimum touch target */
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-button:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
}

.action-button.emergency {
  background: var(--danger-color, #ef4444);
}

.action-button.emergency:hover:not(:disabled) {
  background: var(--danger-hover, #dc2626);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  width: 14px;
  height: 14px;
}

/* Mini Panel */
.mini-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  background: var(--panel-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s ease-out;
}

.mini-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.mini-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.mini-indicator.connected { background: #10b981; }
.mini-indicator.disconnected { background: #ef4444; }
.mini-indicator.memory-low { background: #10b981; }
.mini-indicator.memory-medium { background: #f59e0b; }
.mini-indicator.memory-high { background: #ef4444; }
.mini-indicator.memory-critical { background: #dc2626; }

.mini-text {
  font-size: 12px;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.mini-expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem; /* 44px minimum touch target */
  height: 2.75rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #666666);
  transition: color 0.2s ease;
}

.mini-expand:hover {
  color: var(--text-primary, #1a1a1a);
}

.mini-expand svg {
  width: 14px;
  height: 14px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .dev-tools-panel {
    --panel-bg: #1f2937;
    --header-bg: #374151;
    --tab-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --hover-bg: #374151;
    --card-bg: #1f2937;
    --history-bg: #374151;
    --primary-bg: #1e3a8a;
    --icon-bg: #4b5563;
    --icon-color: #9ca3af;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .dev-tools-panel {
    bottom: 10px;
    right: 10px;
    left: 10px;
  }
  
  .panel-container {
    width: auto;
    max-width: none;
    left: 0;
    right: 0;
  }
  
  .panel-header {
    padding: 12px 16px;
  }
  
  .header-left {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .tab-pane {
    padding: 16px;
  }
  
  .health-cards {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
