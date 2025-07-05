<template>
  <div class="debug-panel" v-if="isVisible">
    <div class="debug-header">
      <div class="debug-title">
        <ion-icon :icon="bugOutline" size="small"></ion-icon>
        <span>Delegation Debug Panel</span>
      </div>
      <div class="debug-controls">
        <ion-button fill="clear" size="small" @click="refreshData">
          <ion-icon :icon="refreshOutline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button fill="clear" size="small" @click="toggleMinimized">
          <ion-icon :icon="minimized ? chevronUpOutline : chevronDownOutline" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-button fill="clear" size="small" @click="close">
          <ion-icon :icon="closeOutline" slot="icon-only"></ion-icon>
        </ion-button>
      </div>
    </div>

    <div v-if="!minimized" class="debug-content">
      <!-- Session Overview -->
      <div class="debug-section">
        <h4>Session Overview</h4>
        <div class="debug-grid">
          <div class="debug-item">
            <span class="label">Messages:</span>
            <span class="value">{{ sessionMessages.length }}</span>
          </div>
          <div class="debug-item">
            <span class="label">Agents Used:</span>
            <span class="value">{{ uniqueAgents.length }}</span>
          </div>
          <div class="debug-item">
            <span class="label">Delegations:</span>
            <span class="value">{{ delegationCount }}</span>
          </div>
          <div class="debug-item">
            <span class="label">Avg Confidence:</span>
            <span class="value">{{ averageConfidence }}%</span>
          </div>
        </div>
      </div>

      <!-- Delegation Flow -->
      <div class="debug-section">
        <h4>Delegation Flow</h4>
        <div class="delegation-flow">
          <div 
            v-for="(delegation, index) in delegationFlow" 
            :key="index"
            class="flow-item"
            :class="{ 'sticky': delegation.stickyContext }"
          >
            <div class="flow-node">
              <ion-icon 
                :icon="delegation.stickyContext ? linkOutline : swapHorizontalOutline" 
                :color="delegation.stickyContext ? 'success' : 'primary'"
                size="small"
              ></ion-icon>
              <span class="agent-name">{{ delegation.agentName }}</span>
              <span class="confidence" :class="getConfidenceClass(delegation.confidence)">
                {{ Math.round((delegation.confidence || 0) * 100) }}%
              </span>
            </div>
            <div v-if="delegation.reason" class="flow-reason">{{ delegation.reason }}</div>
            <div v-if="index < delegationFlow.length - 1" class="flow-arrow">↓</div>
          </div>
        </div>
      </div>

      <!-- Agent Performance -->
      <div class="debug-section">
        <h4>Agent Performance</h4>
        <div class="agent-stats">
          <div 
            v-for="agent in agentStats" 
            :key="agent.name"
            class="agent-stat-item"
          >
            <div class="agent-header">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="usage-count">{{ agent.usageCount }}x</span>
            </div>
            <div class="agent-metrics">
              <div class="metric">
                <span class="metric-label">Avg Confidence:</span>
                <span class="metric-value">{{ agent.avgConfidence }}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Sticky Rate:</span>
                <span class="metric-value">{{ agent.stickyRate }}%</span>
              </div>
              <div class="metric">
                <span class="metric-label">Last Used:</span>
                <span class="metric-value">{{ formatRelativeTime(agent.lastUsed) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Context Analysis -->
      <div class="debug-section">
        <h4>Context Analysis</h4>
        <div class="context-info">
          <div class="context-item">
            <span class="label">Current Agent:</span>
            <span class="value">{{ currentAgent || 'None' }}</span>
          </div>
          <div class="context-item">
            <span class="label">Context Strength:</span>
            <span class="value">{{ currentContextStrength }}%</span>
            <div class="context-bar">
              <div 
                class="context-fill" 
                :style="{ width: `${currentContextStrength}%` }"
                :class="getContextStrengthClass(currentContextStrength)"
              ></div>
            </div>
          </div>
          <div class="context-item">
            <span class="label">Topic Continuity:</span>
            <span class="value">{{ topicContinuity || 'Unknown' }}</span>
          </div>
        </div>
      </div>

      <!-- Recent Decisions -->
      <div class="debug-section">
        <h4>Recent Decisions (Last 5)</h4>
        <div class="decision-log">
          <div 
            v-for="(decision, index) in recentDecisions" 
            :key="index"
            class="decision-item"
          >
            <div class="decision-header">
              <span class="decision-type">{{ decision.type }}</span>
              <span class="decision-time">{{ formatTime(decision.timestamp) }}</span>
            </div>
            <div class="decision-details">{{ decision.details }}</div>
            <div v-if="decision.confidence" class="decision-confidence">
              Confidence: {{ Math.round(decision.confidence * 100) }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { IonIcon, IonButton } from '@ionic/vue';
import {
  bugOutline,
  refreshOutline,
  chevronUpOutline,
  chevronDownOutline,
  closeOutline,
  linkOutline,
  swapHorizontalOutline
} from 'ionicons/icons';
import { useSessionStore } from '@/stores/sessionStore';

interface Props {
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
});

const emit = defineEmits(['close']);

const sessionStore = useSessionStore();
const isVisible = ref(props.visible);
const minimized = ref(false);

// Watch for prop changes
watch(() => props.visible, (newValue) => {
  isVisible.value = newValue;
});

// Computed properties for analysis
const sessionMessages = computed(() => sessionStore.currentSessionMessages);

const uniqueAgents = computed(() => {
  const agents = new Set();
  sessionMessages.value.forEach(msg => {
    if (msg.role === 'assistant' && msg.metadata?.agentName) {
      agents.add(msg.metadata!.agentName);
    }
  });
  return Array.from(agents);
});

const delegationCount = computed(() => {
  return sessionMessages.value.filter(msg => 
    msg.role === 'assistant' && msg.metadata?.delegatedTo
  ).length;
});

const averageConfidence = computed(() => {
  const confidenceValues = sessionMessages.value
    .filter(msg => msg.metadata?.confidence)
    .map(msg => msg.metadata!.confidence);
  
  if (confidenceValues.length === 0) return 0;
  
  const avg = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
  return Math.round(avg * 100);
});

const delegationFlow = computed(() => {
  const flow: any[] = [];
  
  sessionMessages.value.forEach(msg => {
    if (msg.role === 'assistant' && msg.metadata?.agentName) {
      flow.push({
        agentName: msg.metadata.agentName,
        confidence: msg.metadata.confidence,
        stickyContext: msg.metadata.stickyContext,
        reason: msg.metadata.continuityReason || msg.metadata.delegationReason,
        timestamp: msg.timestamp
      });
    }
  });
  
  return flow;
});

const agentStats = computed(() => {
  const stats: Record<string, any> = {};
  
  sessionMessages.value.forEach(msg => {
    if (msg.role === 'assistant' && msg.metadata?.agentName) {
      const agentName = msg.metadata!.agentName;
      
      if (!stats[agentName]) {
        stats[agentName] = {
          name: agentName,
          usageCount: 0,
          confidenceSum: 0,
          confidenceCount: 0,
          stickyCount: 0,
          lastUsed: msg.timestamp
        };
      }
      
      stats[agentName].usageCount++;
      
      if (msg.metadata!.confidence) {
        stats[agentName].confidenceSum += msg.metadata!.confidence;
        stats[agentName].confidenceCount++;
      }
      
      if (msg.metadata!.stickyContext) {
        stats[agentName].stickyCount++;
      }
      
      if (new Date(msg.timestamp) > new Date(stats[agentName].lastUsed)) {
        stats[agentName].lastUsed = msg.timestamp;
      }
    }
  });
  
  return Object.values(stats).map((stat: any) => ({
    ...stat,
    avgConfidence: stat.confidenceCount > 0 
      ? Math.round((stat.confidenceSum / stat.confidenceCount) * 100) 
      : 0,
    stickyRate: Math.round((stat.stickyCount / stat.usageCount) * 100)
  })).sort((a, b) => b.usageCount - a.usageCount);
});

const currentAgent = computed(() => {
  const lastAssistantMessage = sessionMessages.value
    .slice()
    .reverse()
    .find(msg => msg.role === 'assistant' && msg.metadata?.agentName);
  
  return lastAssistantMessage?.metadata?.agentName;
});

const currentContextStrength = computed(() => {
  const lastAssistantMessage = sessionMessages.value
    .slice()
    .reverse()
    .find(msg => msg.role === 'assistant' && msg.metadata?.agentContext?.contextStrength);
  
  const strength = lastAssistantMessage?.metadata?.agentContext?.contextStrength || 0;
  return Math.round(strength * 100);
});

const topicContinuity = computed(() => {
  // Simple topic continuity analysis
  const recentMessages = sessionMessages.value.slice(-5);
  const topics = new Set();
  
  recentMessages.forEach(msg => {
    if (msg.metadata?.topics) {
      msg.metadata.topics.forEach((topic: string) => topics.add(topic));
    }
  });
  
  if (topics.size === 0) return 'No topics identified';
  if (topics.size === 1) return 'Single topic focus';
  if (topics.size <= 3) return 'Good topic coherence';
  return 'Topic drift detected';
});

const recentDecisions = computed(() => {
  const decisions: any[] = [];
  
  sessionMessages.value.slice(-10).forEach(msg => {
    if (msg.role === 'assistant' && msg.metadata) {
      if (msg.metadata.stickyContext) {
        decisions.push({
          type: 'Sticky Context',
          details: `Continued with ${msg.metadata.agentName}`,
          confidence: msg.metadata.confidence,
          timestamp: msg.timestamp
        });
      } else if (msg.metadata.delegatedTo) {
        decisions.push({
          type: 'Delegation',
          details: `Delegated to ${msg.metadata.agentName}`,
          confidence: msg.metadata.confidence,
          timestamp: msg.timestamp
        });
      }
    }
  });
  
  return decisions.slice(-5).reverse();
});

// Methods
const toggleMinimized = () => {
  minimized.value = !minimized.value;
};

const close = () => {
  isVisible.value = false;
  emit('close');
};

const refreshData = () => {
  // Force reactivity update
  sessionStore.fetchMessagesForCurrentSession();
};

const getConfidenceClass = (confidence?: number) => {
  if (!confidence) return 'confidence-none';
  if (confidence >= 0.8) return 'confidence-high';
  if (confidence >= 0.6) return 'confidence-medium';
  return 'confidence-low';
};

const getContextStrengthClass = (strength: number) => {
  if (strength >= 80) return 'strength-high';
  if (strength >= 60) return 'strength-medium';
  return 'strength-low';
};

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatRelativeTime = (timestamp: string) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 600px;
  background: var(--ion-color-light);
  border: 2px solid var(--ion-color-primary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  border-radius: 6px 6px 0 0;
}

.debug-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.debug-controls {
  display: flex;
  gap: 4px;
}

.debug-content {
  padding: 12px;
  max-height: 540px;
  overflow-y: auto;
}

.debug-section {
  margin-bottom: 16px;
}

.debug-section h4 {
  margin: 0 0 8px 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-dark);
  border-bottom: 1px solid var(--ion-color-medium-tint);
  padding-bottom: 4px;
}

.debug-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  font-size: 0.8rem;
}

