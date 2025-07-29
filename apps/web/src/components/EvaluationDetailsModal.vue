<template>
  <ion-modal :is-open="isOpen" @willDismiss="onDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>Evaluation Details</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="onDismiss">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    
    <ion-content class="ion-padding" v-if="evaluation">
      <!-- Agent and Message Info -->
      <ion-card class="message-info">
        <ion-card-header>
          <ion-row>
            <ion-col size="8">
              <ion-card-subtitle>{{ evaluation.metadata?.agentName || 'Unknown Agent' }}</ion-card-subtitle>
              <ion-card-title>Task Details</ion-card-title>
            </ion-col>
            <ion-col size="4" class="ion-text-right">
              <ion-text color="medium">
                <small>{{ formatDate(evaluation.evaluationTimestamp || evaluation.timestamp) }}</small>
              </ion-text>
            </ion-col>
          </ion-row>
        </ion-card-header>
        
        <ion-card-content>
          <div class="message-content">
            <!-- Show task prompt if available -->
            <ion-text v-if="evaluation.metadata?.taskPrompt">
              <h4>Task Prompt:</h4>
              <p class="content-text">{{ evaluation.metadata.taskPrompt }}</p>
            </ion-text>
            
            <!-- Show task response if available -->
            <ion-text v-if="evaluation.metadata?.taskResponse">
              <h4>Task Response:</h4>
              <div v-if="parsedResponse">
                <p class="content-text response-text" v-if="parsedResponse.response">{{ parsedResponse.response }}</p>
                <div v-if="parsedResponse.email" class="email-section">
                  <h5>📧 Email Information:</h5>
                  <div class="email-content">
                    <!-- Handle email as a string -->
                    <div v-if="typeof parsedResponse.email === 'string'">
                      <p><strong>Email:</strong> {{ parsedResponse.email }}</p>
                    </div>
                    <!-- Handle email as an object -->
                    <div v-else>
                      <p v-if="parsedResponse.email.to"><strong>To:</strong> {{ parsedResponse.email.to }}</p>
                      <p v-if="parsedResponse.email.from"><strong>From:</strong> {{ parsedResponse.email.from }}</p>
                      <p v-if="parsedResponse.email.subject"><strong>Subject:</strong> {{ parsedResponse.email.subject }}</p>
                      <div v-if="parsedResponse.email.body">
                        <p><strong>Body:</strong></p>
                        <p class="email-body">{{ parsedResponse.email.body }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="parsedResponse.deliverable" class="deliverable-section">
                  <h5>📋 Deliverable:</h5>
                  <p class="content-text">{{ parsedResponse.deliverable }}</p>
                </div>
              </div>
              <p v-else class="content-text response-text">{{ evaluation.metadata.taskResponse }}</p>
            </ion-text>
            
            <!-- Fallback to general content if no specific prompt/response -->
            <ion-text v-if="!evaluation.metadata?.taskPrompt && !evaluation.metadata?.taskResponse">
              <h4>Task Content:</h4>
              <p class="content-text">{{ evaluation.content }}</p>
            </ion-text>
          </div>
          
          <!-- Technical Details -->
          <ion-grid class="technical-details">
            <ion-row v-if="evaluation.provider || evaluation.model || evaluation.metadata?.llmMetadata">
              <ion-col size="12">
                <ion-text color="medium">
                  <h5>Technical Details:</h5>
                </ion-text>
              </ion-col>
            </ion-row>
            <ion-row v-if="evaluation.provider || evaluation.providerId">
              <ion-col size="6">
                <ion-chip outline color="primary">
                  <ion-label>Provider: {{ evaluation.provider?.name || evaluation.providerId || 'Unknown' }}</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
            <ion-row v-if="evaluation.model || evaluation.modelId">
              <ion-col size="6">
                <ion-chip outline color="secondary">
                  <ion-label>Model: {{ evaluation.model?.name || evaluation.modelId || 'Unknown' }}</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
            <ion-row v-if="evaluation.responseTimeMs">
              <ion-col size="6">
                <ion-chip outline color="tertiary">
                  <ion-icon :icon="timerOutline"></ion-icon>
                  <ion-label>{{ evaluation.responseTimeMs }}ms</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
            <ion-row v-if="evaluation.cost">
              <ion-col size="6">
                <ion-chip outline color="warning">
                  <ion-icon :icon="cashOutline"></ion-icon>
                  <ion-label>${{ formatCost(evaluation.cost) }}</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
            
            <!-- Response Metadata Section -->
            <ion-row v-if="evaluation.metadata?.responseMetadata">
              <ion-col size="12">
                <ion-text color="medium">
                  <h5>📋 Response Metadata:</h5>
                </ion-text>
                <div class="metadata-section">
                  <pre class="metadata-display">{{ JSON.stringify(evaluation.metadata.responseMetadata, null, 2) }}</pre>
                </div>
              </ion-col>
            </ion-row>

            <!-- LLM Metadata if available -->
            <ion-row v-if="evaluation.metadata?.llmMetadata">
              <ion-col size="12">
                <ion-text color="medium">
                  <h5>🤖 LLM Details:</h5>
                </ion-text>
                <div class="llm-metadata">
                  <pre>{{ JSON.stringify(evaluation.metadata.llmMetadata, null, 2) }}</pre>
                </div>
              </ion-col>
            </ion-row>

            <!-- User Email if available -->
            <ion-row v-if="evaluation.userEmail">
              <ion-col size="12">
                <ion-chip outline color="tertiary">
                  <ion-icon :icon="mailOutline"></ion-icon>
                  <ion-label>{{ evaluation.userEmail }}</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
            
            <!-- Progress Message if available -->
            <ion-row v-if="evaluation.metadata?.progressMessage">
              <ion-col size="12">
                <ion-chip outline color="tertiary">
                  <ion-label>Status: {{ evaluation.metadata.progressMessage }}</ion-label>
                </ion-chip>
              </ion-col>
            </ion-row>
          </ion-grid>
          
          <!-- Workflow Steps if available -->
          <div v-if="evaluation.metadata?.workflowStepsCompleted && evaluation.metadata.workflowStepsCompleted.length > 0" class="workflow-steps">
            <ion-text color="medium">
              <h5>🔄 Workflow Steps Completed:</h5>
            </ion-text>
            <div class="steps-container">
              <ion-chip 
                v-for="(step, index) in evaluation.metadata.workflowStepsCompleted" 
                :key="step"
                outline 
                color="success"
                class="step-chip"
              >
                <ion-label>{{ index + 1 }}. {{ formatStepName(step) }}</ion-label>
              </ion-chip>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Evaluation Ratings -->
      <ion-card class="ratings-card">
        <ion-card-header>
          <ion-card-title>Your Evaluation</ion-card-title>
        </ion-card-header>
        
        <ion-card-content>
          <ion-grid>
            <!-- Overall Rating -->
            <ion-row v-if="evaluation.userRating">
              <ion-col size="12">
                <div class="rating-section">
                  <ion-text>
                    <h4>Overall Rating</h4>
                  </ion-text>
                  <div class="star-rating">
                    <ion-icon 
                      v-for="star in 5" 
                      :key="`overall-${star}`"
                      :icon="star <= evaluation.userRating ? starIcon : starOutline"
                      :color="star <= evaluation.userRating ? 'warning' : 'medium'"
                      size="large"
                    ></ion-icon>
                    <ion-text class="rating-text">
                      <strong>{{ evaluation.userRating }}/5</strong>
                    </ion-text>
                  </div>
                </div>
              </ion-col>
            </ion-row>

            <!-- Speed Rating -->
            <ion-row v-if="evaluation.speedRating">
              <ion-col size="12" size-md="6">
                <div class="rating-section">
                  <ion-text>
                    <h4>
                      <ion-icon :icon="timerOutline" color="primary"></ion-icon>
                      Speed Rating
                    </h4>
                  </ion-text>
                  <div class="star-rating">
                    <ion-icon 
                      v-for="star in 5" 
                      :key="`speed-${star}`"
                      :icon="star <= evaluation.speedRating ? starIcon : starOutline"
                      :color="star <= evaluation.speedRating ? 'primary' : 'medium'"
                    ></ion-icon>
                    <ion-text class="rating-text">
                      <strong>{{ evaluation.speedRating }}/5</strong>
                    </ion-text>
                  </div>
                </div>
              </ion-col>
            </ion-row>

            <!-- Accuracy Rating -->
            <ion-row v-if="evaluation.accuracyRating">
              <ion-col size="12" size-md="6">
                <div class="rating-section">
                  <ion-text>
                    <h4>
                      <ion-icon :icon="checkmarkCircleOutline" color="success"></ion-icon>
                      Accuracy Rating
                    </h4>
                  </ion-text>
                  <div class="star-rating">
                    <ion-icon 
                      v-for="star in 5" 
                      :key="`accuracy-${star}`"
                      :icon="star <= evaluation.accuracyRating ? starIcon : starOutline"
                      :color="star <= evaluation.accuracyRating ? 'success' : 'medium'"
                    ></ion-icon>
                    <ion-text class="rating-text">
                      <strong>{{ evaluation.accuracyRating }}/5</strong>
                    </ion-text>
                  </div>
                </div>
              </ion-col>
            </ion-row>
          </ion-grid>
        </ion-card-content>
      </ion-card>

      <!-- User Notes -->
      <ion-card v-if="evaluation.userNotes" class="notes-card">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="documentTextOutline" color="medium"></ion-icon>
            Your Notes
          </ion-card-title>
        </ion-card-header>
        
        <ion-card-content>
          <ion-text>
            <p class="notes-content">{{ evaluation.userNotes }}</p>
          </ion-text>
        </ion-card-content>
      </ion-card>

      <!-- Additional Details -->
      <ion-card v-if="evaluation.evaluationDetails" class="details-card">
        <ion-card-header>
          <ion-card-title>
            <ion-icon :icon="informationCircleOutline" color="tertiary"></ion-icon>
            Additional Details
          </ion-card-title>
        </ion-card-header>
        
        <ion-card-content>
          <div v-if="evaluation.evaluationDetails.tags && evaluation.evaluationDetails.tags.length > 0">
            <ion-text>
              <h5>Tags:</h5>
            </ion-text>
            <div class="tags-container">
              <ion-chip 
                v-for="tag in evaluation.evaluationDetails.tags" 
                :key="tag"
                outline
                color="tertiary"
              >
                <ion-label>{{ tag }}</ion-label>
              </ion-chip>
            </div>
          </div>
          
          <div v-if="evaluation.evaluationDetails.feedback">
            <ion-text>
              <h5>Additional Feedback:</h5>
              <p>{{ evaluation.evaluationDetails.feedback }}</p>
            </ion-text>
          </div>
          
          <div v-if="evaluation.evaluationDetails.userContext">
            <ion-text>
              <h5>Context:</h5>
              <p>{{ evaluation.evaluationDetails.userContext }}</p>
            </ion-text>
          </div>
          
          <div v-if="evaluation.evaluationDetails.modelConfidence">
            <ion-text>
              <h5>Model Confidence:</h5>
              <ion-progress-bar 
                :value="evaluation.evaluationDetails.modelConfidence"
                color="tertiary"
              ></ion-progress-bar>
              <p class="confidence-text">
                {{ Math.round(evaluation.evaluationDetails.modelConfidence * 100) }}%
              </p>
            </ion-text>
          </div>
        </ion-card-content>
      </ion-card>
    </ion-content>
    
    <!-- Loading State -->
    <ion-content v-else class="ion-padding ion-text-center">
      <ion-spinner name="crescent"></ion-spinner>
      <p>Loading evaluation details...</p>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonChip,
  IonLabel,
  IonSpinner,
  IonProgressBar
} from '@ionic/vue';
import {
  closeOutline,
  starOutline,
  star,
  timerOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  informationCircleOutline,
  cashOutline,
  mailOutline
} from 'ionicons/icons';
import type { EvaluationWithMessage } from '@/types/evaluation';

