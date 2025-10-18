<template>
  <div class="local-model-status">
    <div class="status-header">
      <h2 class="status-title">
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
        </svg>
        Local Model Status
      </h2>
      
      <div class="status-controls">
        <button @click="refreshStatus" :disabled="loading" class="refresh-button">
          <svg class="refresh-icon" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0120.49 9z"/>
          </svg>
          <span>Refresh</span>
        </button>
        
        <div class="auto-refresh-toggle">
          <input 
            type="checkbox" 
            id="auto-refresh" 
            v-model="autoRefresh"
            @change="toggleAutoRefresh"
          />
          <label for="auto-refresh">Auto-refresh</label>
        </div>
      </div>
    </div>

    <!-- System Overview -->
    <div class="system-overview">
      <div class="overview-card">
        <div class="overview-header">
          <h3>System Health</h3>
          <div class="health-indicator" :class="getHealthClass(systemHealth.healthy)">
            <div class="health-dot"></div>
            <span>{{ systemHealth.healthy ? 'Healthy' : 'Issues Detected' }}</span>
          </div>
        </div>
        
        <div class="overview-stats">
          <div class="stat-item">
            <span class="stat-label">Models</span>
            <span class="stat-value">{{ systemHealth.modelsHealthy }}/{{ systemHealth.modelsTotal }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Avg Response</span>
            <span class="stat-value">{{ formatResponseTime(systemHealth.averageResponseTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Memory</span>
            <span class="stat-value" :class="getMemoryPressureClass(memoryStats.memoryPressure)">
              {{ memoryStats.usagePercent }}%
            </span>
          </div>
        </div>
      </div>

      <div class="overview-card">
        <div class="overview-header">
          <h3>Ollama Connection</h3>
          <div class="connection-status" :class="ollamaConnected ? 'connected' : 'disconnected'">
            <div class="connection-dot"></div>
            <span>{{ ollamaConnected ? 'Connected' : 'Disconnected' }}</span>
          </div>
        </div>
        
        <div class="connection-details" v-if="ollamaConnected">
          <div class="detail-item">
            <span class="detail-label">Loaded Models</span>
            <span class="detail-value">{{ memoryStats.loadedModels }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Three-Tier Models</span>
            <span class="detail-value">{{ memoryStats.threeTierModels }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Memory Management -->
    <div class="memory-management" v-if="memoryStats">
      <div class="section-header">
        <h3>Memory Management</h3>
        <div class="memory-actions">
          <button @click="optimizeMemory" :disabled="optimizing" class="action-button optimize">
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
            {{ optimizing ? 'Optimizing...' : 'Optimize Memory' }}
          </button>
          
          <button @click="preloadThreeTier" :disabled="preloading" class="action-button preload">
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            {{ preloading ? 'Loading...' : 'Preload Three-Tier' }}
          </button>
        </div>
      </div>
      
      <div class="memory-progress">
        <div class="progress-header">
          <span class="progress-label">Memory Usage</span>
          <span class="progress-value">
            {{ memoryStats.currentUsageGB.toFixed(1) }}GB / {{ memoryStats.totalAllocatedGB.toFixed(1) }}GB
          </span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :class="getMemoryPressureClass(memoryStats.memoryPressure)"
            :style="{ width: Math.min(memoryStats.usagePercent, 100) + '%' }"
          ></div>
        </div>
        <div class="pressure-indicator">
          <span class="pressure-label">Pressure:</span>
          <span class="pressure-value" :class="getMemoryPressureClass(memoryStats.memoryPressure)">
            {{ formatMemoryPressure(memoryStats.memoryPressure) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Model Tiers -->
    <div class="model-tiers">
      <div class="tier-container" v-for="tier in modelTiers" :key="tier.name">
        <div class="tier-header">
          <h3 class="tier-title">
            <svg class="tier-icon" :class="`tier-${tier.name}`" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
            </svg>
            {{ formatTierName(tier.name) }}
            <span class="tier-count">({{ tier.models.length }})</span>
          </h3>
          
          <div class="tier-stats">
            <span class="healthy-count">{{ tier.healthyCount }}/{{ tier.models.length }} healthy</span>
          </div>
        </div>
        
        <div class="models-grid">
          <div 
            v-for="model in tier.models" 
            :key="model.name"
            class="model-card"
            :class="getModelStatusClass(model)"
          >
            <div class="model-header">
              <div class="model-name" :title="model.name">{{ model.name }}</div>
              <div class="model-status-indicator">
                <div class="status-dot" :class="getStatusClass(model.status)"></div>
                <span class="status-text">{{ formatStatus(model.status) }}</span>
              </div>
            </div>
            
            <div class="model-metrics" v-if="model.status === 'loaded'">
              <div class="metric-item">
                <svg class="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span class="metric-label">Response:</span>
                <span class="metric-value" :class="getResponseTimeClass(model.responseTime)">
                  {{ formatResponseTime(model.responseTime) }}
                </span>
              </div>
              
              <div class="metric-item" v-if="model.size">
                <svg class="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
                <span class="metric-label">Size:</span>
                <span class="metric-value">{{ model.size }}</span>
              </div>
              
              <div class="metric-item" v-if="model.useCount !== undefined">
                <svg class="metric-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"/>
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                  <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                  <path d="M3 12h6m6 0h6"/>
                </svg>
                <span class="metric-label">Uses:</span>
                <span class="metric-value">{{ model.useCount }}</span>
              </div>
            </div>
            
            <div class="model-error" v-if="model.status === 'error' && model.errorMessage">
              <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span class="error-text">{{ model.errorMessage }}</span>
            </div>
            
            <div class="model-actions" v-if="model.status === 'loaded'">
              <button @click="unloadModel(model.name)" class="model-action unload" :disabled="loading">
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                Unload
              </button>
            </div>
            
            <div class="model-actions" v-if="model.status !== 'loaded'">
              <button @click="loadModel(model.name)" class="model-action load" :disabled="loading">
                <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Load
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Alerts -->
    <div class="active-alerts" v-if="activeAlerts.length > 0">
      <div class="section-header">
        <h3>Active Alerts</h3>
        <span class="alert-count">{{ activeAlerts.length }}</span>
      </div>
      
      <div class="alerts-list">
        <div 
          v-for="alert in activeAlerts" 
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
            <div class="alert-details">
              <span class="alert-type">{{ alert.type }}</span>
              <span class="alert-time">{{ formatAlertTime(alert.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="last-update">
      <svg class="update-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
      Last Updated: {{ lastChecked }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

interface ModelStatus {
  name: string
  status: 'loaded' | 'loading' | 'error' | 'unavailable'
  responseTime?: number
  size?: string
  useCount?: number
  errorMessage?: string
  isThreeTier?: boolean
}

interface ModelTier {
  name: string
  models: ModelStatus[]
  healthyCount: number
}

interface MemoryStats {
  totalAllocated: number
  currentUsage: number
  currentUsageGB: number
  totalAllocatedGB: number
  loadedModels: number
  threeTierModels: number
  memoryPressure: 'low' | 'medium' | 'high' | 'critical'
  usagePercent: number
}

interface SystemHealth {
  healthy: boolean
  modelsTotal: number
  modelsHealthy: number
  modelsUnhealthy: number
  averageResponseTime: number
}

interface Alert {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
}

export default defineComponent({
  name: 'LocalModelStatus',
  data() {
    return {
      modelTiers: [] as ModelTier[],
      memoryStats: null as MemoryStats | null,
      systemHealth: {
        healthy: false,
        modelsTotal: 0,
        modelsHealthy: 0,
        modelsUnhealthy: 0,
        averageResponseTime: 0
      } as SystemHealth,
      activeAlerts: [] as Alert[],
      ollamaConnected: false,
      lastChecked: '',
      loading: false,
      optimizing: false,
      preloading: false,
      autoRefresh: true,
      pollingInterval: null as NodeJS.Timeout | null
    }
  },
  async created() {
    await this.fetchModelStatus()
    this.setupAutoRefresh()
  },
  beforeUnmount() {
    this.clearAutoRefresh()
  },
  methods: {
    async fetchModelStatus() {
      this.loading = true
      try {
        const response = await fetch('/api/llm/production/operations/status')
        const data = await response.json()
        
        this.processStatusData(data)
        this.lastChecked = new Date().toLocaleString()
      } catch (error) {
        console.error('Failed to fetch model status:', error)
        this.ollamaConnected = false
      } finally {
        this.loading = false
      }
    },
    
    processStatusData(data: { system: { ollamaConnected: boolean }; memory: { currentUsageGB: number; totalAllocatedGB: number }; activeAlerts: unknown[]; loadedModels: Array<{ tier?: string; [key: string]: unknown }> }) {
      this.ollamaConnected = data.system.ollamaConnected
      this.systemHealth = data.system
      this.memoryStats = {
        ...data.memory,
        currentUsageGB: data.memory.currentUsageGB,
        totalAllocatedGB: data.memory.totalAllocatedGB
      }
      this.activeAlerts = data.activeAlerts || []
      
      // Group models by tier
      const tierMap = new Map<string, ModelStatus[]>()
      
      data.loadedModels?.forEach((model: { tier?: string; [key: string]: unknown }) => {
        const tierName = model.tier || 'general'
        if (!tierMap.has(tierName)) {
          tierMap.set(tierName, [])
        }
        
        tierMap.get(tierName)!.push({
          name: model.name,
          status: 'loaded',
          responseTime: model.responseTime,
          size: model.size,
          useCount: model.useCount,
          isThreeTier: model.isThreeTier
        })
      })
      
      // Convert to tier objects
      this.modelTiers = Array.from(tierMap.entries()).map(([name, models]) => ({
        name,
        models,
        healthyCount: models.filter(m => m.status === 'loaded').length
      }))
    },
    
    async refreshStatus() {
      await this.fetchModelStatus()
    },
    
    setupAutoRefresh() {
      if (this.autoRefresh) {
        this.pollingInterval = setInterval(() => {
          this.fetchModelStatus()
        }, 10000) // 10 seconds
      }
    },
    
    clearAutoRefresh() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval)
        this.pollingInterval = null
      }
    },
    
    toggleAutoRefresh() {
      this.clearAutoRefresh()
      if (this.autoRefresh) {
        this.setupAutoRefresh()
      }
    },
    
    async optimizeMemory() {
      this.optimizing = true
      try {
        const response = await fetch('/api/llm/production/memory/optimize', {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          await this.fetchModelStatus() // Refresh to show changes
        }
      } catch (error) {
        console.error('Failed to optimize memory:', error)
      } finally {
        this.optimizing = false
      }
    },
    
    async preloadThreeTier() {
      this.preloading = true
      try {
        const response = await fetch('/api/llm/production/memory/preload-three-tier', {
          method: 'POST'
        })
        const result = await response.json()
        
        if (result.success) {
          await this.fetchModelStatus() // Refresh to show changes
        }
      } catch (error) {
        console.error('Failed to preload three-tier models:', error)
      } finally {
        this.preloading = false
      }
    },
    
    async loadModel(modelName: string) {
      this.loading = true
      try {
        const response = await fetch(`/api/llm/production/memory/load/${modelName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ priority: 'medium' })
        })
        const result = await response.json()
        
        if (result.success) {
          await this.fetchModelStatus() // Refresh to show changes
        }
      } catch (error) {
        console.error(`Failed to load model ${modelName}:`, error)
      } finally {
        this.loading = false
      }
    },
    
    async unloadModel(modelName: string) {
      this.loading = true
      try {
        const response = await fetch(`/api/llm/production/memory/unload/${modelName}`, {
          method: 'DELETE'
        })
        const result = await response.json()
        
        if (result.success) {
          await this.fetchModelStatus() // Refresh to show changes
        }
      } catch (error) {
        console.error(`Failed to unload model ${modelName}:`, error)
      } finally {
        this.loading = false
      }
    },
    
    // Formatting methods
    formatTierName(name: string): string {
      const tierNames = {
        'ultra-fast': 'Ultra Fast',
        'fast': 'Fast', 
        'medium': 'Medium',
        'slow': 'Slow',
        'general': 'General'
      }
      return tierNames[name as keyof typeof tierNames] || name.charAt(0).toUpperCase() + name.slice(1)
    },
    
    formatStatus(status: string): string {
      const statusNames = {
        'loaded': 'Loaded',
        'loading': 'Loading',
        'error': 'Error',
        'unavailable': 'Unavailable'
      }
      return statusNames[status as keyof typeof statusNames] || status
    },
    
    formatResponseTime(time?: number): string {
      if (!time) return 'N/A'
      return time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`
    },
    
    formatMemoryPressure(pressure: string): string {
      return pressure.charAt(0).toUpperCase() + pressure.slice(1)
    },
    
    formatAlertTime(timestamp: string): string {
      return new Date(timestamp).toLocaleTimeString()
    },
    
    // CSS class methods
    getHealthClass(healthy: boolean): string {
      return healthy ? 'healthy' : 'unhealthy'
    },
    
    getMemoryPressureClass(pressure: string): string {
      return `pressure-${pressure}`
    },
    
    getModelStatusClass(model: ModelStatus): string {
      return `status-${model.status}`
    },
    
    getStatusClass(status: string): string {
      return `status-${status}`
    },
    
    getResponseTimeClass(time?: number): string {
      if (!time) return ''
      if (time < 1000) return 'fast'
      if (time < 5000) return 'medium'
      return 'slow'
    }
  }
})
</script>

<style scoped>
.local-model-status {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.status-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.title-icon {
  width: 24px;
  height: 24px;
  color: var(--primary-color, #3b82f6);
}

.status-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--primary-color, #3b82f6);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.refresh-button:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
  transform: translateY(-1px);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
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

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-refresh-toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.auto-refresh-toggle label {
  font-size: 14px;
  color: var(--text-secondary, #666666);
  cursor: pointer;
}

/* System Overview */
.system-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.overview-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.overview-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.health-indicator, .connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
}

.health-dot, .connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.health-indicator.healthy .health-dot,
.connection-status.connected .connection-dot {
  background: #10b981;
}

.health-indicator.unhealthy .health-dot,
.connection-status.disconnected .connection-dot {
  background: #ef4444;
}

.overview-stats {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.stat-value.pressure-low { color: #10b981; }
.stat-value.pressure-medium { color: #f59e0b; }
.stat-value.pressure-high { color: #ef4444; }
.stat-value.pressure-critical { color: #dc2626; }

/* Memory Management */
.memory-management {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.memory-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-button.optimize {
  background: #f59e0b;
  color: white;
}

.action-button.optimize:hover:not(:disabled) {
  background: #d97706;
}

.action-button.preload {
  background: #10b981;
  color: white;
}

.action-button.preload:hover:not(:disabled) {
  background: #059669;
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  width: 16px;
  height: 16px;
}

.memory-progress {
  margin-top: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #666666);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--progress-bg, #f3f4f6);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-fill.pressure-low { background: #10b981; }
.progress-fill.pressure-medium { background: #f59e0b; }
.progress-fill.pressure-high { background: #ef4444; }
.progress-fill.pressure-critical { background: #dc2626; }

.pressure-indicator {
  display: flex;
  gap: 8px;
}

.pressure-label {
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.pressure-value {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.pressure-value.pressure-low { color: #10b981; }
.pressure-value.pressure-medium { color: #f59e0b; }
.pressure-value.pressure-high { color: #ef4444; }
.pressure-value.pressure-critical { color: #dc2626; }

/* Model Tiers */
.model-tiers {
  margin-bottom: 32px;
}

.tier-container {
  margin-bottom: 32px;
}

.tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.tier-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.tier-icon {
  width: 20px;
  height: 20px;
}

.tier-icon.tier-ultra-fast { color: #dc2626; }
.tier-icon.tier-fast { color: #ea580c; }
.tier-icon.tier-medium { color: #0891b2; }
.tier-icon.tier-slow { color: #7c3aed; }
.tier-icon.tier-general { color: #6b7280; }

.tier-count {
  font-size: 14px;
  color: var(--text-secondary, #666666);
  font-weight: 400;
}

.tier-stats {
  font-size: 14px;
  color: var(--text-secondary, #666666);
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.model-card {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.model-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.model-card.status-loaded {
  border-left: 4px solid #10b981;
}

.model-card.status-loading {
  border-left: 4px solid #f59e0b;
}

.model-card.status-error {
  border-left: 4px solid #ef4444;
}

.model-card.status-unavailable {
  border-left: 4px solid #6b7280;
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  font-family: 'Monaco', 'Consolas', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.model-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.status-loaded { background: #10b981; }
.status-dot.status-loading { background: #f59e0b; }
.status-dot.status-error { background: #ef4444; }
.status-dot.status-unavailable { background: #6b7280; }

.status-text {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.model-metrics {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.metric-icon {
  width: 12px;
  height: 12px;
  color: var(--text-secondary, #666666);
}

.metric-label {
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.metric-value {
  color: var(--text-primary, #1a1a1a);
  font-weight: 600;
}

.metric-value.fast { color: #10b981; }
.metric-value.medium { color: #f59e0b; }
.metric-value.slow { color: #ef4444; }

.model-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  margin-bottom: 12px;
}

.error-icon {
  width: 16px;
  height: 16px;
  color: #ef4444;
  flex-shrink: 0;
  margin-top: 1px;
}

.error-text {
  font-size: 12px;
  color: #dc2626;
  line-height: 1.4;
}

.model-actions {
  display: flex;
  gap: 8px;
}

.model-action {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.model-action.load {
  background: #dbeafe;
  color: #1d4ed8;
}

.model-action.load:hover:not(:disabled) {
  background: #bfdbfe;
}

.model-action.unload {
  background: #fee2e2;
  color: #dc2626;
}

.model-action.unload:hover:not(:disabled) {
  background: #fecaca;
}

.model-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Active Alerts */
.active-alerts {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.alert-count {
  background: #ef4444;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.alert-item.alert-critical .alert-icon,
.alert-item.alert-high .alert-icon {
  color: #dc2626;
}

.alert-item.alert-medium .alert-icon {
  color: #f59e0b;
}

.alert-item.alert-low .alert-icon {
  color: #0ea5e9;
}

.alert-content {
  flex: 1;
}

.alert-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 4px;
}

.alert-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.alert-type {
  text-transform: uppercase;
  font-weight: 500;
}

/* Last Update */
.last-update {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary, #666666);
  padding: 16px;
  background: var(--subtle-bg, #f9fafb);
  border-radius: 6px;
}

.update-icon {
  width: 16px;
  height: 16px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .local-model-status {
    --card-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --subtle-bg: #374151;
    --progress-bg: #4b5563;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .local-model-status {
    padding: 16px;
  }
  
  .status-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .status-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .system-overview {
    grid-template-columns: 1fr;
  }
  
  .models-grid {
    grid-template-columns: 1fr;
  }
  
  .memory-actions {
    width: 100%;
    justify-content: stretch;
  }
  
  .action-button {
    flex: 1;
    justify-content: center;
  }
}
</style>
