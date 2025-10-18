<template>
  <div class="privacy-indicators">
    <!-- Data Protection Badge -->
    <div 
      v-if="showDataProtection" 
      class="privacy-badge data-protection"
      :class="{ 'active': isDataProtected }"
    >
      <ion-icon :icon="shieldCheckmarkOutline" />
      <span class="badge-text">{{ isDataProtected ? 'Data Protected' : 'Processing...' }}</span>
    </div>

    <!-- Sanitization Status -->
    <div 
      v-if="showSanitizationStatus && (sanitizationStatus === 'completed' || sanitizationStatus === 'blocked')" 
      class="privacy-badge sanitization-status"
      :class="sanitizationStatusClass"
    >
      <ion-icon :icon="sanitizationIcon" />
      <span class="badge-text">{{ sanitizationStatusText }}</span>
    </div>

    <!-- Flagged Items Badge -->
    <div 
      v-if="flaggedCount > 0" 
      class="privacy-badge pii-flagger"
    >
      <ion-icon :icon="flagOutline" />
      <span class="badge-text">{{ flaggedCount }} Flagged Item{{ flaggedCount > 1 ? 's' : '' }}</span>
    </div>

    <!-- Pseudonymized Items Badge -->
    <div 
      v-if="pseudonymizedCount > 0" 
      class="privacy-badge pii-pseudonymizer"
    >
      <ion-icon :icon="swapHorizontalOutline" />
      <span class="badge-text">{{ pseudonymizedCount }} Pseudonym{{ pseudonymizedCount > 1 ? 's' : '' }}</span>
    </div>

    <!-- Routing Display -->
    <div 
      v-if="showRoutingDisplay" 
      class="privacy-badge routing-display"
      :class="routingClass"
    >
      <ion-icon :icon="routingIcon" />
      <span class="badge-text">{{ routingText }}</span>
    </div>

    <!-- Trust Signal -->
    <div 
      v-if="showTrustSignal" 
      class="privacy-badge trust-signal"
      :class="trustSignalClass"
    >
      <ion-icon :icon="trustIcon" />
      <span class="badge-text">{{ trustSignalText }}</span>
      <div class="trust-score" v-if="trustScore !== null">{{ trustScore }}%</div>
    </div>

    <!-- Processing Time -->
    <div 
      v-if="showProcessingTime && processingTimeMs > 0" 
      class="privacy-badge processing-time"
    >
      <ion-icon :icon="timeOutline" />
      <span class="badge-text">{{ formattedProcessingTime }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  shieldCheckmarkOutline,
  shieldOutline,
  cloudOutline,
  serverOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  warningOutline,
  timeOutline,
  lockClosedOutline,
  globeOutline,
  stopCircleOutline,
  swapHorizontalOutline,
  flagOutline
} from 'ionicons/icons';

// Props interface
export interface PrivacyIndicatorProps {
  // Data protection
  showDataProtection?: boolean;
  isDataProtected?: boolean;
  
  // Sanitization status
  showSanitizationStatus?: boolean;
  sanitizationStatus?: 'none' | 'processing' | 'completed' | 'failed' | 'blocked' | 'flagged';
  flaggedCount?: number;
  pseudonymizedCount?: number;
  piiDetectionCount?: number;
  piiSeverityTypes?: string[]; // Array of PII types detected (e.g., ['email', 'phone'])
  piiSeverityLevels?: string[]; // Array of severity levels (e.g., ['pseudonymizer', 'flagger'])
  
  // Routing information
  showRoutingDisplay?: boolean;
  routingMode?: 'local' | 'external' | 'hybrid';
  
  // Trust signals
  showTrustSignal?: boolean;
  trustLevel?: 'high' | 'medium' | 'low';
  trustScore?: number | null;
  
  // Additional metrics
  showPiiCount?: boolean;
  showProcessingTime?: boolean;
  processingTimeMs?: number;
  
  // Compact mode for space-constrained areas
  compact?: boolean;
}