interface Props {
  isOpen: boolean;
  evaluation: EvaluationWithMessage | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  dismiss: [];
}>();

const starIcon = computed(() => star);

// Parse the task response JSON if it exists
const parsedResponse = computed(() => {
  // Debug: Log all evaluation data
  console.log('🔍 [Frontend] Full evaluation object:', props.evaluation);
  console.log('🔍 [Frontend] Evaluation metadata:', props.evaluation?.metadata);
  console.log('🔍 [Frontend] Provider/Model info:', {
    provider: props.evaluation?.provider,
    model: props.evaluation?.model,
    providerId: props.evaluation?.providerId,
    modelId: props.evaluation?.modelId
  });
  console.log('🔍 [Frontend] User email:', props.evaluation?.userEmail);
  console.log('🔍 [Frontend] Response metadata:', props.evaluation?.metadata?.responseMetadata);
  console.log('🔍 [Frontend] LLM metadata:', props.evaluation?.metadata?.llmMetadata);
  console.log('🔍 [Frontend] Has taskResponse:', !!props.evaluation?.metadata?.taskResponse);
  console.log('🔍 [Frontend] Has taskPrompt:', !!props.evaluation?.metadata?.taskPrompt);
  console.log('🔍 [Frontend] Has workflowStepsCompleted:', !!props.evaluation?.metadata?.workflowStepsCompleted);
  console.log('🔍 [Frontend] Raw taskResponse:', props.evaluation?.metadata?.taskResponse);
  
  if (!props.evaluation?.metadata?.taskResponse) {
    console.log('🔍 [Frontend] No taskResponse found, returning null');
    return null;
  }
  
  try {
    const response = JSON.parse(props.evaluation.metadata.taskResponse);
    console.log('🔍 [Frontend] Parsed task response:', response);
    
    // Extract key fields from the response
    const result: any = {};
    
    // Helper function to recursively look for email data
    const findEmailData = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return null;
      
      // Direct email field
      if (obj.email) return obj.email;
      
      // Look in nested objects
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          const nestedEmail = findEmailData(obj[key]);
          if (nestedEmail) return nestedEmail;
        }
      }
      return null;
    };
    
    // Helper function to extract response text from various structures
    const extractResponseText = (obj: any): string | null => {
      // Try different fields that might contain the actual response
      if (typeof obj.response === 'string') return obj.response;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.message === 'string') return obj.message;
      
      // If response field contains another JSON, try to parse it
      if (typeof obj.response === 'object') {
        try {
          if (obj.response.content) return obj.response.content;
          if (obj.response.text) return obj.response.text;
          if (obj.response.message) return obj.response.message;
        } catch (e) {
          console.log('Error parsing nested response:', e);
        }
      }
      
      return null;
    };
    
    // Extract response content
    const responseText = extractResponseText(response);
    if (responseText) {
      result.response = responseText;
      
      // Try to parse the response text itself as JSON to look for email
      try {
        const nestedResponse = JSON.parse(responseText);
        const emailFromNested = findEmailData(nestedResponse);
        if (emailFromNested) {
          result.email = emailFromNested;
        }
      } catch (e) {
        // Response text is not JSON, that's fine
      }
    }
    
    // Look for email at the top level
    const topLevelEmail = findEmailData(response);
    if (topLevelEmail) {
      result.email = topLevelEmail;
    }
    
    // Look for deliverable
    if (response.deliverable) {
      result.deliverable = response.deliverable;
    }
    
    console.log('Extracted result:', result);
    
    // Return null if no meaningful content found
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    // If JSON parsing fails, return null to fall back to raw text
    console.log('Failed to parse task response JSON:', error);
    return null;
  }
});

