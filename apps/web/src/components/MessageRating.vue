<template>
  <div class="message-rating" v-if="showForMessage">
    <!-- Simple Rating UI -->
    <div class="rating-section" v-if="!showDetailedRating">
      <div class="rating-buttons">
        <ion-button 
          fill="clear" 
          size="small" 
          :color="currentRating?.userRating && currentRating.userRating >= 4 ? 'success' : 'medium'"
          @click="quickRate('positive')"
          :disabled="isLoading"
        >
          <ion-icon :icon="thumbsUpOutline" slot="icon-only" size="small"></ion-icon>
        </ion-button>
        
        <ion-button 
          fill="clear" 
          size="small" 
          :color="currentRating?.userRating && currentRating.userRating <= 2 ? 'danger' : 'medium'"
          @click="quickRate('negative')"
          :disabled="isLoading"
        >
          <ion-icon :icon="thumbsDownOutline" slot="icon-only" size="small"></ion-icon>
        </ion-button>
        
        <ion-button 
          fill="clear" 
          size="small" 
          color="medium"
          @click="toggleDetailedRating"
          v-if="currentRating"
        >
          <ion-icon :icon="ellipsisHorizontalOutline" slot="icon-only" size="small"></ion-icon>
        </ion-button>
      </div>
      
      <div class="rating-status" v-if="currentRating">
        <span class="rating-text">
          {{ getRatingText(currentRating.userRating) }}
        </span>
      </div>
    </div>

    <!-- Detailed Rating UI -->
    <div class="detailed-rating" v-if="showDetailedRating">
      <div class="rating-header">
        <span>Rate this response</span>
        <ion-button fill="clear" size="small" @click="toggleDetailedRating">
          <ion-icon :icon="closeOutline" slot="icon-only" size="small"></ion-icon>
        </ion-button>
      </div>
      
      <div class="rating-item">
        <label>Overall Quality</label>
        <div class="star-rating">
          <ion-button 
            v-for="star in 5" 
            :key="`overall-${star}`"
            fill="clear" 
            size="small"
            @click="setRating('userRating', star)"
            :disabled="isLoading"
          >
            <ion-icon 
              :icon="star <= (draftRating.userRating || 0) ? starSharp : starOutline" 
              :color="star <= (draftRating.userRating || 0) ? 'warning' : 'medium'"
              size="small"
            ></ion-icon>
          </ion-button>
        </div>
      </div>

      <div class="rating-item">
        <label>Response Speed</label>
        <div class="star-rating">
          <ion-button 
            v-for="star in 5" 
            :key="`speed-${star}`"
            fill="clear" 
            size="small"
            @click="setRating('speedRating', star)"
            :disabled="isLoading"
          >
            <ion-icon 
              :icon="star <= (draftRating.speedRating || 0) ? starSharp : starOutline" 
              :color="star <= (draftRating.speedRating || 0) ? 'warning' : 'medium'"
              size="small"
            ></ion-icon>
          </ion-button>
        </div>
      </div>

      <div class="rating-item">
        <label>Accuracy</label>
        <div class="star-rating">
          <ion-button 
            v-for="star in 5" 
            :key="`accuracy-${star}`"
            fill="clear" 
            size="small"
            @click="setRating('accuracyRating', star)"
            :disabled="isLoading"
          >
            <ion-icon 
              :icon="star <= (draftRating.accuracyRating || 0) ? starSharp : starOutline" 
              :color="star <= (draftRating.accuracyRating || 0) ? 'warning' : 'medium'"
              size="small"
            ></ion-icon>
          </ion-button>
        </div>
      </div>

      <div class="rating-item" v-if="showFeedbackInput">
        <label>Feedback (optional)</label>
        <ion-textarea
          v-model="draftRating.userNotes"
          placeholder="Any additional feedback..."
          :rows="2"
          :disabled="isLoading"
        ></ion-textarea>
      </div>

      <div class="rating-actions">
        <ion-button 
          size="small" 
          fill="clear" 
          @click="showFeedbackInput = !showFeedbackInput"
          v-if="!showFeedbackInput"
        >
          Add feedback
        </ion-button>
        
        <ion-button 
          size="small" 
          @click="saveRating"
          :disabled="isLoading || !hasRatingData"
        >
          <ion-spinner v-if="isLoading" name="crescent" size="small"></ion-spinner>
          <span v-else>Save</span>
        </ion-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonTextarea
} from '@ionic/vue';
import {
  thumbsUpOutline,
  thumbsDownOutline,
  starOutline,
  starSharp,
  ellipsisHorizontalOutline,
  closeOutline
} from 'ionicons/icons';
import { evaluationService } from '../services/evaluationService';
import type { EvaluationRequest, EvaluationResponse, UserRatingScale } from '../types/evaluation';