const props = withDefaults(defineProps<PrivacyIndicatorProps>(), {
  showDataProtection: true,
  isDataProtected: false,
  showSanitizationStatus: true,
  sanitizationStatus: 'none',
  flaggedCount: 0,
  pseudonymizedCount: 0,
  piiDetectionCount: 0,
  piiSeverityTypes: () => [],
  piiSeverityLevels: () => [],
  showRoutingDisplay: true,
  routingMode: 'local',
  showTrustSignal: true,
  trustLevel: 'medium',
  trustScore: null,
  showPiiCount: true,
  showProcessingTime: false,
  processingTimeMs: 0,
  compact: false
});

// Computed properties for sanitization status
const sanitizationStatusClass = computed(() => ({
  'status-none': props.sanitizationStatus === 'none',
  'status-processing': props.sanitizationStatus === 'processing',
  'status-completed': props.sanitizationStatus === 'completed',
  'status-failed': props.sanitizationStatus === 'failed',
  'status-blocked': props.sanitizationStatus === 'blocked',
  'status-flagged': props.sanitizationStatus === 'flagged',
}));

const sanitizationIcon = computed(() => {
  switch (props.sanitizationStatus) {
    case 'completed': return checkmarkCircleOutline;
    case 'processing': return alertCircleOutline;
    case 'failed': return warningOutline;
    case 'blocked': return stopCircleOutline;
    case 'flagged': return flagOutline;
    default: return shieldOutline;
  }
});

const sanitizationStatusText = computed(() => {
  const count = props.piiDetectionCount;
  switch (props.sanitizationStatus) {
    case 'completed': return 'Sanitized';
    case 'processing': return 'Sanitizing...';
    case 'failed': return 'Sanitization Failed';
    case 'blocked': return 'Blocked';
    case 'flagged': return `${count} Flagged Item${count > 1 ? 's' : ''}`;
    default: return ''; // Return empty for 'none' to hide the badge
  }
});

// Computed properties for routing display
const routingClass = computed(() => ({
  'routing-local': props.routingMode === 'local',
  'routing-external': props.routingMode === 'external',
  'routing-hybrid': props.routingMode === 'hybrid'
}));

const routingIcon = computed(() => {
  switch (props.routingMode) {
    case 'local': return serverOutline;
    case 'external': return globeOutline;
    case 'hybrid': return cloudOutline;
    default: return serverOutline;
  }
});

const routingText = computed(() => {
  switch (props.routingMode) {
    case 'local': return 'Local Processing';
    case 'external': return 'External API';
    case 'hybrid': return 'Hybrid Processing';
    default: return 'Unknown Routing';
  }
});

// Computed properties for trust signal
const trustSignalClass = computed(() => ({
  'trust-high': props.trustLevel === 'high',
  'trust-medium': props.trustLevel === 'medium',
  'trust-low': props.trustLevel === 'low'
}));

const trustIcon = computed(() => {
  switch (props.trustLevel) {
    case 'high': return lockClosedOutline;
    case 'medium': return shieldOutline;
    case 'low': return warningOutline;
    default: return shieldOutline;
  }
});

const trustSignalText = computed(() => {
  switch (props.trustLevel) {
    case 'high': return 'High Trust';
    case 'medium': return 'Medium Trust';
    case 'low': return 'Low Trust';
    default: return 'Trust Level';
  }
});

// Formatted processing time
const formattedProcessingTime = computed(() => {
  if (props.processingTimeMs < 1000) {
    return `${props.processingTimeMs}ms`;
  } else {
    return `${(props.processingTimeMs / 1000).toFixed(1)}s`;
  }
});

// PII Severity computed properties
// const highestPiiSeverity = computed(() => {
//   if (!props.piiSeverityLevels || props.piiSeverityLevels.length === 0) {
//     return 'none';
//   }
//   
//   // Priority order: showstopper > pseudonymizer > flagger
//   if (props.piiSeverityLevels.includes('showstopper')) return 'showstopper';
//   if (props.piiSeverityLevels.includes('pseudonymizer')) return 'pseudonymizer';
//   if (props.piiSeverityLevels.includes('flagger')) return 'flagger';
//   return 'unknown';
// });

