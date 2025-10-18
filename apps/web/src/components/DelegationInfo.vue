<template>
  <div v-if="showDelegationInfo" class="delegation-info">
    <div class="delegation-header" @click="toggleExpanded">
      <ion-icon :icon="chevronDownOutline" :class="{ 'expanded': isExpanded }" size="small"></ion-icon>
      <span class="delegation-text">{{ delegationSummary }}</span>
      <div class="confidence-indicator">
        <div class="confidence-bar">
          <div 
            class="confidence-fill" 
            :style="{ width: `${(confidence || 0) * 100}%` }"
            :class="confidenceClass"
          ></div>
        </div>
        <span class="confidence-text">{{ Math.round((confidence || 0) * 100) }}%</span>
      </div>
    </div>
    <div v-if="isExpanded" class="delegation-details">
      <div v-if="reason" class="detail-item">
        <ion-icon :icon="bulbOutline" size="small"></ion-icon>
        <span><strong>Reason:</strong> {{ reason }}</span>
      </div>
      <div v-if="agentContext" class="detail-item">
        <ion-icon :icon="layersOutline" size="small"></ion-icon>
        <span><strong>Context:</strong> {{ getContextDescription() }}</span>
      </div>
      <div v-if="delegationType" class="detail-item">
        <ion-icon :icon="swapHorizontalOutline" size="small"></ion-icon>
        <span><strong>Type:</strong> {{ getDelegationTypeDescription() }}</span>
      </div>
      <div v-if="agentSpecialization" class="detail-item">
        <ion-icon :icon="starOutline" size="small"></ion-icon>
        <span><strong>Specialization:</strong> {{ agentSpecialization }}</span>
      </div>
      <div v-if="continuityInfo" class="detail-item">
        <ion-icon :icon="linkOutline" size="small"></ion-icon>
        <span><strong>Continuity:</strong> {{ continuityInfo }}</span>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  chevronDownOutline,
  bulbOutline,
  layersOutline,
  swapHorizontalOutline,
  starOutline,
  linkOutline
} from 'ionicons/icons';
interface Props {
  agentName?: string;
  reason?: string;
  confidence?: number;
  stickyContext?: boolean;
  continuityReason?: string;
  agentContext?: Record<string, unknown>;
  delegationType?: 'new' | 'continuation' | 'handoff';
  agentSpecialization?: string;
}
const props = defineProps<Props>();
const isExpanded = ref(false);
const showDelegationInfo = computed(() => {
  // Show delegation info if we have an agent name and it's not the orchestrator
  if (!props.agentName || typeof props.agentName !== 'string') {
    return false;
  }
  const nameLower = props.agentName.toLowerCase();
  return nameLower !== 'orchestrator' &&
         nameLower !== 'orchestrator agent' &&
         (props.reason || props.stickyContext || props.confidence || props.agentName);
});
const delegationSummary = computed(() => {
  if (props.stickyContext) {
    return `Continued with ${props.agentName}`;
  }
  return `Delegated to ${props.agentName}`;
});
const confidence = computed(() => {
  return props.confidence || 0;
});
const confidenceClass = computed(() => {
  const conf = confidence.value;
  if (conf >= 0.8) return 'confidence-high';
  if (conf >= 0.6) return 'confidence-medium';
  return 'confidence-low';
});
const continuityInfo = computed(() => {
  if (props.stickyContext && props.continuityReason) {
    return props.continuityReason;
  }
  return null;
});
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};
const getContextDescription = () => {
  if (!props.agentContext) return 'No context available';
  const context = props.agentContext;
  if (context.contextStrength) {
    const strength = Math.round(context.contextStrength * 100);
    return `Context strength: ${strength}%`;
  }
  return 'Context available';
};
const getDelegationTypeDescription = () => {
  switch (props.delegationType) {
    case 'new':
      return 'New conversation with agent';
    case 'continuation':
      return 'Continuing previous conversation';
    case 'handoff':
      return 'Handoff from another agent';
    default:
      return 'Standard delegation';
  }
};
</script>
<style scoped>
.delegation-info {
  margin: 8px 0;
  border-left: 3px solid var(--ion-color-primary);
  background: var(--ion-color-light-tint);
  border-radius: 4px;
  overflow: hidden;
}
.delegation-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  gap: 8px;
  transition: background-color 0.2s ease;
}
.delegation-header:hover {
  background: var(--ion-color-light-shade);
}
.delegation-header ion-icon {
  transition: transform 0.2s ease;
  color: var(--ion-color-medium);
}
.delegation-header ion-icon.expanded {
  transform: rotate(180deg);
}
.delegation-text {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ion-color-dark);
}
.confidence-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}
.confidence-bar {
  width: 40px;
  height: 4px;
  background: var(--ion-color-light);
  border-radius: 2px;
  overflow: hidden;
}
.confidence-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 2px;
}
.confidence-fill.confidence-high {
  background: var(--ion-color-success);
}
.confidence-fill.confidence-medium {
  background: var(--ion-color-warning);
}
.confidence-fill.confidence-low {
  background: var(--ion-color-danger);
}
.confidence-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ion-color-medium);
  min-width: 32px;
}
.delegation-details {
  padding: 12px;
  background: var(--ion-color-light);
  border-top: 1px solid var(--ion-color-light-shade);
}
.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.8rem;
  line-height: 1.4;
}
.detail-item:last-child {
  margin-bottom: 0;
}
.detail-item ion-icon {
  color: var(--ion-color-primary);
  margin-top: 2px;
  flex-shrink: 0;
}
.detail-item span {
  color: var(--ion-color-dark);
}
/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .delegation-info {
    background: var(--ion-color-dark-tint);
  }
  .delegation-header:hover {
    background: var(--ion-color-dark-shade);
  }
  .delegation-details {
    background: var(--ion-color-dark);
    border-top-color: var(--ion-color-dark-shade);
  }
  .confidence-bar {
    background: var(--ion-color-dark-shade);
  }
}
/* Responsive adjustments */
@media (max-width: 768px) {
  .delegation-header {
    padding: 6px 10px;
  }
  .delegation-details {
    padding: 10px;
  }
  .confidence-text {
    display: none; /* Hide percentage text on mobile */
  }
  .confidence-bar {
    width: 30px;
  }
}
</style>