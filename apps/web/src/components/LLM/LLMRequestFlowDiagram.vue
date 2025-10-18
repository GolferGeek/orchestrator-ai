<template>
  <div class="llm-request-flow-diagram">
    <div class="diagram-header">
      <h3>LLM Request Lifecycle</h3>
      <div class="header-controls">
        <!-- Live Data Controls -->
        <div v-if="liveMode" class="live-data-controls">
          <div class="live-indicator">
            <div class="live-dot" :class="{ 'active': !isLoadingLiveData }"></div>
            <span class="live-text">Live Data</span>
          </div>
          
          <!-- Request Selector -->
          <select 
            v-if="recentRequests.length > 0" 
            v-model="selectedRequestId"
            @change="selectRequest(selectedRequestId!)"
            class="request-selector"
          >
            <option 
              v-for="request in recentRequests" 
              :key="request.id"
              :value="request.id"
            >
              {{ new Date(request.createdAt || request.timestamp).toLocaleTimeString() }} - 
              {{ request.provider }} {{ request.model }}
            </option>
          </select>
          
          <ion-button 
            fill="clear" 
            size="small" 
            @click="fetchLiveData"
            :disabled="isLoadingLiveData"
          >
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Refresh
          </ion-button>
        </div>
        
        <!-- Animation Controls -->
        <div class="diagram-controls">
          <ion-button 
            fill="clear" 
            size="small" 
            @click="startFlow"
            :disabled="isPlaying"
          >
            <ion-icon :icon="playOutline" slot="start"></ion-icon>
            Start
          </ion-button>
          <ion-button 
            fill="clear" 
            size="small" 
            @click="pauseFlow"
            :disabled="!isPlaying"
          >
            <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
            Pause
          </ion-button>
          <ion-button 
            fill="clear" 
            size="small" 
            @click="resetFlow"
          >
            <ion-icon :icon="refreshOutline" slot="start"></ion-icon>
            Reset
          </ion-button>
          <ion-button 
            fill="clear" 
            size="small" 
            @click="stepForward"
            :disabled="isPlaying || currentStep >= flowSteps.length - 1"
          >
            <ion-icon :icon="playSkipForwardOutline" slot="start"></ion-icon>
            Step
          </ion-button>
        </div>
      </div>
    </div>

    <ion-grid>
      <ion-row>
        <ion-col size="12" size-lg="8">
          <!-- SVG Flow Diagram -->
          <div class="flow-svg-container">
        <svg 
          ref="flowSvg"
          :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
          class="flow-svg"
        >
          <!-- Flow Steps (Nodes) -->
          <g class="flow-nodes">
            <g 
              v-for="(step, index) in flowSteps" 
              :key="step.id"
              :class="['flow-node', getNodeClass(index)]"
              :transform="`translate(${step.x}, ${step.y})`"
            >
              <!-- Node Background -->
              <rect
                :width="nodeWidth"
                :height="nodeHeight"
                :rx="8"
                :ry="8"
                :class="['node-background', step.category]"
              />
              
              <!-- Node Icon -->
              <circle
                :cx="nodeWidth / 2"
                :cy="25"
                r="12"
                :class="['node-icon-bg', step.category]"
              />
              <text
                :x="nodeWidth / 2"
                y="30"
                text-anchor="middle"
                :class="['node-icon', step.category]"
                font-size="12"
              >
                {{ step.icon }}
              </text>
              
              <!-- Node Title -->
              <text
                :x="nodeWidth / 2"
                y="55"
                text-anchor="middle"
                class="node-title"
                font-size="12"
                font-weight="bold"
              >
                {{ step.title }}
              </text>
              
              <!-- Node Subtitle -->
              <text
                :x="nodeWidth / 2"
                y="70"
                text-anchor="middle"
                class="node-subtitle"
                font-size="10"
              >
                {{ step.subtitle }}
              </text>
              
              <!-- Timing Badge -->
              <rect
                v-if="step.timing && currentStep >= index"
                :x="nodeWidth - 35"
                y="5"
                width="30"
                height="15"
                rx="7"
                class="timing-badge"
              />
              <text
                v-if="step.timing && currentStep >= index"
                :x="nodeWidth - 20"
                y="15"
                text-anchor="middle"
                class="timing-text"
                font-size="8"
              >
                {{ step.timing }}ms
              </text>
            </g>
          </g>

          <!-- Flow Connections (Edges) -->
          <g class="flow-edges">
            <g 
              v-for="(connection, index) in flowConnections" 
              :key="`edge-${index}`"
              :class="['flow-edge', getEdgeClass(index)]"
            >
              <!-- Main Connection Line -->
              <path
                :d="connection.path"
                class="edge-path"
                :class="{ 'active': currentStep > index }"
              />
              
              <!-- Arrow Head -->
              <polygon
                :points="connection.arrowPoints"
                class="edge-arrow"
                :class="{ 'active': currentStep > index }"
              />
              
              <!-- Connection Label -->
              <text
                v-if="connection.label"
                :x="connection.labelX"
                :y="connection.labelY"
                text-anchor="middle"
                class="edge-label"
                font-size="9"
              >
                {{ connection.label }}
              </text>
            </g>
          </g>

          <!-- Decision Points -->
          <g class="decision-points">
            <g 
              v-for="decision in decisionPoints" 
              :key="decision.id"
              :class="['decision-point', { 'active': currentStep >= decision.stepIndex }]"
              :transform="`translate(${decision.x}, ${decision.y})`"
            >
              <polygon
                points="0,-15 15,0 0,15 -15,0"
                class="decision-diamond"
              />
              <text
                x="0"
                y="3"
                text-anchor="middle"
                class="decision-text"
                font-size="8"
              >
                {{ decision.label }}
              </text>
            </g>
          </g>

          <!-- Provider Indicators -->
          <g class="provider-indicators">
            <g 
              v-for="provider in providerIndicators" 
              :key="provider.id"
              :class="['provider-indicator', { 'active': currentStep >= provider.stepIndex }]"
              :transform="`translate(${provider.x}, ${provider.y})`"
            >
              <rect
                width="80"
                height="25"
                rx="12"
                class="provider-badge"
                :class="provider.type"
              />
              <text
                x="40"
                y="16"
                text-anchor="middle"
                class="provider-text"
                font-size="10"
              >
                {{ provider.name }}
              </text>
            </g>
          </g>
        </svg>
          </div>
        </ion-col>
        <ion-col size="12" size-lg="4">
          <!-- Flow Details Panel -->
          <div class="flow-details">
        <div class="current-step-info">
          <h4>Current Step: {{ currentStepData?.title || 'Ready to Start' }}</h4>
          <p v-if="currentStepData?.description">{{ currentStepData.description }}</p>
          
          <!-- Step Metadata -->
          <div v-if="currentStepData?.metadata" class="step-metadata">
            <div class="metadata-grid">
              <div 
                v-for="(value, key) in currentStepData.metadata" 
                :key="key"
                class="metadata-item"
              >
                <span class="metadata-key">{{ formatMetadataKey(key) }}:</span>
                <span class="metadata-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Timing Breakdown -->
        <div v-if="timingData.length > 0" class="timing-breakdown">
          <h5>Timing Breakdown</h5>
          <div class="timing-chart">
            <div 
              v-for="timing in timingData" 
              :key="timing.step"
              class="timing-bar"
              :class="{ 'completed': timing.completed }"
            >
              <div class="timing-label">{{ timing.step }}</div>
              <div class="timing-bar-container">
                <div 
                  class="timing-bar-fill"
                  :style="{ width: `${timing.percentage}%` }"
                ></div>
                <span class="timing-value">{{ timing.duration }}ms</span>
              </div>
            </div>
          </div>
        </div>
          </div>
        </ion-col>
      </ion-row>
    </ion-grid>

    <!-- Progress Indicator -->
    <div class="flow-progress">
      <div class="progress-bar">
        <div 
          class="progress-fill"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
      <div class="progress-text">
        Step {{ currentStep + 1 }} of {{ flowSteps.length }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { 
  IonButton, 
  IonIcon 
} from '@ionic/vue';
import { 
  playOutline, 
  pauseOutline, 
  refreshOutline, 
  playSkipForwardOutline 
} from 'ionicons/icons';
import { useLlmUsageStore } from '@/stores/llmUsageStore';
import { llmUsageService } from '@/services/llmUsageService';

// Component Props
interface RequestData {
  id: string;
  provider: string;
  model: string;
  runMetadata?: {
    sanitizationTimeMs?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Props {
  requestData?: RequestData;
  autoStart?: boolean;
  animationSpeed?: number;
  liveMode?: boolean;
  requestId?: string;
  refreshInterval?: number;
}

const props = withDefaults(defineProps<Props>(), {
  requestData: undefined,
  autoStart: false,
  animationSpeed: 2000, // 2 seconds per step
  liveMode: false,
  requestId: undefined,
  refreshInterval: 5000, // 5 seconds
});

// Emits
const emit = defineEmits<{
  'request-selected': [requestId: string];
  'data-updated': [data: RequestData];
}>();

// Reactive State
const flowSvg = ref<SVGElement>();
const currentStep = ref(-1); // -1 means not started
const isPlaying = ref(false);
const animationTimer = ref<NodeJS.Timeout>();
const liveDataTimer = ref<NodeJS.Timeout>();

// Store integration
const llmUsageStore = useLlmUsageStore();

// Live Data State (using reactive computed from store)
const liveRequestData = ref<RequestData | null>(null);
const isLoadingLiveData = computed(() => llmUsageStore.loading);
const liveDataError = computed(() => llmUsageStore.error);
const recentRequests = computed(() => llmUsageStore.usageRecords.slice(0, 10)); // Last 10 requests
const selectedRequestId = ref<string | null>(null);

// SVG Dimensions
const svgWidth = ref(800);
const svgHeight = ref(500);
const nodeWidth = 120;
const nodeHeight = 80;

// Flow Steps Definition
const flowSteps = ref([
  {
    id: 'input',
    title: 'Input Reception',
    subtitle: 'User Message',
    category: 'input',
    icon: '📝',
    x: 50,
    y: 50,
    description: 'Receives user message and system prompt from the frontend',
    timing: null,
    metadata: {}
  },
  {
    id: 'sanitization',
    title: 'Data Sanitization',
    subtitle: 'PII Detection',
    category: 'processing',
    icon: '🛡️',
    x: 200,
    y: 50,
    description: 'Detects and sanitizes PII data using reversible sanitization',
    timing: null,
    metadata: {}
  },
  {
    id: 'routing',
    title: 'Routing Decision',
    subtitle: 'Provider Selection',
    category: 'decision',
    icon: '🎯',
    x: 350,
    y: 50,
    description: 'Analyzes complexity and selects optimal provider/model',
    timing: null,
    metadata: {}
  },
  {
    id: 'metadata',
    title: 'Metadata Tracking',
    subtitle: 'Analytics Start',
    category: 'tracking',
    icon: '📊',
    x: 500,
    y: 50,
    description: 'Initializes request tracking and analytics collection',
    timing: null,
    metadata: {}
  },
  {
    id: 'provider-config',
    title: 'Provider Config',
    subtitle: 'Settings Load',
    category: 'config',
    icon: '⚙️',
    x: 650,
    y: 50,
    description: 'Loads provider-specific configuration and settings',
    timing: null,
    metadata: {}
  },
  {
    id: 'llm-call',
    title: 'LLM Call',
    subtitle: 'API Request',
    category: 'external',
    icon: '🚀',
    x: 350,
    y: 200,
    description: 'Makes API call to selected LLM provider',
    timing: null,
    metadata: {}
  },
  {
    id: 'response-processing',
    title: 'Response Processing',
    subtitle: 'Data Handling',
    category: 'processing',
    icon: '⚡',
    x: 200,
    y: 350,
    description: 'Processes and validates LLM response',
    timing: null,
    metadata: {}
  },
  {
    id: 'reverse-sanitization',
    title: 'Reverse Sanitization',
    subtitle: 'PII Restoration',
    category: 'processing',
    icon: '🔄',
    x: 350,
    y: 350,
    description: 'Restores original PII data in response using reversal context',
    timing: null,
    metadata: {}
  },
  {
    id: 'final-response',
    title: 'Final Response',
    subtitle: 'User Delivery',
    category: 'output',
    icon: '✅',
    x: 500,
    y: 350,
    description: 'Returns processed response to user',
    timing: null,
    metadata: {}
  }
]);

// Flow Connections
const flowConnections = computed(() => [
  {
    path: `M ${flowSteps.value[0].x + nodeWidth} ${flowSteps.value[0].y + nodeHeight/2} 
           L ${flowSteps.value[1].x} ${flowSteps.value[1].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[1].x-5},${flowSteps.value[1].y + nodeHeight/2-3} ${flowSteps.value[1].x},${flowSteps.value[1].y + nodeHeight/2} ${flowSteps.value[1].x-5},${flowSteps.value[1].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[0].x + nodeWidth + flowSteps.value[1].x) / 2,
    labelY: flowSteps.value[0].y + nodeHeight/2 - 5,
    label: ''
  },
  {
    path: `M ${flowSteps.value[1].x + nodeWidth} ${flowSteps.value[1].y + nodeHeight/2} 
           L ${flowSteps.value[2].x} ${flowSteps.value[2].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[2].x-5},${flowSteps.value[2].y + nodeHeight/2-3} ${flowSteps.value[2].x},${flowSteps.value[2].y + nodeHeight/2} ${flowSteps.value[2].x-5},${flowSteps.value[2].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[1].x + nodeWidth + flowSteps.value[2].x) / 2,
    labelY: flowSteps.value[1].y + nodeHeight/2 - 5,
    label: ''
  },
  {
    path: `M ${flowSteps.value[2].x + nodeWidth} ${flowSteps.value[2].y + nodeHeight/2} 
           L ${flowSteps.value[3].x} ${flowSteps.value[3].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[3].x-5},${flowSteps.value[3].y + nodeHeight/2-3} ${flowSteps.value[3].x},${flowSteps.value[3].y + nodeHeight/2} ${flowSteps.value[3].x-5},${flowSteps.value[3].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[2].x + nodeWidth + flowSteps.value[3].x) / 2,
    labelY: flowSteps.value[2].y + nodeHeight/2 - 5,
    label: ''
  },
  {
    path: `M ${flowSteps.value[3].x + nodeWidth} ${flowSteps.value[3].y + nodeHeight/2} 
           L ${flowSteps.value[4].x} ${flowSteps.value[4].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[4].x-5},${flowSteps.value[4].y + nodeHeight/2-3} ${flowSteps.value[4].x},${flowSteps.value[4].y + nodeHeight/2} ${flowSteps.value[4].x-5},${flowSteps.value[4].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[3].x + nodeWidth + flowSteps.value[4].x) / 2,
    labelY: flowSteps.value[3].y + nodeHeight/2 - 5,
    label: ''
  },
  // Curved path from provider-config to llm-call
  {
    path: `M ${flowSteps.value[4].x + nodeWidth/2} ${flowSteps.value[4].y + nodeHeight} 
           Q ${flowSteps.value[4].x + nodeWidth/2} ${flowSteps.value[4].y + nodeHeight + 50}
             ${flowSteps.value[5].x + nodeWidth/2} ${flowSteps.value[5].y}`,
    arrowPoints: `${flowSteps.value[5].x + nodeWidth/2-3},${flowSteps.value[5].y-5} ${flowSteps.value[5].x + nodeWidth/2},${flowSteps.value[5].y} ${flowSteps.value[5].x + nodeWidth/2+3},${flowSteps.value[5].y-5}`,
    labelX: flowSteps.value[4].x + nodeWidth/2,
    labelY: flowSteps.value[4].y + nodeHeight + 25,
    label: ''
  },
  // From llm-call to response-processing
  {
    path: `M ${flowSteps.value[5].x} ${flowSteps.value[5].y + nodeHeight/2} 
           L ${flowSteps.value[6].x + nodeWidth} ${flowSteps.value[6].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[6].x + nodeWidth+5},${flowSteps.value[6].y + nodeHeight/2-3} ${flowSteps.value[6].x + nodeWidth},${flowSteps.value[6].y + nodeHeight/2} ${flowSteps.value[6].x + nodeWidth+5},${flowSteps.value[6].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[5].x + flowSteps.value[6].x + nodeWidth) / 2,
    labelY: flowSteps.value[5].y + nodeHeight/2 - 5,
    label: ''
  },
  {
    path: `M ${flowSteps.value[6].x + nodeWidth} ${flowSteps.value[6].y + nodeHeight/2} 
           L ${flowSteps.value[7].x} ${flowSteps.value[7].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[7].x-5},${flowSteps.value[7].y + nodeHeight/2-3} ${flowSteps.value[7].x},${flowSteps.value[7].y + nodeHeight/2} ${flowSteps.value[7].x-5},${flowSteps.value[7].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[6].x + nodeWidth + flowSteps.value[7].x) / 2,
    labelY: flowSteps.value[6].y + nodeHeight/2 - 5,
    label: ''
  },
  {
    path: `M ${flowSteps.value[7].x + nodeWidth} ${flowSteps.value[7].y + nodeHeight/2} 
           L ${flowSteps.value[8].x} ${flowSteps.value[8].y + nodeHeight/2}`,
    arrowPoints: `${flowSteps.value[8].x-5},${flowSteps.value[8].y + nodeHeight/2-3} ${flowSteps.value[8].x},${flowSteps.value[8].y + nodeHeight/2} ${flowSteps.value[8].x-5},${flowSteps.value[8].y + nodeHeight/2+3}`,
    labelX: (flowSteps.value[7].x + nodeWidth + flowSteps.value[8].x) / 2,
    labelY: flowSteps.value[7].y + nodeHeight/2 - 5,
    label: ''
  }
]);

// Decision Points
const decisionPoints = ref([
  {
    id: 'complexity-check',
    label: '?',
    x: 425,
    y: 120,
    stepIndex: 2
  }
]);

// Provider Indicators
const providerIndicators = ref([
  {
    id: 'selected-provider',
    name: 'No Provider Selected',
    type: 'unknown',
    x: 280,
    y: 280,
    stepIndex: 5
  }
]);

// Computed Properties
const currentStepData = computed(() => {
  if (currentStep.value >= 0 && currentStep.value < flowSteps.value.length) {
    return flowSteps.value[currentStep.value];
  }
  return null;
});

const progressPercentage = computed(() => {
  if (flowSteps.value.length === 0) return 0;
  return ((currentStep.value + 1) / flowSteps.value.length) * 100;
});

const timingData = ref<Array<{
  step: string;
  duration: number;
  percentage: number;
  completed: boolean;
}>>([]);

// Methods
const getNodeClass = (index: number) => {
  if (currentStep.value === index) return 'current';
  if (currentStep.value > index) return 'completed';
  return 'pending';
};

const getEdgeClass = (index: number) => {
  return currentStep.value > index ? 'completed' : 'pending';
};

const startFlow = () => {
  if (currentStep.value >= flowSteps.value.length - 1) {
    resetFlow();
  }
  isPlaying.value = true;
  playAnimation();
};

const pauseFlow = () => {
  isPlaying.value = false;
  if (animationTimer.value) {
    clearTimeout(animationTimer.value);
  }
};

const resetFlow = () => {
  pauseFlow();
  currentStep.value = -1;
  timingData.value = [];
  // Reset all step timings
  flowSteps.value.forEach(step => {
    step.timing = null;
    step.metadata = {};
  });
};

const stepForward = () => {
  if (currentStep.value < flowSteps.value.length - 1) {
    currentStep.value++;
    updateStepData();
  }
};

const playAnimation = () => {
  if (!isPlaying.value || currentStep.value >= flowSteps.value.length - 1) {
    isPlaying.value = false;
    return;
  }
  
  currentStep.value++;
  updateStepData();
  
  animationTimer.value = setTimeout(() => {
    playAnimation();
  }, props.animationSpeed);
};

const updateStepData = () => {
  const step = flowSteps.value[currentStep.value];
  if (!step) return;
  
  // Only update if we have real data from liveRequestData
  if (liveRequestData.value && liveRequestData.value.runMetadata) {
    const metadata = liveRequestData.value.runMetadata;
    
    // Use real timing data only
    switch (step.id) {
      case 'sanitization':
        if (metadata.sanitizationTimeMs) {
          step.timing = metadata.sanitizationTimeMs;
        }
        break;
      case 'routing':
        if (metadata.routingTimeMs) {
          step.timing = metadata.routingTimeMs;
        }
        break;
      case 'llm-call':
        if (metadata.llmResponseTimeMs || liveRequestData.value.responseTime) {
          step.timing = metadata.llmResponseTimeMs || liveRequestData.value.responseTime;
        }
        break;
    }
    
    // Add to timing breakdown only if we have real timing
    if (step.timing) {
      const existingIndex = timingData.value.findIndex(t => t.step === step.title);
      const timingEntry = {
        step: step.title,
        duration: step.timing,
        percentage: 0,
        completed: true
      };
      
      if (existingIndex >= 0) {
        timingData.value[existingIndex] = timingEntry;
      } else {
        timingData.value.push(timingEntry);
      }
      
      // Recalculate percentages
      const maxTiming = Math.max(...timingData.value.map(t => t.duration));
      timingData.value.forEach(item => {
        item.percentage = maxTiming > 0 ? (item.duration / maxTiming) * 100 : 0;
      });
    }
  }
};

const formatMetadataKey = (key: string) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

// Live Data Methods
const fetchLiveData = async () => {
  if (!props.liveMode) return;
  
  isLoadingLiveData.value = true;
  liveDataError.value = null;
  
  try {
    // Fetch recent LLM usage records
    const records = await llmUsageService.getUsageRecords({
      limit: 10,
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 24 hours
    });
    
    recentRequests.value = records || [];
    
    // If we have a specific request ID, fetch its details
    if (props.requestId) {
      selectedRequestId.value = props.requestId;
      const selectedRequest = records.find(r => r.id === props.requestId);
      if (selectedRequest) {
        liveRequestData.value = selectedRequest;
        updateFlowWithLiveData(selectedRequest);
      }
    } else if (records.length > 0) {
      // Use the most recent request
      const mostRecent = records[0];
      liveRequestData.value = mostRecent;
      selectedRequestId.value = mostRecent.id;
      updateFlowWithLiveData(mostRecent);
    }
    
    emit('data-updated', liveRequestData.value);
  } catch (error) {
    console.error('Error fetching live LLM data:', error);
    liveDataError.value = 'Failed to fetch live request data';
  } finally {
    isLoadingLiveData.value = false;
  }
};

const updateFlowWithLiveData = (requestData: RequestData) => {
  if (!requestData) return;
  
  // Update provider indicators
  if (requestData.provider && requestData.model) {
    providerIndicators.value[0] = {
      ...providerIndicators.value[0],
      name: `${requestData.provider} ${requestData.model}`,
      type: requestData.provider.toLowerCase() === 'ollama' ? 'local' : 'external'
    };
  }
  
  // Update flow steps with real timing data
  if (requestData.runMetadata) {
    const metadata = requestData.runMetadata;
    
    // Map metadata to flow steps
    const stepMappings = {
      'input': {
        timing: metadata.requestStartTime ? 5 : null,
        metadata: {
          'Input Length': `${requestData.inputTokens || 0} tokens`,
          'System Prompt': metadata.systemPromptLength ? `${metadata.systemPromptLength} chars` : 'N/A',
          'User Message': metadata.userMessageLength ? `${metadata.userMessageLength} chars` : 'N/A'
        }
      },
      'sanitization': {
        timing: metadata.sanitizationTimeMs || null,
        metadata: {
          'PII Detected': metadata.piiDetected ? `${metadata.piiDetected} items` : '0 items',
          'Sanitization Level': metadata.sanitizationLevel || 'None',
          'Patterns Found': metadata.piiTypes ? metadata.piiTypes.join(', ') : 'None'
        }
      },
      'routing': {
        timing: metadata.routingTimeMs || null,
        metadata: {
          'Complexity Score': metadata.complexityScore ? `${metadata.complexityScore}/10` : 'N/A',
          'Selected Provider': requestData.provider || 'Unknown',
          'Model': requestData.model || 'Unknown',
          'Reasoning': metadata.routingReason || 'Automatic selection'
        }
      },
      'llm-call': {
        timing: metadata.llmResponseTimeMs || requestData.responseTime || null,
        metadata: {
          'Provider': requestData.provider || 'Unknown',
          'Model': requestData.model || 'Unknown',
          'Input Tokens': `${requestData.inputTokens || 0}`,
          'Output Tokens': `${requestData.outputTokens || 0}`,
          'Total Cost': metadata.totalCost ? `$${metadata.totalCost.toFixed(4)}` : 'N/A'
        }
      }
    };
    
    // Update flow steps with real data
    flowSteps.value.forEach(step => {
      const mapping = stepMappings[step.id as keyof typeof stepMappings];
      if (mapping) {
        if (mapping.timing) step.timing = mapping.timing;
        if (mapping.metadata) step.metadata = { ...step.metadata, ...mapping.metadata };
      }
    });
  }
  
  // Update timing data for visualization
  updateTimingDataFromLive(requestData);
};

const updateTimingDataFromLive = (requestData: RequestData) => {
  if (!requestData.runMetadata) return;
  
  const metadata = requestData.runMetadata;
  const newTimingData = [];
  
  // Extract timing data from metadata
  if (metadata.sanitizationTimeMs) {
    newTimingData.push({
      step: 'Data Sanitization',
      duration: metadata.sanitizationTimeMs,
      percentage: 0,
      completed: true
    });
  }
  
  if (metadata.routingTimeMs) {
    newTimingData.push({
      step: 'Routing Decision',
      duration: metadata.routingTimeMs,
      percentage: 0,
      completed: true
    });
  }
  
  if (metadata.llmResponseTimeMs) {
    newTimingData.push({
      step: 'LLM Call',
      duration: metadata.llmResponseTimeMs,
      percentage: 0,
      completed: true
    });
  }
  
  // Calculate percentages
  const maxTiming = Math.max(...newTimingData.map(t => t.duration));
  newTimingData.forEach(item => {
    item.percentage = maxTiming > 0 ? (item.duration / maxTiming) * 100 : 0;
  });
  
  timingData.value = newTimingData;
};

const startLiveDataPolling = () => {
  if (!props.liveMode) return;
  
  fetchLiveData(); // Initial fetch
  
  liveDataTimer.value = setInterval(() => {
    fetchLiveData();
  }, props.refreshInterval);
};

const stopLiveDataPolling = () => {
  if (liveDataTimer.value) {
    clearInterval(liveDataTimer.value);
    liveDataTimer.value = undefined;
  }
};

const selectRequest = (requestId: string) => {
  selectedRequestId.value = requestId;
  const request = recentRequests.value.find(r => r.id === requestId);
  if (request) {
    liveRequestData.value = request;
    updateFlowWithLiveData(request);
    emit('request-selected', requestId);
  }
};

// Lifecycle
onMounted(async () => {
  // Initialize store data
  await llmUsageStore.fetchUsageRecords();
  
  if (props.liveMode) {
    startLiveDataPolling();
  }
  
  if (props.autoStart) {
    startFlow();
  }
});

onUnmounted(() => {
  pauseFlow();
  stopLiveDataPolling();
});

// Watch for prop changes
watch(() => props.liveMode, (newValue) => {
  if (newValue) {
    startLiveDataPolling();
  } else {
    stopLiveDataPolling();
  }
});

watch(() => props.requestId, (newRequestId) => {
  if (newRequestId && props.liveMode) {
    fetchLiveData();
  }
});

watch(() => props.requestData, (newData) => {
  if (newData && !props.liveMode) {
    updateFlowWithLiveData(newData);
  }
});
</script>

<style scoped>
.llm-request-flow-diagram {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.diagram-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 0.0625rem solid #e0e0e0;
}

.diagram-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.header-controls {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.live-data-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  border: 0.0625rem solid #e0e0e0;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.live-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #dc3545;
  animation: pulse 2s infinite;
}

.live-dot.active {
  background: #28a745;
  animation: none;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.live-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: #666;
}

.request-selector {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
  background: white;
  min-width: 200px;
}

.diagram-controls {
  display: flex;
  gap: 0.5rem;
}

/* Removed: Using Ionic grid instead */

.flow-svg-container {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  overflow: hidden;
}

.flow-svg {
  width: 100%;
  height: auto;
  max-height: 500px;
}

/* Node Styles */
.flow-node {
  cursor: pointer;
  transition: all 0.3s ease;
}

.flow-node.pending .node-background {
  fill: #f5f5f5;
  stroke: #ddd;
  stroke-width: 1;
}

.flow-node.current .node-background {
  fill: #e3f2fd;
  stroke: #2196f3;
  stroke-width: 2;
  filter: drop-shadow(0 2px 4px rgba(33, 150, 243, 0.3));
}

.flow-node.completed .node-background {
  fill: #e8f5e8;
  stroke: #4caf50;
  stroke-width: 1;
}

.node-background.input { fill: #fff3e0; stroke: #ff9800; }
.node-background.processing { fill: #e8f5e8; stroke: #4caf50; }
.node-background.decision { fill: #fff8e1; stroke: #ffc107; }
.node-background.tracking { fill: #f3e5f5; stroke: #9c27b0; }
.node-background.config { fill: #e0f2f1; stroke: #009688; }
.node-background.external { fill: #ffebee; stroke: #f44336; }
.node-background.output { fill: #e3f2fd; stroke: #2196f3; }

.node-icon-bg {
  fill: white;
  stroke: #ddd;
}

.node-icon {
  fill: #333;
  font-family: 'Segoe UI Emoji', sans-serif;
}

.node-title {
  fill: #333;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.node-subtitle {
  fill: #666;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

.timing-badge {
  fill: #333;
  opacity: 0.8;
}

.timing-text {
  fill: white;
  font-family: monospace;
}

/* Edge Styles */
.flow-edge {
  transition: all 0.3s ease;
}

.edge-path {
  fill: none;
  stroke: #ddd;
  stroke-width: 2;
  transition: all 0.3s ease;
}

.edge-path.active {
  stroke: #4caf50;
  stroke-width: 3;
}

.edge-arrow {
  fill: #ddd;
  transition: all 0.3s ease;
}

.edge-arrow.active {
  fill: #4caf50;
}

.edge-label {
  fill: #666;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Decision Points */
.decision-diamond {
  fill: #fff8e1;
  stroke: #ffc107;
  stroke-width: 2;
  transition: all 0.3s ease;
}

.decision-point.active .decision-diamond {
  fill: #fff3c4;
  filter: drop-shadow(0 2px 4px rgba(255, 193, 7, 0.3));
}

.decision-text {
  fill: #333;
  font-weight: bold;
}

/* Provider Indicators */
.provider-badge {
  fill: #f5f5f5;
  stroke: #ddd;
  stroke-width: 1;
}

.provider-badge.external {
  fill: #ffebee;
  stroke: #f44336;
}

.provider-badge.local {
  fill: #e8f5e8;
  stroke: #4caf50;
}

.provider-badge.unknown {
  fill: #f5f5f5;
  stroke: #999;
}

.provider-indicator.active .provider-badge {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.provider-text {
  fill: #333;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}

/* Flow Details */
.flow-details {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  height: fit-content;
}

.current-step-info h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.current-step-info p {
  margin: 0 0 1rem 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
}

.step-metadata {
  margin-top: 1rem;
}

.metadata-grid {
  display: grid;
  gap: 0.5rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  font-size: 0.85rem;
}

.metadata-key {
  font-weight: 600;
  color: #333;
}

.metadata-value {
  color: #666;
  font-family: monospace;
}

/* Timing Breakdown */
.timing-breakdown {
  margin-top: 2rem;
}

.timing-breakdown h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.timing-bar {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.timing-label {
  color: #666;
  font-weight: 500;
}

.timing-bar-container {
  position: relative;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
}

.timing-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #66bb6a);
  transition: width 0.3s ease;
  border-radius: 10px;
}

.timing-value {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: white;
  font-size: 0.7rem;
  font-family: monospace;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Progress Indicator */
.flow-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #42a5f5);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

/* Responsive Design */
@media (max-width: 1024px) {
  /* Responsive handled by Ionic grid */
  
  .diagram-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .diagram-controls {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .llm-request-flow-diagram {
    padding: 1rem;
  }
  
  .flow-svg {
    max-height: 400px;
  }
  
  .metadata-item {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .timing-bar {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
