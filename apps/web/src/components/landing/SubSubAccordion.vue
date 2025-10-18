<template>
  <div class="sub-sub-accordion" :class="{ 'is-expanded': isExpanded }">
    <button
      class="sub-sub-accordion-header"
      @click="toggle"
      @keydown="handleKeydown"
      :aria-expanded="isExpanded"
      :aria-controls="`sub-sub-accordion-content-${subSubId}`"
      :id="`sub-sub-accordion-header-${subSubId}`"
      tabindex="0"
    >
      <h4 class="sub-sub-accordion-title">{{ title }}</h4>
      <ion-icon 
        :icon="isExpanded ? chevronUpOutline : chevronDownOutline"
        class="sub-sub-accordion-icon"
        :class="{ 'rotated': isExpanded }"
        @click="toggle"
        @keydown="handleKeydown"
        tabindex="0"
        role="button"
        :aria-label="isExpanded ? 'Collapse sub-subsection' : 'Expand sub-subsection'"
      />
    </button>
    
    <div
      v-show="isExpanded"
      :id="`sub-sub-accordion-content-${subSubId}`"
      :aria-labelledby="`sub-sub-accordion-header-${subSubId}`"
      role="region"
      class="sub-sub-accordion-content"
    >
      <div class="sub-sub-accordion-inner">
        <!-- Lazy loading wrapper for deep content -->
        <Suspense v-if="lazyLoad && isExpanded">
          <template #default>
            <slot />
          </template>
          <template #fallback>
            <div class="loading-placeholder">
              <ion-spinner name="crescent" />
              <span>Loading content...</span>
            </div>
          </template>
        </Suspense>
        <!-- Regular slot for immediate content -->
        <slot v-else />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon, IonSpinner } from '@ionic/vue';
import { chevronUpOutline, chevronDownOutline } from 'ionicons/icons';

interface Props {
  title: string;
  isExpanded?: boolean;
  id?: string;
  lazyLoad?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  lazyLoad: false,
  id: undefined
});

// Generate a more predictable ID for this sub-sub-accordion
const subSubId = computed(() => {
  if (props.id) {
    return `sub-sub-${props.id}`;
  }
  // Fallback to title-based ID
  return `sub-sub-${props.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substr(2, 6)}`;
});

const isExpanded = ref(props.isExpanded);

const toggle = () => {
  isExpanded.value = !isExpanded.value;
};

// Handle keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault();
      toggle();
      break;
    case 'ArrowDown':
      event.preventDefault();
      if (!isExpanded.value) {
        toggle();
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (isExpanded.value) {
        toggle();
      }
      break;
    case 'Escape':
      if (isExpanded.value) {
        toggle();
      }
      break;
  }
};
</script>

<style scoped>
.sub-sub-accordion {
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(139, 90, 60, 0.06);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  overflow: hidden;
  box-shadow: var(--shadow-xs);
  transition: var(--transition-smooth);
  max-width: 85%; /* Even narrower than sub-accordion */
  margin-left: auto;
  margin-right: auto;
}

.sub-sub-accordion:hover {
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.sub-sub-accordion.is-expanded {
  box-shadow: var(--shadow-md);
}

.sub-sub-accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-smooth);
  min-height: 44px;
  min-width: 44px;
  text-align: left;
}

.sub-sub-accordion-header:hover {
  background: rgba(139, 90, 60, 0.05);
}

.sub-sub-accordion-header:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: -2px;
}

.sub-sub-accordion-header:focus:not(:focus-visible) {
  outline: none;
}

.sub-sub-accordion-title {
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
  color: var(--landing-dark);
  margin: 0;
  line-height: 1.3;
  flex: 1;
}

.sub-sub-accordion-icon {
  font-size: var(--text-sm);
  color: var(--landing-secondary);
  transition: transform 0.3s ease;
  margin-left: 0.5rem;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  padding: 0.5rem;
}

.sub-sub-accordion-icon.rotated {
  transform: rotate(180deg);
}

.sub-sub-accordion-icon:hover {
  background: rgba(139, 90, 60, 0.1);
}

.sub-sub-accordion-icon:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: 2px;
}

.sub-sub-accordion-icon:focus:not(:focus-visible) {
  outline: none;
}

.sub-sub-accordion-content {
  border-top: 1px solid rgba(139, 90, 60, 0.06);
  background: rgba(255, 255, 255, 0.2);
}

.sub-sub-accordion-inner {
  padding: 1rem;
}

.sub-sub-accordion-inner p {
  font-size: var(--text-sm);
  line-height: 1.6;
  color: var(--landing-dark);
  margin: 0;
}

/* Loading placeholder for lazy content */
.loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--landing-secondary);
  font-size: var(--text-sm);
}

.loading-placeholder ion-spinner {
  --color: var(--landing-secondary);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .sub-sub-accordion {
    max-width: 90%;
  }
  
  .sub-sub-accordion-header {
    padding: 0.5rem 0.75rem;
    min-height: 44px;
  }
  
  .sub-sub-accordion-title {
    font-size: var(--text-sm);
  }
  
  .sub-sub-accordion-icon {
    font-size: var(--text-xs);
    margin-left: 0.25rem;
    min-width: 44px;
    min-height: 44px;
    padding: 0.25rem;
  }
  
  .sub-sub-accordion-inner {
    padding: 0.75rem;
  }
  
  .sub-sub-accordion-inner p {
    font-size: var(--text-xs);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .sub-sub-accordion {
    border-color: var(--landing-dark);
  }
  
  .sub-sub-accordion-header:hover {
    background: rgba(139, 90, 60, 0.1);
  }
}
</style>
