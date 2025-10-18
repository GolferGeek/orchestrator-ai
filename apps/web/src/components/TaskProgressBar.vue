<template>
  <div class="task-progress-bar">
    <div class="progress-header" v-if="showMessage">
      <span class="progress-label">{{ progressMessage || 'Processing...' }}</span>
      <span class="progress-percentage">{{ Math.round(currentProgress) }}%</span>
    </div>
    <div class="progress-container">
      <div 
        class="progress-fill" 
        :style="{ width: `${currentProgress}%` }"
        :class="{ 'indeterminate': isIndeterminate }"
      />
    </div>
    <div v-if="showDetails" class="progress-details">
      <small class="progress-status">{{ taskStatus }}</small>
      <small v-if="timeElapsed" class="time-elapsed">{{ timeElapsed }}</small>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { tasksService } from '@/services/tasksService';
// Props
const props = withDefaults(defineProps<{
  taskId: string;
  initialProgress?: number;
  showMessage?: boolean;
  showDetails?: boolean;
  autoUpdate?: boolean;
}>(), {
  initialProgress: 0,
  showMessage: true,
  showDetails: false,
  autoUpdate: true,
});
// Reactive state
const currentProgress = ref(props.initialProgress);
const progressMessage = ref<string>('');
const taskStatus = ref<string>('pending');
const startTime = ref<Date>();
const timeElapsed = ref<string>('');
// Computed
const isIndeterminate = computed(() => {
  return taskStatus.value === 'pending' || (currentProgress.value === 0 && taskStatus.value === 'running');
});
// Methods
const updateTimeElapsed = () => {
  if (!startTime.value) return;
  const now = new Date();
  const elapsed = now.getTime() - startTime.value.getTime();
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    timeElapsed.value = `${minutes}m ${seconds % 60}s`;
  } else {
    timeElapsed.value = `${seconds}s`;
  }
};
const handleProgressUpdate = (event: { taskId: string; progress?: number; message?: string }) => {
  if (event.taskId !== props.taskId) return;
  currentProgress.value = event.progress || 0;
  progressMessage.value = event.message || '';
  taskStatus.value = event.status || 'running';
  // Set start time when task begins running
  if (event.status === 'running' && !startTime.value) {
    startTime.value = new Date();
  }
};
// Timer for elapsed time
let autoUpdateInterval: number | null = null;
let elapsedTimer: number | null = null;
// Lifecycle
const startAutoUpdate = () => {
  if (!props.autoUpdate) {
    return;
  }

  if (props.showDetails && !startTime.value) {
    startTime.value = new Date();
    elapsedTimer = window.setInterval(updateTimeElapsed, 1000);
  }

  const tick = async () => {
    try {
      const status = await tasksService.getTaskStatus(props.taskId);
      handleProgressUpdate({
        taskId: props.taskId,
        progress: status.progress,
        message: status.progressMessage,
        status: status.status,
      });
    } catch (error) {
      console.warn('Failed to refresh task progress', error);
    }
  };

  void tick();
  autoUpdateInterval = window.setInterval(tick, 2000);
};

const stopAutoUpdate = () => {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
};

onMounted(() => {
  startAutoUpdate();
});

onBeforeUnmount(() => {
  stopAutoUpdate();
});
// Watch for progress changes
watch(
  () => props.initialProgress,
  (newProgress) => {
    currentProgress.value = newProgress;
  },
);
// Watch for task completion
watch(taskStatus, (newStatus) => {
  if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
    stopAutoUpdate();
  }
});

watch(
  () => props.autoUpdate,
  (enabled) => {
    stopAutoUpdate();
    if (enabled) {
      startAutoUpdate();
    }
  },
);
</script>
<style scoped>
.task-progress-bar {
  width: 100%;
}
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.9em;
}
.progress-label {
  color: var(--ion-color-step-600);
  font-weight: 500;
}
.progress-percentage {
  color: var(--ion-color-primary);
  font-weight: 600;
}
.progress-container {
  width: 100%;
  height: 8px;
  background: var(--ion-color-step-150);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: var(--ion-color-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}
.progress-fill.indeterminate {
  width: 100% !important;
  background: linear-gradient(
    90deg,
    transparent,
    var(--ion-color-primary),
    transparent
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
.progress-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 0.8em;
  color: var(--ion-color-medium);
}
.progress-status {
  text-transform: capitalize;
}
.time-elapsed {
  font-family: 'Courier New', Courier, monospace;
}
</style>