.label {
  font-weight: 500;
  color: var(--ion-color-medium-shade);
}

.value {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.delegation-flow {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-item {
  padding: 8px;
  border-radius: 4px;
  background: var(--ion-color-light-shade);
}

.flow-item.sticky {
  background: var(--ion-color-success-tint);
  border-left: 3px solid var(--ion-color-success);
}

.flow-node {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.agent-name {
  flex: 1;
  font-weight: 600;
}

.confidence {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
}

.confidence.confidence-high {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
}

.confidence.confidence-medium {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning-shade);
}

.confidence.confidence-low {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger-shade);
}

.flow-reason {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
  margin-top: 4px;
  font-style: italic;
}

.flow-arrow {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
  margin: 4px 0;
}

.agent-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-stat-item {
  padding: 8px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  font-size: 0.8rem;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.agent-header .agent-name {
  font-weight: 600;
}

.usage-count {
  background: var(--ion-color-primary-tint);
  color: var(--ion-color-primary-shade);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
}

.agent-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium-shade);
}

.metric-value {
  font-weight: 600;
  color: var(--ion-color-dark);
}

.context-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.context-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
}

.context-bar {
  height: 6px;
  background: var(--ion-color-light-shade);
  border-radius: 3px;
  overflow: hidden;
}

