<template>
  <div class="task-rating">
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
        <span>Rate this task result</span>
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
        <label>Completion Speed</label>
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
          placeholder="Any additional feedback about the task execution..."
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
import { tasksService } from '../services/tasksService';
import type { EvaluationRequest, UserRatingScale } from '../types/evaluation';
interface Props {
  taskId: string;
  agentName?: string;
  messageRole?: 'user' | 'assistant' | 'system' | 'tool';
}
interface TaskEvaluation {
  userRating?: UserRatingScale;
  speedRating?: UserRatingScale;
  accuracyRating?: UserRatingScale;
  userNotes?: string;
  evaluationDetails?: Record<string, unknown>;
  evaluationTimestamp?: string;
}
const props = defineProps<Props>();
// State
const currentRating = ref<TaskEvaluation | null>(null);
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
  // Don't load for invalid or placeholder task IDs
  if (!props.taskId || 
      props.taskId === 'pending' || 
      props.taskId.startsWith('workflow-') || 
      props.taskId.includes('placeholder')) {
    return;
  }
  try {
    isLoading.value = true;
    console.log('[TaskRating] Attempting to load task:', props.taskId);
    const task = await tasksService.getTaskById(props.taskId);
    console.log('[TaskRating] Task loaded successfully:', task?.id);
    if (task?.evaluation) {
      currentRating.value = {
        userRating: task.evaluation.user_rating,
        speedRating: task.evaluation.speed_rating,
        accuracyRating: task.evaluation.accuracy_rating,
        userNotes: task.evaluation.user_notes,
        evaluationDetails: task.evaluation.evaluation_details,
        evaluationTimestamp: task.evaluation.evaluation_timestamp
      };
      // Populate draft with existing data
      draftRating.value = {
        userRating: task.evaluation.user_rating,
        speedRating: task.evaluation.speed_rating,
        accuracyRating: task.evaluation.accuracy_rating,
        userNotes: task.evaluation.user_notes || ''
      };
    }
  } catch (error) {
    console.error('[TaskRating] Error loading task rating:', error);
    console.error('[TaskRating] Task ID that failed:', props.taskId);
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
        tags: [type, 'quick-rating', 'task-evaluation']
      }
    };
    const updatedTask = await tasksService.evaluateTask(props.taskId, evaluation);
    if (updatedTask?.evaluation) {
      currentRating.value = {
        userRating: updatedTask.evaluation.user_rating,
        speedRating: updatedTask.evaluation.speed_rating,
        accuracyRating: updatedTask.evaluation.accuracy_rating,
        userNotes: updatedTask.evaluation.user_notes,
        evaluationDetails: updatedTask.evaluation.evaluation_details,
        evaluationTimestamp: updatedTask.evaluation.evaluation_timestamp
      };
      // Update draft
      draftRating.value.userRating = rating;
    }
  } catch {
    // Error saving quick task rating
  } finally {
    isLoading.value = false;
  }
};
const setRating = (type: keyof EvaluationRequest, value: number) => {
  (draftRating.value as Record<string, unknown>)[type] = value as UserRatingScale;
};
const saveRating = async () => {
  if (!hasRatingData.value) return;
  try {
    isLoading.value = true;
    const evaluation: EvaluationRequest = {
      ...draftRating.value,
      evaluationDetails: {
        userContext: 'Detailed task rating form',
        tags: ['detailed-rating', 'task-evaluation']
      }
    };
    const updatedTask = await tasksService.evaluateTask(props.taskId, evaluation);
    if (updatedTask?.evaluation) {
      currentRating.value = {
        userRating: updatedTask.evaluation.user_rating,
        speedRating: updatedTask.evaluation.speed_rating,
        accuracyRating: updatedTask.evaluation.accuracy_rating,
        userNotes: updatedTask.evaluation.user_notes,
        evaluationDetails: updatedTask.evaluation.evaluation_details,
        evaluationTimestamp: updatedTask.evaluation.evaluation_timestamp
      };
    }
    showDetailedRating.value = false;
    showFeedbackInput.value = false;
  } catch {
    // Error saving detailed task rating
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
// Watch for task changes
watch(() => props.taskId, () => {
  loadExistingRating();
});
</script>
<style scoped>
.task-rating {
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
  gap: 0.5rem; /* Better spacing for touch targets */
}

/* Ensure all rating buttons have proper touch targets */
.rating-buttons ion-button,
.star-rating ion-button,
.rating-header ion-button {
  min-width: 2.75rem; /* 44px minimum touch target */
  min-height: 2.75rem;
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
  gap: 0.25rem; /* Better spacing between star buttons */
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