// const piiSeverityClass = computed(() => ({
//   'pii-showstopper': highestPiiSeverity.value === 'showstopper',
//   'pii-pseudonymizer': highestPiiSeverity.value === 'pseudonymizer',
//   'pii-flagger': highestPiiSeverity.value === 'flagger',
//   'pii-unknown': highestPiiSeverity.value === 'unknown'
// }));

// const piiSeverityIcon = computed(() => {
//   switch (highestPiiSeverity.value) {
//     case 'showstopper': return stopCircleOutline;
//     case 'pseudonymizer': return swapHorizontalOutline;
//     case 'flagger': return flagOutline;
//     default: return eyeOffOutline;
//   }
// });

// const piiDetectionText = computed(() => {
//   const count = props.piiDetectionCount || 0;
//   const types = props.piiSeverityTypes || [];
//   const severity = highestPiiSeverity.value;
//   
//   if (count === 0) return 'No PII';
//   
//   let text = `${count} PII item${count > 1 ? 's' : ''}`;
//   
//   // Add severity indicator
//   switch (severity) {
//     case 'showstopper':
//       text += ' (Blocked)';
//       break;
//     case 'pseudonymizer':
//       text += ' (Sanitized)';
//       break;
//     case 'flagger':
//       text += ' (Flagged)';
//       break;
//   }
//   
//   // Add types if available and not too many
//   if (types.length > 0 && types.length <= 2) {
//     const typeNames = types.map(type => {
//       switch (type) {
//         case 'ssn': return 'SSN';
//         case 'creditCard': return 'Card';
//         case 'email': return 'Email';
//         case 'phone': return 'Phone';
//         case 'ipAddress': return 'IP';
//         default: return type;
//       }
//     });
//     text += ` (${typeNames.join(', ')})`;
//   }
//   
//   return text;
// });
</script>

<style scoped>
.privacy-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin: 4px 0;
}

.privacy-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  background: var(--ion-color-light-tint);
  color: var(--ion-color-dark);
  min-height: 1.5rem;
}

.privacy-badge ion-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.badge-text {
  white-space: nowrap;
  font-size: 0.85em;
}

/* Data Protection Badge */
.data-protection {
  background: var(--ion-color-light-shade);
  color: var(--ion-color-medium-shade);
  border-color: var(--ion-color-light-shade);
}

.data-protection.active {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
  border-color: var(--ion-color-success);
}

.data-protection.active ion-icon {
  color: var(--ion-color-success);
}

/* Sanitization Status Badge */
.sanitization-status.status-none {
  background: var(--ion-color-light-shade);
  color: var(--ion-color-medium-shade);
}

.sanitization-status.status-processing {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning-shade);
  border-color: var(--ion-color-warning);
}

.sanitization-status.status-processing ion-icon {
  color: var(--ion-color-warning);
  animation: pulse 2s infinite;
}

.sanitization-status.status-completed {
  background: var(--ion-color-success-tint);
  color: var(--ion-color-success-shade);
  border-color: var(--ion-color-success);
}

.sanitization-status.status-completed ion-icon {
  color: var(--ion-color-success);
}

.sanitization-status.status-failed {
  background: var(--ion-color-danger-tint);
  color: var(--ion-color-danger-shade);
  border-color: var(--ion-color-danger);
}

.sanitization-status.status-failed ion-icon {
  color: var(--ion-color-danger);
}

/* Routing Display Badge */
.routing-display.routing-local {
  background: var(--ion-color-tertiary-tint);
  color: white; /* White text for excellent contrast on purple background */
  border-color: var(--ion-color-tertiary);
  font-weight: 600; /* Make text bolder */
}

.routing-display.routing-local ion-icon {
  color: white; /* White icon for excellent contrast */
}

.routing-display.routing-external {
  background: var(--ion-color-primary-tint);
  color: white; /* White text for better contrast on blue background */
  border-color: var(--ion-color-primary);
  font-weight: 600; /* Make text bolder */
}