interface Props {
  messageId: string;
  agentName?: string;
  messageRole: 'user' | 'assistant' | 'system' | 'tool';
}

const props = defineProps<Props>();

// Only show rating for completed assistant messages (not placeholders)
const showForMessage = computed(() => 
  props.messageRole === 'assistant' && 
  props.messageId && 
  props.messageId !== 'pending' &&
  !props.messageId.startsWith('workflow-')
);

// State
const currentRating = ref<EvaluationResponse | null>(null);
const showDetailedRating = ref(false);
const showFeedbackInput = ref(false);
const isLoading = ref(false);

// Draft rating for detailed form
const draftRating = ref<EvaluationRequest>({
  userRating: undefined,
  speedRating: undefined,
  accuracyRating: undefined,
  userNotes: ''
});

// Computed
const hasRatingData = computed(() => {
  return draftRating.value.userRating || 
         draftRating.value.speedRating || 
         draftRating.value.accuracyRating ||
         (draftRating.value.userNotes && draftRating.value.userNotes.trim().length > 0);
});

// Methods
const loadExistingRating = async () => {
  if (!showForMessage.value) return;
  
  try {
    isLoading.value = true;
    currentRating.value = await evaluationService.getMessageRating(props.messageId);
    
    if (currentRating.value) {
      // Populate draft with existing data
      draftRating.value = {
        userRating: currentRating.value.userRating,
        speedRating: currentRating.value.speedRating,
        accuracyRating: currentRating.value.accuracyRating,
        userNotes: currentRating.value.userNotes || ''
      };
    }
  } catch (error) {
    // Error loading rating
  } finally {
    isLoading.value = false;
  }
};

const quickRate = async (type: 'positive' | 'negative') => {
  const rating: UserRatingScale = type === 'positive' ? 5 : 1;
  
  try {
    isLoading.value = true;
    
    const evaluation: EvaluationRequest = {
      userRating: rating,
      evaluationDetails: {
        userContext: `Quick ${type} rating`,
        tags: [type, 'quick-rating']
      }
    };
    
    if (currentRating.value) {
      currentRating.value = await evaluationService.updateRating(props.messageId, evaluation);
    } else {
      currentRating.value = await evaluationService.rateMessage(props.messageId, evaluation);
    }
    
    // Update draft
    draftRating.value.userRating = rating;
  } catch (error) {
    // Error saving quick rating
  } finally {
    isLoading.value = false;
  }
};

const setRating = (type: keyof EvaluationRequest, value: number) => {
  (draftRating.value as any)[type] = value as UserRatingScale;
};

const saveRating = async () => {
  if (!hasRatingData.value) return;
  
  try {
    isLoading.value = true;
    
    const evaluation: EvaluationRequest = {
      ...draftRating.value,
      evaluationDetails: {
        userContext: 'Detailed rating form',
        tags: ['detailed-rating']
      }
    };
    
    if (currentRating.value) {
      currentRating.value = await evaluationService.updateRating(props.messageId, evaluation);
    } else {
      currentRating.value = await evaluationService.rateMessage(props.messageId, evaluation);
    }
    
    showDetailedRating.value = false;
    showFeedbackInput.value = false;
  } catch (error) {
    // Error saving detailed rating
  } finally {
    isLoading.value = false;
  }
};

const toggleDetailedRating = () => {
  showDetailedRating.value = !showDetailedRating.value;
  if (showDetailedRating.value && currentRating.value) {
    // Populate form with existing data
    draftRating.value = {
      userRating: currentRating.value.userRating,
      speedRating: currentRating.value.speedRating,
      accuracyRating: currentRating.value.accuracyRating,
      userNotes: currentRating.value.userNotes || ''
    };
    
    if (draftRating.value.userNotes) {
      showFeedbackInput.value = true;
    }
  }
};

const getRatingText = (rating?: UserRatingScale): string => {
  if (!rating) return '';
  
  const texts = {
    1: 'Poor',
    2: 'Fair', 
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
  };
  
  return texts[rating] || '';
};

// Lifecycle
onMounted(() => {
  loadExistingRating();
});

// Watch for message changes
watch(() => props.messageId, () => {
  loadExistingRating();
});
</script>

<style scoped>
.message-rating {
  margin-top: 8px;
  padding: 8px 0;
}

.rating-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating-buttons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.rating-status {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.rating-text {
  font-weight: 500;
}

.detailed-rating {
  background: var(--ion-color-light);
  border-radius: 8px;
  padding: 12px;
  margin-top: 4px;
}

.rating-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
  font-size: 0.9rem;
}

.rating-item {
  margin-bottom: 12px;
}

.rating-item label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--ion-color-dark);
  margin-bottom: 4px;
}

.star-rating {
  display: flex;
  align-items: center;
  gap: 2px;
}

.rating-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .detailed-rating {
    background: var(--ion-color-dark-shade);
  }
}
</style>