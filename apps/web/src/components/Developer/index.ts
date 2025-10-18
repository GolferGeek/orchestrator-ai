// Developer Tools Components
export { default as DevToolsPanel } from './DevToolsPanel.vue'
export { default as RunMetadataPanel } from './RunMetadataPanel.vue'
export { default as LocalModelStatus } from './LocalModelStatus.vue'
export { default as RoutingVisualization } from './RoutingVisualization.vue'

// Types
export interface RunMetadata {
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

export interface ModelStatus {
  name: string
  status: 'loaded' | 'loading' | 'error' | 'unavailable'
  responseTime?: number
  size?: string
  useCount?: number
  errorMessage?: string
  isThreeTier?: boolean
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical'
  avgResponseTime: number
  modelsTotal: number
  modelsHealthy: number
  totalCost: number
}

export interface Alert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: string
  type: string
  modelName?: string
  tier?: string
  metrics?: Record<string, unknown>
}
