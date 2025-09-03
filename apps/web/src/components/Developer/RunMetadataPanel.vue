<template>
  <div class="run-metadata-panel" v-if="hasMetadata">
    <div class="panel-header">
      <h3 class="panel-title">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
          <path d="M12 22s8-4 8-10V7l-8-4-8 4v5c0 6 8 10 8 10z"/>
        </svg>
        Run Metadata
      </h3>
      <button @click="toggleExpanded" class="toggle-button" :aria-expanded="expanded">
        <svg class="icon" :class="{ 'rotate-180': expanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
        <span class="sr-only">{{ expanded ? 'Collapse' : 'Expand' }} metadata panel</span>
      </button>
    </div>
    
    <transition name="slide-fade">
      <div class="panel-content" v-if="expanded">
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                <path d="M3 12h6m6 0h6"/>
              </svg>
              Run ID
            </span>
            <span class="value" :title="metadata.runId">
              <code class="run-id">{{ formatRunId(metadata.runId) }}</code>
              <button @click="copyToClipboard(metadata.runId)" class="copy-button" title="Copy Run ID">
                <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
              </svg>
              Provider
            </span>
            <span class="value">
              <span class="provider-badge" :class="`provider-${metadata.provider}`">
                {{ formatProvider(metadata.provider) }}
              </span>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
              </svg>
              Model
            </span>
            <span class="value">
              <code class="model-name">{{ metadata.model }}</code>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18l-2 13H5L3 6z"/>
                <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
              Tier
            </span>
            <span class="value">
              <span class="tier-badge" :class="`tier-${metadata.tier}`">
                {{ formatTier(metadata.tier) }}
              </span>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Duration
            </span>
            <span class="value">
              <span class="duration" :class="getDurationClass(metadata.duration)">
                {{ formatDuration(metadata.duration) }}
              </span>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
              Cost
            </span>
            <span class="value">
              <span class="cost" :class="getCostClass(metadata.cost)">
                ${{ formatCost(metadata.cost) }}
              </span>
            </span>
          </div>
          
          <div class="metadata-item">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Timestamp
            </span>
            <span class="value">
              <time class="timestamp" :datetime="metadata.timestamp" :title="formatFullTimestamp(metadata.timestamp)">
                {{ formatTimestamp(metadata.timestamp) }}
              </time>
            </span>
          </div>

          <!-- Additional metrics if available -->
          <div class="metadata-item" v-if="metadata.inputTokens">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
              Input Tokens
            </span>
            <span class="value">
              <span class="token-count">{{ formatTokens(metadata.inputTokens) }}</span>
            </span>
          </div>

          <div class="metadata-item" v-if="metadata.outputTokens">
            <span class="label">
              <svg class="label-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Output Tokens
            </span>
            <span class="value">
              <span class="token-count">{{ formatTokens(metadata.outputTokens) }}</span>
            </span>
          </div>
        </div>

        <!-- Performance Insights -->
        <div class="performance-insights" v-if="showPerformanceInsights">
          <h4 class="insights-title">Performance Insights</h4>
          <div class="insights-grid">
            <div class="insight-item" v-if="getSpeedInsight(metadata.duration)">
              <span class="insight-icon" :class="getSpeedInsight(metadata.duration).type">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </span>
              <span class="insight-text">{{ getSpeedInsight(metadata.duration).text }}</span>
            </div>
            
            <div class="insight-item" v-if="getCostInsight(metadata.cost)">
              <span class="insight-icon" :class="getCostInsight(metadata.cost).type">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </span>
              <span class="insight-text">{{ getCostInsight(metadata.cost).text }}</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

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

