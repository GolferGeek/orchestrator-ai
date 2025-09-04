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

        <!-- Privacy & Data Protection Metrics -->
        <div class="privacy-metrics" v-if="hasPrivacyMetrics">
          <h4 class="section-title">
            <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V7l-8-4-8 4v5c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            Privacy & Data Protection
            <span class="privacy-score" :class="privacyScoreColor">
              {{ privacyScore }}% Protected
            </span>
          </h4>
          
          <div class="privacy-grid">
            <!-- PII Detection Metrics -->
            <div class="privacy-section" v-if="metadata.piiDetected || (metadata.piiTypes && metadata.piiTypes.length > 0)">
              <h5 class="subsection-title">
                <svg class="subsection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"/>
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                  <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                  <path d="M3 12h6m6 0h6"/>
                </svg>
                PII Detection
              </h5>
              <div class="metric-chips">
                <div class="metric-chip status-detected" v-if="metadata.piiDetected">
                  <svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/>
                    <path d="M12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                  PII Detected
                </div>
                <div v-for="piiType in metadata.piiTypes" :key="piiType" class="metric-chip pii-type">
                  {{ formatPIIType(piiType) }}
                </div>
              </div>
            </div>

            <!-- Sanitization Actions -->
            <div class="privacy-section" v-if="metadata.dataSanitizationApplied">
              <h5 class="subsection-title">
                <svg class="subsection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
                </svg>
                Sanitization Applied
              </h5>
              <div class="sanitization-stats">
                <div class="stat-row">
                  <span class="stat-label">Sanitization Level:</span>
                  <span class="stat-value" :class="`sanitization-${metadata.sanitizationLevel}`">
                    {{ formatSanitizationLevel(metadata.sanitizationLevel) }}
                  </span>
                </div>
                <div class="stat-row" v-if="metadata.pseudonymsUsed">
                  <span class="stat-label">Pseudonyms Used:</span>
                  <span class="stat-value pseudonyms">{{ metadata.pseudonymsUsed }}</span>
                  <div class="metric-chips inline" v-if="metadata.pseudonymTypes && metadata.pseudonymTypes.length > 0">
                    <div v-for="type in metadata.pseudonymTypes" :key="type" class="metric-chip pseudonym-type">
                      {{ formatPseudonymType(type) }}
                    </div>
                  </div>
                </div>
                <div class="stat-row" v-if="metadata.redactionsApplied">
                  <span class="stat-label">Redactions Applied:</span>
                  <span class="stat-value redactions">{{ metadata.redactionsApplied }}</span>
                  <div class="metric-chips inline" v-if="metadata.redactionTypes && metadata.redactionTypes.length > 0">
                    <div v-for="type in metadata.redactionTypes" :key="type" class="metric-chip redaction-type">
                      {{ formatRedactionType(type) }}
                    </div>
                  </div>
                </div>
                <div class="stat-row" v-if="metadata.sanitizationTimeMs">
                  <span class="stat-label">Processing Time:</span>
                  <span class="stat-value processing-time">{{ formatDuration(metadata.sanitizationTimeMs) }}</span>
                </div>
              </div>
            </div>

            <!-- Data Classification & Compliance -->
            <div class="privacy-section" v-if="metadata.dataClassification || metadata.complianceFlags">
              <h5 class="subsection-title">
                <svg class="subsection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"/>
                  <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                  <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                </svg>
                Classification & Compliance
              </h5>
              <div class="classification-stats">
                <div class="stat-row" v-if="metadata.dataClassification">
                  <span class="stat-label">Data Classification:</span>
                  <span class="stat-value" :class="`classification-${metadata.dataClassification}`">
                    {{ formatDataClassification(metadata.dataClassification) }}
                  </span>
                </div>
                <div class="stat-row" v-if="metadata.policyProfile">
                  <span class="stat-label">Policy Profile:</span>
                  <span class="stat-value policy-profile">{{ formatPolicyProfile(metadata.policyProfile) }}</span>
                </div>
                <div class="compliance-flags" v-if="metadata.complianceFlags">
                  <div v-for="(compliant, flag) in metadata.complianceFlags" :key="flag" 
                       class="compliance-flag" :class="{ compliant, 'non-compliant': !compliant }">
                    <svg class="compliance-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path v-if="compliant" d="M9 12l2 2 4-4"/>
                      <path v-else d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    {{ formatComplianceFlag(flag) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Source Blinding & Privacy Headers -->
            <div class="privacy-section" v-if="metadata.sourceBlindingApplied || metadata.noTrainHeaderSent">
              <h5 class="subsection-title">
                <svg class="subsection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <path d="M1 1l22 22"/>
                </svg>
                Source Protection
              </h5>
              <div class="source-protection-stats">
                <div class="protection-item" v-if="metadata.sourceBlindingApplied">
                  <svg class="protection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Source Blinding Active</span>
                  <span v-if="metadata.headersStripped" class="detail">({{ metadata.headersStripped }} headers stripped)</span>
                </div>
                <div class="protection-item" v-if="metadata.customUserAgentUsed">
                  <svg class="protection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>Custom User Agent</span>
                </div>
                <div class="protection-item" v-if="metadata.noTrainHeaderSent">
                  <svg class="protection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>No-Train Header Sent</span>
                </div>
                <div class="protection-item" v-if="metadata.noRetainHeaderSent">
                  <svg class="protection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span>No-Retain Header Sent</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Before/After Text Comparison -->
          <div class="text-comparison" v-if="metadata.originalText && metadata.sanitizedText">
            <h5 class="subsection-title">
              <svg class="subsection-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              Text Comparison
              <button @click="toggleTextComparison" class="toggle-comparison" :class="{ expanded: showTextComparison }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
                {{ showTextComparison ? 'Hide' : 'Show' }} Comparison
              </button>
            </h5>
            
            <transition name="slide-fade">
              <div v-if="showTextComparison" class="comparison-content">
                <div class="text-comparison-grid">
                  <div class="text-column original">
                    <h6 class="text-column-title">
                      <svg class="column-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                      </svg>
                      Original Text
                    </h6>
                    <div class="text-content">{{ metadata.originalText }}</div>
                  </div>
                  
                  <div class="text-column sanitized">
                    <h6 class="text-column-title">
                      <svg class="column-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"/>
                      </svg>
                      Sanitized Text
                    </h6>
                    <div class="text-content">{{ metadata.sanitizedText }}</div>
                  </div>
                </div>
                
                <div class="comparison-stats">
                  <div class="comparison-stat">
                    <span class="stat-label">Character Reduction:</span>
                    <span class="stat-value">{{ getCharacterReduction() }}%</span>
                  </div>
                  <div class="comparison-stat" v-if="metadata.reversalContextSize">
                    <span class="stat-label">Reversal Context Size:</span>
                    <span class="stat-value">{{ formatBytes(metadata.reversalContextSize) }}</span>
                  </div>
                </div>
              </div>
            </transition>
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
  
  // Privacy & Sanitization Metrics
  dataSanitizationApplied?: boolean
  sanitizationLevel?: 'none' | 'basic' | 'standard' | 'strict'
  piiDetected?: boolean
  piiTypes?: string[]
  pseudonymsUsed?: number
  pseudonymTypes?: string[]
  redactionsApplied?: number
  redactionTypes?: string[]
  sourceBlindingApplied?: boolean
  headersStripped?: number
  customUserAgentUsed?: boolean
  noTrainHeaderSent?: boolean
  noRetainHeaderSent?: boolean
  sanitizationTimeMs?: number
  reversalContextSize?: number
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
  policyProfile?: string
  sovereignMode?: boolean
  complianceFlags?: {
    gdprCompliant?: boolean
    hipaaCompliant?: boolean
    pciCompliant?: boolean
    customCompliance?: Record<string, boolean>
  }
  
  // Before/After Text for Comparison
  originalText?: string
  sanitizedText?: string
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
      expanded: false,
      showTextComparison: false
    }
  },
  computed: {
    hasMetadata(): boolean {
      return this.metadata && this.metadata.runId
    },
    showPerformanceInsights(): boolean {
      return this.metadata.duration > 0 || this.metadata.cost > 0
    },
    hasPrivacyMetrics(): boolean {
      return this.metadata.dataSanitizationApplied || 
             this.metadata.piiDetected || 
             this.metadata.sourceBlindingApplied ||
             (this.metadata.piiTypes && this.metadata.piiTypes.length > 0)
    },
    privacyScore(): number {
      if (!this.hasPrivacyMetrics) return 0
      let score = 0
      if (this.metadata.dataSanitizationApplied) score += 30
      if (this.metadata.sourceBlindingApplied) score += 20
      if (this.metadata.noTrainHeaderSent) score += 15
      if (this.metadata.pseudonymsUsed && this.metadata.pseudonymsUsed > 0) score += 20
      if (this.metadata.redactionsApplied && this.metadata.redactionsApplied > 0) score += 15
      return Math.min(score, 100)
    },
    privacyScoreColor(): string {
      const score = this.privacyScore
      if (score >= 80) return 'high-privacy'
      if (score >= 50) return 'medium-privacy'
      if (score >= 20) return 'low-privacy'
      return 'no-privacy'
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
    },
    toggleTextComparison() {
      this.showTextComparison = !this.showTextComparison
    },
    formatPIIType(type: string): string {
      const types = {
        'email': 'Email',
        'phone': 'Phone',
        'ssn': 'SSN',
        'credit_card': 'Credit Card',
        'name': 'Name',
        'address': 'Address',
        'ip_address': 'IP Address',
        'username': 'Username'
      }
      return types[type as keyof typeof types] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    },
    formatPseudonymType(type: string): string {
      const types = {
        'person_name': 'Person Name',
        'organization': 'Organization',
        'location': 'Location',
        'custom': 'Custom'
      }
      return types[type as keyof typeof types] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    },
    formatRedactionType(type: string): string {
      const types = {
        'secret_key': 'Secret Key',
        'password': 'Password',
        'api_key': 'API Key',
        'token': 'Token',
        'credential': 'Credential'
      }
      return types[type as keyof typeof types] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    },
    formatSanitizationLevel(level: string): string {
      const levels = {
        'none': 'None',
        'basic': 'Basic',
        'standard': 'Standard',
        'strict': 'Strict'
      }
      return levels[level as keyof typeof levels] || level
    },
    formatDataClassification(classification: string): string {
      const classifications = {
        'public': 'Public',
        'internal': 'Internal',
        'confidential': 'Confidential',
        'restricted': 'Restricted'
      }
      return classifications[classification as keyof typeof classifications] || classification
    },
    formatPolicyProfile(profile: string): string {
      const profiles = {
        'standard': 'Standard',
        'healthcare': 'Healthcare',
        'finance': 'Finance',
        'government': 'Government',
        'education': 'Education'
      }
      return profiles[profile as keyof typeof profiles] || profile.replace(/\b\w/g, l => l.toUpperCase())
    },
    formatComplianceFlag(flag: string): string {
      const flags = {
        'gdprCompliant': 'GDPR',
        'hipaaCompliant': 'HIPAA',
        'pciCompliant': 'PCI DSS',
        'soxCompliant': 'SOX',
        'customCompliance': 'Custom'
      }
      return flags[flag as keyof typeof flags] || flag.replace(/([A-Z])/g, ' $1').trim()
    },
    formatBytes(bytes: number): string {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    getCharacterReduction(): number {
      if (!this.metadata.originalText || !this.metadata.sanitizedText) return 0
      const original = this.metadata.originalText.length
      const sanitized = this.metadata.sanitizedText.length
      if (original === 0) return 0
      return Math.round(((original - sanitized) / original) * 100)
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

/* Privacy Metrics Styles */
.privacy-metrics {
  border-top: 1px solid var(--border-color, #e1e5e9);
  padding-top: 16px;
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.section-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.privacy-score {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.privacy-score.high-privacy { background: #dcfce7; color: #059669; }
.privacy-score.medium-privacy { background: #fef3c7; color: #d97706; }
.privacy-score.low-privacy { background: #fee2e2; color: #dc2626; }
.privacy-score.no-privacy { background: #f3f4f6; color: #6b7280; }

.privacy-grid {
  display: grid;
  gap: 16px;
}

.privacy-section {
  background: var(--section-bg, #f8f9fa);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 6px;
  padding: 12px;
}

.subsection-title {
  display: flex;
  align-items: center;
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subsection-icon {
  width: 12px;
  height: 12px;
  margin-right: 6px;
}

.metric-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.metric-chips.inline {
  display: inline-flex;
  margin-left: 8px;
}

.metric-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-chip.status-detected { background: #fee2e2; color: #dc2626; }
.metric-chip.pii-type { background: #dbeafe; color: #2563eb; }
.metric-chip.pseudonym-type { background: #d1fae5; color: #059669; }
.metric-chip.redaction-type { background: #fde68a; color: #d97706; }

.chip-icon {
  width: 10px;
  height: 10px;
}

.sanitization-stats, .classification-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #666666);
  min-width: 100px;
}

.stat-value {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.stat-value.sanitization-none { background: #f3f4f6; color: #6b7280; }
.stat-value.sanitization-basic { background: #fef3c7; color: #d97706; }
.stat-value.sanitization-standard { background: #dbeafe; color: #2563eb; }
.stat-value.sanitization-strict { background: #dcfce7; color: #059669; }

.stat-value.classification-public { background: #f0fdf4; color: #15803d; }
.stat-value.classification-internal { background: #fef3c7; color: #d97706; }
.stat-value.classification-confidential { background: #fef2f2; color: #dc2626; }
.stat-value.classification-restricted { background: #fdf2f8; color: #be185d; }

.stat-value.pseudonyms, .stat-value.redactions { background: #e0e7ff; color: #3730a3; }
.stat-value.processing-time { background: #f3f4f6; color: #374151; }
.stat-value.policy-profile { background: #f0f9ff; color: #0369a1; }

.compliance-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.compliance-flag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.compliance-flag.compliant { background: #dcfce7; color: #059669; }
.compliance-flag.non-compliant { background: #fee2e2; color: #dc2626; }

.compliance-icon {
  width: 10px;
  height: 10px;
}

.source-protection-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.protection-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-primary, #1a1a1a);
}

.protection-icon {
  width: 12px;
  height: 12px;
  color: #059669;
}

.protection-item .detail {
  font-size: 10px;
  color: var(--text-secondary, #666666);
  margin-left: 4px;
}

/* Text Comparison Styles */
.text-comparison {
  margin-top: 16px;
  border-top: 1px solid var(--border-color, #e1e5e9);
  padding-top: 16px;
}

.toggle-comparison {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary, #666666);
  transition: all 0.2s ease;
}

.toggle-comparison:hover {
  background: var(--hover-bg, #f5f5f5);
  color: var(--text-primary, #1a1a1a);
}

.toggle-comparison svg {
  width: 12px;
  height: 12px;
  transition: transform 0.2s ease;
}

.toggle-comparison.expanded svg {
  transform: rotate(180deg);
}

.comparison-content {
  margin-top: 12px;
}

.text-comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 12px;
}

.text-column {
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 6px;
  overflow: hidden;
}

.text-column-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  background: var(--header-bg, #f8f9fa);
  border-bottom: 1px solid var(--border-color, #e1e5e9);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.column-icon {
  width: 12px;
  height: 12px;
}

.text-content {
  padding: 12px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-primary, #1a1a1a);
  background: var(--code-bg, #ffffff);
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-column.original .text-column-title {
  color: #dc2626;
}

.text-column.sanitized .text-column-title {
  color: #059669;
}

.comparison-stats {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: var(--stats-bg, #f8f9fa);
  border: 1px solid var(--border-color, #e1e5e9);
  border-radius: 4px;
}

.comparison-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.comparison-stat .stat-label {
  color: var(--text-secondary, #666666);
}

.comparison-stat .stat-value {
  font-weight: 600;
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
  
  .text-comparison-grid {
    grid-template-columns: 1fr;
  }
  
  .section-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .privacy-score {
    align-self: flex-end;
  }
  
  .comparison-stats {
    flex-direction: column;
    gap: 8px;
  }
  
  .stat-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .stat-label {
    min-width: auto;
  }
}
</style>
