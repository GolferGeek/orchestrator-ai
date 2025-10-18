<template>
  <div class="sub-accordion" :class="{ 'is-expanded': isExpanded }">
    <button
      class="sub-accordion-header"
      @click="toggle"
      @keydown="handleKeydown"
      :aria-expanded="isExpanded"
      :aria-controls="`sub-accordion-content-${subId}`"
      :id="`sub-accordion-header-${subId}`"
      tabindex="0"
    >
      <h3 class="sub-accordion-title">{{ title }}</h3>
      <ion-icon 
        :icon="isExpanded ? chevronUpOutline : chevronDownOutline"
        class="sub-accordion-icon"
        :class="{ 'rotated': isExpanded }"
        @click="toggle"
        @keydown="handleKeydown"
        tabindex="0"
        role="button"
        :aria-label="isExpanded ? 'Collapse subsection' : 'Expand subsection'"
      />
    </button>
    
    <div
      v-show="isExpanded"
      :id="`sub-accordion-content-${subId}`"
      :aria-labelledby="`sub-accordion-header-${subId}`"
      role="region"
      class="sub-accordion-content"
    >
      <div class="sub-accordion-inner">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chevronUpOutline, chevronDownOutline } from 'ionicons/icons';

interface Props {
  title: string;
  isExpanded?: boolean;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  id: undefined
});

// Generate a more predictable ID for this sub-accordion
const subId = computed(() => {
  if (props.id) {
    return `sub-${props.id}`;
  }
  // Fallback to title-based ID
  return `sub-${props.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.random().toString(36).substr(2, 6)}`;
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
.sub-accordion {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(139, 90, 60, 0.08);
  border-radius: var(--radius-lg);
  margin-bottom: 1rem;
  overflow: hidden;
  box-shadow: var(--shadow-xs);
  transition: var(--transition-smooth);
  max-width: 90%; /* Narrower than main accordion */
  margin-left: auto;
  margin-right: auto;
}

.sub-accordion:hover {
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.sub-accordion.is-expanded {
  box-shadow: var(--shadow-md);
}

.sub-accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-smooth);
  min-height: 48px;
  min-width: 44px;
  text-align: left;
}

.sub-accordion-header:hover {
  background: rgba(139, 90, 60, 0.05);
}

.sub-accordion-header:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: -2px;
}

.sub-accordion-header:focus:not(:focus-visible) {
  outline: none;
}

.sub-accordion-title {
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--landing-dark);
  margin: 0;
  line-height: 1.3;
  flex: 1;
}

.sub-accordion-icon {
  font-size: var(--text-base);
  color: var(--landing-secondary);
  transition: transform 0.3s ease;
  margin-left: 0.75rem;
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

.sub-accordion-icon.rotated {
  transform: rotate(180deg);
}

.sub-accordion-icon:hover {
  background: rgba(139, 90, 60, 0.1);
}

.sub-accordion-icon:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: 2px;
}

.sub-accordion-icon:focus:not(:focus-visible) {
  outline: none;
}

.sub-accordion-content {
  border-top: 1px solid rgba(139, 90, 60, 0.08);
  background: rgba(255, 255, 255, 0.3);
}

.sub-accordion-inner {
  padding: 1.5rem;
}

.sub-accordion-inner p {
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--landing-dark);
  margin: 0;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .sub-accordion {
    max-width: 95%;
  }
  
  .sub-accordion-header {
    padding: 0.75rem 1rem;
    min-height: 44px;
  }
  
  .sub-accordion-title {
    font-size: var(--text-base);
  }
  
  .sub-accordion-icon {
    font-size: var(--text-sm);
    margin-left: 0.5rem;
  }
  
  .sub-accordion-inner {
    padding: 1rem;
  }
  
  .sub-accordion-inner p {
    font-size: var(--text-sm);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .sub-accordion {
    border-color: var(--landing-dark);
  }
  
  .sub-accordion-header:hover {
    background: rgba(139, 90, 60, 0.1);
  }
}
</style>