function onDismiss() {
  emit('dismiss');
}

function formatDate(dateString: string): string {
  if (!dateString) return 'No date available';
  
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function formatCost(cost: number): string {
  return cost.toFixed(4);
}

const formatStepName = (stepName: string): string => {
  console.log('🔍 [Frontend] Formatting step name:', stepName);
  // Convert snake_case to human readable format
  return stepName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Debug computed property for workflow steps
const debugWorkflowSteps = computed(() => {
  console.log('🔍 [Frontend] Workflow steps debug:', {
    hasMetadata: !!props.evaluation?.metadata,
    hasWorkflowSteps: !!props.evaluation?.metadata?.workflowStepsCompleted,
    workflowStepsType: typeof props.evaluation?.metadata?.workflowStepsCompleted,
    workflowStepsLength: props.evaluation?.metadata?.workflowStepsCompleted?.length,
    workflowStepsData: props.evaluation?.metadata?.workflowStepsCompleted
  });
  return props.evaluation?.metadata?.workflowStepsCompleted;
});
</script>

<style scoped>
.message-info {
  margin-bottom: 1rem;
}

.content-text {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
  margin: 0.5rem 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.response-text {
  background: var(--ion-color-light-tint);
  border-left: 4px solid var(--ion-color-success);
}

.email-section {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-warning);
}

.email-content {
  margin-top: 0.5rem;
}

.email-content p {
  margin: 0.25rem 0;
}

.email-body {
  background: var(--ion-color-light-tint);
  padding: 0.75rem;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: monospace;
  margin-top: 0.5rem;
}

.deliverable-section {
  margin: 1rem 0;
}

.metadata-section {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
  margin: 0.5rem 0;
}

.metadata-display {
  margin: 0;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: var(--ion-color-light-tint);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--ion-color-light-shade);
}

.llm-metadata {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-tertiary);
  margin: 0.5rem 0;
}

.llm-metadata pre {
  margin: 0;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.workflow-steps {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-success);
}

.steps-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.step-chip {
  margin: 0.25rem 0;
}

.technical-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ion-color-light-shade);
}

.ratings-card {
  margin-bottom: 1rem;
}

.rating-section {
  margin-bottom: 1.5rem;
}

.star-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.rating-text {
  margin-left: 0.5rem;
  font-size: 1.1rem;
}

.notes-card {
  margin-bottom: 1rem;
}

.notes-content {
  background: var(--ion-color-light);
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-medium);
  margin: 0.5rem 0;
  font-style: italic;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.details-card {
  margin-bottom: 1rem;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.confidence-text {
  text-align: center;
  margin: 0.5rem 0;
  font-weight: bold;
}

h4 {
  margin: 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

h5 {
  margin: 1rem 0 0.5rem 0;
  color: var(--ion-color-medium);
}
</style>