.context-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.context-fill.strength-high {
  background: var(--ion-color-success);
}

.context-fill.strength-medium {
  background: var(--ion-color-warning);
}

.context-fill.strength-low {
  background: var(--ion-color-danger);
}

.decision-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decision-item {
  padding: 6px 8px;
  background: var(--ion-color-light-shade);
  border-radius: 4px;
  font-size: 0.8rem;
}

.decision-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.decision-type {
  font-weight: 600;
  color: var(--ion-color-primary);
}

.decision-time {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.decision-details {
  color: var(--ion-color-dark);
  margin-bottom: 2px;
}

.decision-confidence {
  font-size: 0.75rem;
  color: var(--ion-color-medium-shade);
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .debug-panel {
    background: var(--ion-color-dark);
    border-color: var(--ion-color-primary);
  }
  
  .debug-item, .flow-item, .agent-stat-item, .decision-item, .context-item {
    background: var(--ion-color-dark-shade);
  }
  
  .context-bar {
    background: var(--ion-color-dark-tint);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .debug-panel {
    width: calc(100vw - 40px);
    max-width: 350px;
    bottom: 10px;
    right: 10px;
  }
  
  .debug-grid {
    grid-template-columns: 1fr;
  }
  
  .agent-metrics {
    grid-template-columns: 1fr;
  }
}
</style>