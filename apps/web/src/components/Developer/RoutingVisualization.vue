<template>
  <div class="routing-visualization">
    <div class="visualization-header">
      <h3 class="visualization-title">
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        Request Routing Flow
      </h3>
      
      <div class="flow-controls">
        <button @click="simulateRequest" :disabled="simulating" class="simulate-button">
          <svg class="simulate-icon" :class="{ 'animate-pulse': simulating }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          {{ simulating ? 'Simulating...' : 'Simulate Request' }}
        </button>
        
        <div class="speed-control">
          <label for="animation-speed">Speed:</label>
          <select id="animation-speed" v-model="animationSpeed">
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Flow Diagram -->
    <div class="flow-diagram" ref="flowDiagram">
      <!-- Request Entry Point -->
      <div class="flow-node entry-point" :class="{ active: activeStep >= 0 }">
        <div class="node-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
          </svg>
        </div>
        <div class="node-content">
          <h4>Request Entry</h4>
          <p>Agent/API request arrives</p>
        </div>
        <div class="node-details" v-if="currentRequest">
          <div class="detail-item">
            <span class="detail-label">Source:</span>
            <span class="detail-value">{{ currentRequest.source }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Complexity:</span>
            <span class="detail-value">{{ currentRequest.complexity }}</span>
          </div>
        </div>
      </div>

      <!-- Flow Arrow -->
      <div class="flow-arrow" :class="{ active: activeStep >= 1 }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12,5 19,12 12,19"/>
        </svg>
      </div>

      <!-- Routing Decision Engine -->
      <div class="flow-node decision-engine" :class="{ active: activeStep >= 1 }">
        <div class="node-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
        </div>
        <div class="node-content">
          <h4>Routing Engine</h4>
          <p>Analyzes request & determines route</p>
        </div>
        <div class="decision-factors" v-if="activeStep >= 1">
          <div class="factor-item" v-for="factor in routingFactors" :key="factor.name">
            <div class="factor-icon" :class="factor.status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4" v-if="factor.status === 'positive'"/>
                <path d="M18 6L6 18M6 6l12 12" v-else-if="factor.status === 'negative'"/>
                <circle cx="12" cy="12" r="1" v-else/>
              </svg>
            </div>
            <div class="factor-content">
              <span class="factor-name">{{ factor.name }}</span>
              <span class="factor-value">{{ factor.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Routing Paths -->
      <div class="routing-paths">
        <!-- Local Path -->
        <div class="routing-path local-path" :class="{ active: routingDecision === 'local' && activeStep >= 2 }">
          <div class="path-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12,5 19,12 12,19"/>
            </svg>
          </div>
          
          <div class="flow-node local-node">
            <div class="node-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div class="node-content">
              <h4>Local Ollama</h4>
              <p>Process with local models</p>
            </div>
            <div class="model-selection" v-if="routingDecision === 'local' && selectedModel">
              <div class="selected-model">
                <span class="model-label">Selected Model:</span>
                <span class="model-name">{{ selectedModel.name }}</span>
              </div>
              <div class="model-tier">
                <span class="tier-badge" :class="`tier-${selectedModel.tier}`">
                  {{ formatTier(selectedModel.tier) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- External Path -->
        <div class="routing-path external-path" :class="{ active: routingDecision === 'external' && activeStep >= 2 }">
          <div class="path-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12,5 19,12 12,19"/>
            </svg>
          </div>
          
          <div class="flow-node external-node">
            <div class="node-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
            </div>
            <div class="node-content">
              <h4>External Provider</h4>
              <p>Route to cloud service</p>
            </div>
            <div class="provider-selection" v-if="routingDecision === 'external' && selectedProvider">
              <div class="selected-provider">
                <span class="provider-label">Provider:</span>
                <span class="provider-name">{{ formatProvider(selectedProvider.name) }}</span>
              </div>
              <div class="provider-model">
                <span class="model-name">{{ selectedProvider.model }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Response -->
      <div class="flow-node response-node" :class="{ active: activeStep >= 3 }">
        <div class="node-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
          </svg>
        </div>
        <div class="node-content">
          <h4>Response</h4>
          <p>Return processed result</p>
        </div>
        <div class="response-metrics" v-if="activeStep >= 3 && responseMetrics">
          <div class="metric-item">
            <span class="metric-label">Duration:</span>
            <span class="metric-value" :class="getDurationClass(responseMetrics.duration)">
              {{ formatDuration(responseMetrics.duration) }}
            </span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Cost:</span>
            <span class="metric-value" :class="getCostClass(responseMetrics.cost)">
              ${{ formatCost(responseMetrics.cost) }}
            </span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Tokens:</span>
            <span class="metric-value">{{ responseMetrics.tokens }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Routing Statistics -->
    <div class="routing-stats">
      <h4>Routing Statistics</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon local">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.localRequests }}</span>
            <span class="stat-label">Local Requests</span>
          </div>
          <div class="stat-percentage">
            {{ formatPercentage(stats.localRequests, stats.totalRequests) }}
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon external">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats.externalRequests }}</span>
            <span class="stat-label">External Requests</span>
          </div>
          <div class="stat-percentage">
            {{ formatPercentage(stats.externalRequests, stats.totalRequests) }}
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon performance">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ formatDuration(stats.avgResponseTime) }}</span>
            <span class="stat-label">Avg Response Time</span>
          </div>
          <div class="stat-trend" :class="stats.responseTrend">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" v-if="stats.responseTrend === 'up'"/>
              <polyline points="1 6 10.5 15.5 15.5 10.5 23 18" v-else-if="stats.responseTrend === 'down'"/>
              <line x1="1" y1="12" x2="23" y2="12" v-else/>
            </svg>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon cost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">${{ formatCost(stats.totalCost) }}</span>
            <span class="stat-label">Total Cost</span>
          </div>
          <div class="stat-savings">
            <span class="savings-label">Saved:</span>
            <span class="savings-value">${{ formatCost(stats.costSaved) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Decision Legend -->
    <div class="decision-legend">
      <h4>Decision Factors</h4>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-icon positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <span class="legend-text">Favorable for local routing</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon negative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </div>
          <span class="legend-text">Requires external provider</span>
        </div>
        <div class="legend-item">
          <div class="legend-icon neutral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"/>
            </svg>
          </div>
          <span class="legend-text">Neutral factor</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

interface RoutingFactor {
  name: string
  value: string
  status: 'positive' | 'negative' | 'neutral'
}

interface CurrentRequest {
  source: string
  complexity: string
}

interface SelectedModel {
  name: string
  tier: string
}

interface SelectedProvider {
  name: string
  model: string
}

interface ResponseMetrics {
  duration: number
  cost: number
  tokens: number
}

interface RoutingStats {
  localRequests: number
  externalRequests: number
  totalRequests: number
  avgResponseTime: number
  totalCost: number
  costSaved: number
  responseTrend: 'up' | 'down' | 'stable'
}

export default defineComponent({
  name: 'RoutingVisualization',
  data() {
    return {
      activeStep: -1,
      simulating: false,
      animationSpeed: 'normal',
      routingDecision: null as 'local' | 'external' | null,
      currentRequest: null as CurrentRequest | null,
      selectedModel: null as SelectedModel | null,
      selectedProvider: null as SelectedProvider | null,
      responseMetrics: null as ResponseMetrics | null,
      routingFactors: [] as RoutingFactor[],
      stats: {
        localRequests: 142,
        externalRequests: 58,
        totalRequests: 200,
        avgResponseTime: 2340,
        totalCost: 0.234,
        costSaved: 1.567,
        responseTrend: 'down'
      } as RoutingStats
    }
  },
  computed: {
    animationDuration(): number {
      const durations = { slow: 2000, normal: 1000, fast: 500 }
      return durations[this.animationSpeed as keyof typeof durations]
    }
  },
  methods: {
    async simulateRequest() {
      if (this.simulating) return
      
      this.simulating = true
      this.activeStep = -1
      this.routingDecision = null
      this.currentRequest = null
      this.selectedModel = null
      this.selectedProvider = null
      this.responseMetrics = null
      this.routingFactors = []

      // Step 1: Request arrives
      await this.animateStep(0)
      this.currentRequest = this.generateRandomRequest()

      // Step 2: Routing decision
      await this.animateStep(1)
      this.routingFactors = this.generateRoutingFactors()
      this.routingDecision = this.determineRouting()

      // Step 3: Process request
      await this.animateStep(2)
      if (this.routingDecision === 'local') {
        this.selectedModel = this.selectLocalModel()
      } else {
        this.selectedProvider = this.selectExternalProvider()
      }

      // Step 4: Response
      await this.animateStep(3)
      this.responseMetrics = this.generateResponseMetrics()

      this.simulating = false
    },

    async animateStep(step: number) {
      return new Promise(resolve => {
        setTimeout(() => {
          this.activeStep = step
          resolve(void 0)
        }, this.animationDuration / 4)
      })
    },

    generateRandomRequest(): CurrentRequest {
      const sources = ['Agent Chat', 'API Request', 'Workflow', 'Batch Process']
      const complexities = ['simple', 'medium', 'complex', 'reasoning']
      
      return {
        source: sources[Math.floor(Math.random() * sources.length)],
        complexity: complexities[Math.floor(Math.random() * complexities.length)]
      }
    },

    generateRoutingFactors(): RoutingFactor[] {
      const factors = [
        { name: 'Ollama Available', value: 'Yes', status: 'positive' },
        { name: 'Model Loaded', value: 'llama3.2:latest', status: 'positive' },
        { name: 'Memory Pressure', value: 'Low', status: 'positive' },
        { name: 'Request Complexity', value: this.currentRequest?.complexity || 'medium', status: 'neutral' },
        { name: 'Response Speed', value: 'Required: Fast', status: 'positive' }
      ]

      // Randomly modify some factors to create variety
      if (Math.random() > 0.7) {
        factors[0] = { name: 'Ollama Available', value: 'No', status: 'negative' }
        factors[1] = { name: 'Model Loaded', value: 'None', status: 'negative' }
      }

      if (Math.random() > 0.8) {
        factors[2] = { name: 'Memory Pressure', value: 'High', status: 'negative' }
      }

      return factors
    },

    determineRouting(): 'local' | 'external' {
      const negativeFactors = this.routingFactors.filter(f => f.status === 'negative').length
      return negativeFactors > 1 ? 'external' : 'local'
    },

    selectLocalModel(): SelectedModel {
      const models = [
        { name: 'llama3.2:latest', tier: 'ultra-fast' },
        { name: 'qwen3:8b', tier: 'fast' },
        { name: 'gpt-oss:20b', tier: 'medium' },
        { name: 'qwq:latest', tier: 'slow' }
      ]
      
      const complexity = this.currentRequest?.complexity || 'medium'
      if (complexity === 'simple') return models[0]
      if (complexity === 'medium') return models[1]
      if (complexity === 'complex') return models[2]
      return models[3]
    },

    selectExternalProvider(): SelectedProvider {
      const providers = [
        { name: 'openai', model: 'gpt-4' },
        { name: 'anthropic', model: 'claude-3-sonnet' },
        { name: 'openai', model: 'gpt-3.5-turbo' }
      ]
      
      return providers[Math.floor(Math.random() * providers.length)]
    },

    generateResponseMetrics(): ResponseMetrics {
      const isLocal = this.routingDecision === 'local'
      
      return {
        duration: isLocal ? 
          Math.floor(Math.random() * 3000) + 500 : 
          Math.floor(Math.random() * 5000) + 1000,
        cost: isLocal ? 
          0 : 
          Math.random() * 0.05 + 0.001,
        tokens: Math.floor(Math.random() * 1500) + 200
      }
    },

    // Formatting methods
    formatTier(tier: string): string {
      const tierNames = {
        'ultra-fast': 'Ultra Fast',
        'fast': 'Fast',
        'medium': 'Medium', 
        'slow': 'Slow'
      }
      return tierNames[tier as keyof typeof tierNames] || tier
    },

    formatProvider(provider: string): string {
      const providerNames = {
        'openai': 'OpenAI',
        'anthropic': 'Anthropic',
        'ollama': 'Ollama'
      }
      return providerNames[provider as keyof typeof providerNames] || provider
    },

    formatDuration(duration: number): string {
      if (duration < 1000) return `${duration}ms`
      return `${(duration / 1000).toFixed(2)}s`
    },

    formatCost(cost: number): string {
      return cost.toFixed(6)
    },

    formatPercentage(value: number, total: number): string {
      return `${Math.round((value / total) * 100)}%`
    },

    getDurationClass(duration: number): string {
      if (duration < 1000) return 'fast'
      if (duration < 3000) return 'medium'
      return 'slow'
    },

    getCostClass(cost: number): string {
      if (cost === 0) return 'free'
      if (cost < 0.01) return 'low'
      return 'high'
    }
  }
})
</script>

<style scoped>
.routing-visualization {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.visualization-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.visualization-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.title-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color, #3b82f6);
}

.flow-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.simulate-button {
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

.simulate-button:hover:not(:disabled) {
  background: var(--primary-hover, #2563eb);
  transform: translateY(-1px);
}

.simulate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.simulate-icon {
  width: 16px;
  height: 16px;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.speed-control label {
  color: var(--text-secondary, #666666);
}

.speed-control select {
  padding: 4px 8px;
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 4px;
  background: var(--input-bg, #ffffff);
  color: var(--text-primary, #1a1a1a);
}

/* Flow Diagram */
.flow-diagram {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--flow-bg, #f9fafb);
  border-radius: 8px;
  position: relative;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: var(--node-bg, #ffffff);
  border: 2px solid var(--border-color, #e1e5e9);
  border-radius: 12px;
  min-width: 200px;
  transition: all 0.3s ease;
  opacity: 0.4;
}

.flow-node.active {
  opacity: 1;
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  transform: scale(1.02);
}

.node-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--icon-bg, #f3f4f6);
  border-radius: 50%;
  color: var(--icon-color, #6b7280);
}

.flow-node.active .node-icon {
  background: var(--primary-color, #3b82f6);
  color: white;
}

.node-icon svg {
  width: 20px;
  height: 20px;
}

.node-content {
  text-align: center;
}

.node-content h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.node-content p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary, #666666);
}

.node-details, .decision-factors, .model-selection, .provider-selection, .response-metrics {
  width: 100%;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color, #e1e5e9);
}

.detail-item, .metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
}

.detail-label, .metric-label {
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.detail-value, .metric-value {
  color: var(--text-primary, #1a1a1a);
  font-weight: 600;
}

.metric-value.fast { color: #10b981; }
.metric-value.medium { color: #f59e0b; }
.metric-value.slow { color: #ef4444; }
.metric-value.free { color: #10b981; }
.metric-value.low { color: #059669; }
.metric-value.high { color: #dc2626; }

/* Flow Arrows */
.flow-arrow {
  width: 24px;
  height: 24px;
  color: var(--border-color, #e1e5e9);
  transition: all 0.3s ease;
  opacity: 0.4;
}

.flow-arrow.active {
  color: var(--primary-color, #3b82f6);
  opacity: 1;
}

.flow-arrow svg {
  width: 100%;
  height: 100%;
}

/* Decision Factors */
.decision-factors {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.factor-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--factor-bg, #f8f9fa);
  border-radius: 6px;
}

.factor-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.factor-icon.positive {
  background: #dcfce7;
  color: #059669;
}

.factor-icon.negative {
  background: #fee2e2;
  color: #dc2626;
}

.factor-icon.neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.factor-icon svg {
  width: 10px;
  height: 10px;
}

.factor-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.factor-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.factor-value {
  font-size: 11px;
  color: var(--text-secondary, #666666);
}

/* Routing Paths */
.routing-paths {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 600px;
  gap: 40px;
}

.routing-path {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  opacity: 0.4;
  transition: all 0.3s ease;
}

.routing-path.active {
  opacity: 1;
}

.path-arrow {
  width: 20px;
  height: 20px;
  color: var(--border-color, #e1e5e9);
  transition: all 0.3s ease;
}

.routing-path.active .path-arrow {
  color: var(--primary-color, #3b82f6);
}

.local-node, .external-node {
  min-width: 180px;
}

.local-path.active .local-node {
  border-color: #10b981;
}

.local-path.active .local-node .node-icon {
  background: #10b981;
}

.external-path.active .external-node {
  border-color: #f59e0b;
}

.external-path.active .external-node .node-icon {
  background: #f59e0b;
}

/* Model/Provider Selection */
.selected-model, .selected-provider {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.model-label, .provider-label {
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.model-name, .provider-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  font-family: 'Monaco', 'Consolas', monospace;
}

.tier-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tier-ultra-fast { background: #fee2e2; color: #dc2626; }
.tier-fast { background: #fed7aa; color: #ea580c; }
.tier-medium { background: #bae6fd; color: #0891b2; }
.tier-slow { background: #e9d5ff; color: #7c3aed; }

/* Routing Statistics */
.routing-stats {
  margin-bottom: 24px;
}

.routing-stats h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--stat-bg, #f8f9fa);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 8px;
}

.stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.local {
  background: #dcfce7;
  color: #059669;
}

.stat-icon.external {
  background: #fef3c7;
  color: #d97706;
}

.stat-icon.performance {
  background: #dbeafe;
  color: #2563eb;
}

.stat-icon.cost {
  background: #f3e8ff;
  color: #7c3aed;
}

.stat-icon svg {
  width: 16px;
  height: 16px;
}

.stat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.stat-percentage, .stat-savings {
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

.stat-trend {
  width: 16px;
  height: 16px;
}

.stat-trend.up { color: #dc2626; }
.stat-trend.down { color: #10b981; }
.stat-trend.stable { color: #6b7280; }

.savings-label {
  font-weight: 500;
}

.savings-value {
  color: #10b981;
  font-weight: 600;
}

/* Decision Legend */
.decision-legend h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.legend-icon.positive {
  background: #dcfce7;
  color: #059669;
}

.legend-icon.negative {
  background: #fee2e2;
  color: #dc2626;
}

.legend-icon.neutral {
  background: #f3f4f6;
  color: #6b7280;
}

.legend-icon svg {
  width: 10px;
  height: 10px;
}

.legend-text {
  font-size: 12px;
  color: var(--text-secondary, #666666);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .routing-visualization {
    --card-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --flow-bg: #374151;
    --node-bg: #1f2937;
    --icon-bg: #4b5563;
    --icon-color: #9ca3af;
    --factor-bg: #374151;
    --stat-bg: #374151;
    --input-bg: #374151;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .routing-visualization {
    padding: 16px;
  }
  
  .visualization-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .flow-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .flow-diagram {
    padding: 16px;
  }
  
  .routing-paths {
    flex-direction: column;
    gap: 24px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .legend-items {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
