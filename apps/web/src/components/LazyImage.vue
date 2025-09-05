<template>
  <div class="lazy-image-container" :class="{ 'loading': isLoading, 'error': hasError }">
    <img
      v-if="!hasError"
      ref="imageRef"
      :src="currentSrc"
      :alt="alt"
      :class="imageClass"
      @load="onLoad"
      @error="onError"
      :style="imageStyle"
    />
    <div v-if="isLoading" class="lazy-image-placeholder">
      <ion-skeleton-text :animated="true" style="width: 100%; height: 100%;"></ion-skeleton-text>
    </div>
    <div v-if="hasError" class="lazy-image-error">
      <ion-icon :icon="imageOutline" color="medium"></ion-icon>
      <span>Image failed to load</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { IonSkeletonText, IonIcon } from '@ionic/vue';
import { imageOutline } from 'ionicons/icons';

// Props
const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  width: {
    type: [String, Number],
    default: 'auto'
  },
  height: {
    type: [String, Number],
    default: 'auto'
  },
  objectFit: {
    type: String as () => 'cover' | 'contain' | 'fill' | 'none' | 'scale-down',
    default: 'cover'
  },
  lazy: {
    type: Boolean,
    default: true
  },
  threshold: {
    type: Number,
    default: 0.1
  },
  rootMargin: {
    type: String,
    default: '50px'
  }
});

// Template refs
const imageRef = ref<HTMLImageElement | null>(null);

// Reactive state
const isLoading = ref(true);
const hasError = ref(false);
const isVisible = ref(false);
const observer = ref<IntersectionObserver | null>(null);

// Computed properties
const currentSrc = computed(() => {
  if (!props.lazy) return props.src;
  if (isVisible.value) return props.src;
  return props.placeholder || '';
});

const imageClass = computed(() => ({
  'lazy-image': true,
  'lazy-image-loaded': !isLoading.value && !hasError.value,
  'lazy-image-loading': isLoading.value,
  'lazy-image-error': hasError.value
}));

const imageStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  objectFit: props.objectFit,
  opacity: isLoading.value ? 0 : 1,
  transition: 'opacity 0.3s ease-in-out'
}));

// Methods
const onLoad = () => {
  isLoading.value = false;
  hasError.value = false;
};

const onError = () => {
  isLoading.value = false;
  hasError.value = true;
};

const setupIntersectionObserver = () => {
  if (!props.lazy || !imageRef.value) return;

  observer.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          isVisible.value = true;
          if (observer.value) {
            observer.value.disconnect();
            observer.value = null;
          }
        }
      });
    },
    {
      threshold: props.threshold,
      rootMargin: props.rootMargin
    }
  );

  observer.value.observe(imageRef.value);
};

const cleanupObserver = () => {
  if (observer.value) {
    observer.value.disconnect();
    observer.value = null;
  }
};

// Watch for src changes
watch(() => props.src, () => {
  isLoading.value = true;
  hasError.value = false;
  if (props.lazy && !isVisible.value) {
    setupIntersectionObserver();
  }
});

// Lifecycle hooks
onMounted(() => {
  if (!props.lazy) {
    isVisible.value = true;
  } else {
    setupIntersectionObserver();
  }
});

onUnmounted(() => {
  cleanupObserver();
});
</script>

<style scoped>
.lazy-image-container {
  position: relative;
  display: inline-block;
  overflow: hidden;
  background: var(--ion-color-light);
  border-radius: 4px;
}

.lazy-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.lazy-image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--ion-color-light);
  border-radius: 4px;
}

.lazy-image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
  text-align: center;
  min-height: 100px;
}

.loading .lazy-image-placeholder {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
}
</style>