.routing-display.routing-external ion-icon {
  color: white; /* White icon for better contrast */
}

.routing-display.routing-hybrid {
  background: var(--ion-color-secondary-tint);
  color: white; /* White text for better contrast on secondary background */
  border-color: var(--ion-color-secondary);
  font-weight: 600; /* Make text bolder */
}

.routing-display.routing-hybrid ion-icon {
  color: white; /* White icon for better contrast */
}

/* Trust Signal Badge */
.trust-signal {
  position: relative;
}

.trust-signal.trust-high {
  background: var(--ion-color-success-tint);
  color: #0f5132; /* Dark green for excellent contrast on light green background */
  border-color: var(--ion-color-success);
  font-weight: 600; /* Make text bolder */
}

.trust-signal.trust-high ion-icon {
  color: #0f5132; /* Dark green for excellent contrast */
}

.trust-signal.trust-medium {
  background: var(--ion-color-warning-tint);
  color: #92400e; /* Dark orange/brown for better contrast on yellow background */
  border-color: var(--ion-color-warning);
  font-weight: 600; /* Make text bolder */
}

.trust-signal.trust-medium ion-icon {
  color: #92400e; /* Dark orange/brown for better contrast */
}

.trust-signal.trust-low {
  background: var(--ion-color-danger-tint);
  color: white; /* White text for excellent contrast on red background */
  border-color: var(--ion-color-danger);
  font-weight: 600; /* Make text bolder */
}

.trust-signal.trust-low ion-icon {
  color: white; /* White icon for excellent contrast */
}

.trust-score {
  font-size: 0.7em;
  font-weight: 600;
  margin-left: 2px;
}

/* PII Detection Badge */
.pii-detection {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning-shade);
  border-color: var(--ion-color-warning);
}

.pii-detection ion-icon {
  color: var(--ion-color-warning);
}

/* PII Severity-specific styles */
.pii-detection.pii-showstopper {
  background: var(--ion-color-danger-tint);
  color: white;
  border-color: var(--ion-color-danger);
  font-weight: 600;
}

.pii-detection.pii-showstopper ion-icon {
  color: white;
}

.pii-detection.pii-pseudonymizer {
  background: var(--ion-color-primary-tint);
  color: white;
  border-color: var(--ion-color-primary);
  font-weight: 600;
}

.pii-detection.pii-pseudonymizer ion-icon {
  color: white;
}

.pii-detection.pii-flagger {
  background: var(--ion-color-warning-tint);
  color: var(--ion-color-warning-shade);
  border-color: var(--ion-color-warning);
  font-weight: 600;
}

.pii-detection.pii-flagger ion-icon {
  color: var(--ion-color-warning);
}

.pii-detection.pii-unknown {
  background: var(--ion-color-medium-tint);
  color: var(--ion-color-medium-shade);
  border-color: var(--ion-color-medium);
}

/* Processing Time Badge */
.processing-time {
  background: var(--ion-color-medium-tint);
  color: var(--ion-color-medium-shade);
  border-color: var(--ion-color-medium);
}

.processing-time ion-icon {
  color: var(--ion-color-medium);
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Compact mode */
.privacy-indicators.compact .privacy-badge {
  padding: 2px 6px;
  font-size: 0.7em;
  min-height: 1.25rem;
}

.privacy-indicators.compact .privacy-badge ion-icon {
  font-size: 12px;
}

.privacy-indicators.compact .badge-text {
  font-size: 0.8em;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .privacy-badge {
    background: var(--ion-color-dark-tint);
    color: var(--ion-color-light);
  }
  
  .data-protection {
    background: var(--ion-color-dark-shade);
    color: var(--ion-color-medium);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .privacy-indicators {
    gap: 4px;
  }
  
  .privacy-badge {
    padding: 3px 6px;
    font-size: 0.7em;
  }
  
  .privacy-badge ion-icon {
    font-size: 12px;
  }
  
  .badge-text {
    font-size: 0.8em;
  }
}
</style>