export default defineComponent({
  name: 'RunMetadataPanel',
  props: {
    metadata: {
      type: Object as PropType<RunMetadata>,
      default: () => ({})
    }
  },
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    hasMetadata(): boolean {
      return this.metadata && this.metadata.runId
    },
    showPerformanceInsights(): boolean {
      return this.metadata.duration > 0 || this.metadata.cost > 0
    }
  },
  methods: {
    toggleExpanded() {
      this.expanded = !this.expanded
    },
    formatRunId(runId: string): string {
      if (!runId) return 'N/A'
      return runId.length > 12 ? `${runId.substring(0, 8)}...${runId.substring(runId.length - 4)}` : runId
    },
    formatProvider(provider: string): string {
      const providers = {
        'openai': 'OpenAI',
        'anthropic': 'Anthropic',
        'ollama': 'Ollama',
        'local': 'Local'
      }
      return providers[provider as keyof typeof providers] || provider
    },
    formatTier(tier: string): string {
      const tiers = {
        'ultra-fast': 'Ultra Fast',
        'fast': 'Fast',
        'balanced': 'Balanced',
        'high-quality': 'High Quality',
        'local': 'Local',
        'external': 'External'
      }
      return tiers[tier as keyof typeof tiers] || tier
    },
    formatDuration(duration: number): string {
      if (!duration) return 'N/A'
      if (duration < 1000) return `${duration}ms`
      return `${(duration / 1000).toFixed(2)}s`
    },
    formatCost(cost: number): string {
      if (!cost) return '0.000000'
      return cost.toFixed(6)
    },
    formatTimestamp(timestamp: string): string {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toLocaleString()
    },
    formatFullTimestamp(timestamp: string): string {
      if (!timestamp) return 'N/A'
      return new Date(timestamp).toISOString()
    },
    formatTokens(tokens: number): string {
      if (!tokens) return 'N/A'
      return tokens.toLocaleString()
    },
    getDurationClass(duration: number): string {
      if (duration < 1000) return 'fast'
      if (duration < 5000) return 'medium'
      return 'slow'
    },
    getCostClass(cost: number): string {
      if (cost < 0.001) return 'low'
      if (cost < 0.01) return 'medium'
      return 'high'
    },
    getSpeedInsight(duration: number) {
      if (!duration) return null
      if (duration < 1000) return { type: 'positive', text: 'Excellent response time' }
      if (duration < 3000) return { type: 'neutral', text: 'Good response time' }
      if (duration < 10000) return { type: 'warning', text: 'Slow response time' }
      return { type: 'negative', text: 'Very slow response time' }
    },
    getCostInsight(cost: number) {
      if (!cost) return null
      if (cost < 0.001) return { type: 'positive', text: 'Very cost effective' }
      if (cost < 0.01) return { type: 'neutral', text: 'Moderate cost' }
      return { type: 'warning', text: 'High cost request' }
    },
    async copyToClipboard(text: string) {
      try {
        await navigator.clipboard.writeText(text)
        // Could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard:', err)
      }
    }
  }
})
</script>

<style scoped>
.run-metadata-panel {
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #e1e5e9);
  cursor: pointer;
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

.toggle-button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary, #666666);
  transition: all 0.2s ease;
}

.toggle-button:hover {
  background: var(--hover-bg, #f5f5f5);
  color: var(--text-primary, #1a1a1a);
}

.icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.rotate-180 {
  transform: rotate(180deg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.panel-content {
  padding: 16px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #666666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.label-icon {
  width: 12px;
  height: 12px;
}

.value {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary, #1a1a1a);
}

.run-id, .model-name {
  font-family: 'Monaco', 'Consolas', monospace;
  background: var(--code-bg, #f8f9fa);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.copy-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  color: var(--text-secondary, #666666);
  transition: color 0.2s ease;
}

.copy-button:hover {
  color: var(--text-primary, #1a1a1a);
}

.copy-icon {
  width: 12px;
  height: 12px;
}

.provider-badge, .tier-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-openai { background: #10a37f; color: white; }
.provider-anthropic { background: #d97706; color: white; }
.provider-ollama { background: #3b82f6; color: white; }
.provider-local { background: #059669; color: white; }

.tier-ultra-fast { background: #dc2626; color: white; }
.tier-fast { background: #ea580c; color: white; }
.tier-balanced { background: #0891b2; color: white; }
.tier-high-quality { background: #7c3aed; color: white; }
.tier-local { background: #059669; color: white; }
.tier-external { background: #6b7280; color: white; }

.duration.fast { color: #059669; font-weight: 600; }
.duration.medium { color: #d97706; font-weight: 600; }
.duration.slow { color: #dc2626; font-weight: 600; }

.cost.low { color: #059669; font-weight: 600; }
.cost.medium { color: #d97706; font-weight: 600; }
.cost.high { color: #dc2626; font-weight: 600; }

.timestamp {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.token-count {
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 600;
}

.performance-insights {
  border-top: 1px solid var(--border-color, #e1e5e9);
  padding-top: 16px;
  margin-top: 16px;
}

.insights-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.insights-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--insight-bg, #f8f9fa);
  border: 1px solid var(--border-color, #e1e5e9);
}

.insight-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.insight-icon svg {
  width: 12px;
  height: 12px;
}

.insight-icon.positive { background: #dcfce7; color: #059669; }
.insight-icon.neutral { background: #fef3c7; color: #d97706; }
.insight-icon.warning { background: #fee2e2; color: #dc2626; }
.insight-icon.negative { background: #fecaca; color: #b91c1c; }

.insight-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

/* Slide fade transition */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .run-metadata-panel {
    --card-bg: #1f2937;
    --border-color: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --hover-bg: #374151;
    --code-bg: #374151;
    --insight-bg: #374151;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .metadata-grid {
    grid-template-columns: 1fr;
  }
  
  .panel-header {
    padding: 12px;
  }
  
  .panel-content {
    padding: 12px;
  }
}
</style>
