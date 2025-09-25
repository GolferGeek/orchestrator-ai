<template>
  <div class="accordion-section" :class="{ 'is-expanded': isExpanded }">
    <button
      class="accordion-header"
      @click="toggle"
      @keydown="handleKeydown"
      :aria-expanded="isExpanded"
      :aria-controls="`accordion-content-${id}`"
      :id="`accordion-header-${id}`"
      tabindex="0"
    >
      <h2 class="accordion-title">{{ title }}</h2>
      <ion-icon 
        :icon="isExpanded ? chevronUpOutline : chevronDownOutline"
        class="accordion-icon"
        :class="{ 'rotated': isExpanded }"
        @click="toggle"
        @keydown="handleKeydown"
        tabindex="0"
        role="button"
        :aria-label="isExpanded ? 'Collapse section' : 'Expand section'"
      />
    </button>
    
    <div
      v-show="isExpanded"
      :id="`accordion-content-${id}`"
      :aria-labelledby="`accordion-header-${id}`"
      role="region"
      class="accordion-content"
    >
      <div class="accordion-inner">
        <slot name="content" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { IonIcon } from '@ionic/vue';
import { chevronUpOutline, chevronDownOutline } from 'ionicons/icons';

interface Props {
  id: string;
  title: string;
  isExpanded?: boolean;
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isExpanded: false,
  defaultExpanded: true
});

const isExpanded = ref(props.isExpanded);

// Initialize with default expanded state on first visit
onMounted(() => {
  if (props.defaultExpanded && !localStorage.getItem(`accordion-${props.id}-visited`)) {
    isExpanded.value = true;
    localStorage.setItem(`accordion-${props.id}-visited`, 'true');
  }
});

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

// Watch for prop changes
watch(() => props.isExpanded, (newValue) => {
  isExpanded.value = newValue;
});
</script>

<style scoped>
.accordion-section {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 90, 60, 0.1);
  border-radius: var(--radius-xl);
  margin-bottom: 1.5rem;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: var(--transition-smooth);
}

.accordion-section:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.accordion-section.is-expanded {
  box-shadow: var(--shadow-lg);
}

.accordion-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-smooth);
  min-height: 60px;
  min-width: 44px;
  text-align: left;
}

.accordion-header:hover {
  background: rgba(139, 90, 60, 0.05);
}

.accordion-header:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: -2px;
}

.accordion-header:focus:not(:focus-visible) {
  outline: none;
}

.accordion-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0;
  line-height: 1.3;
  flex: 1;
}

.accordion-icon {
  font-size: var(--text-lg);
  color: var(--landing-secondary);
  transition: transform 0.3s ease;
  margin-left: 1rem;
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

.accordion-icon.rotated {
  transform: rotate(180deg);
}

.accordion-icon:hover {
  background: rgba(139, 90, 60, 0.1);
}

.accordion-icon:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: 2px;
}

.accordion-icon:focus:not(:focus-visible) {
  outline: none;
}

.accordion-content {
  border-top: 1px solid rgba(139, 90, 60, 0.1);
  background: rgba(255, 255, 255, 0.5);
}

.accordion-inner {
  padding: 2rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .accordion-header {
    padding: 1rem 1.5rem;
    min-height: 56px;
  }
  
  .accordion-title {
    font-size: var(--text-lg);
  }
  
  .accordion-icon {
    font-size: var(--text-base);
    margin-left: 0.75rem;
  }
  
  .accordion-inner {
    padding: 1.5rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .accordion-section {
    border-color: var(--landing-dark);
  }
  
  .accordion-header:hover {
    background: rgba(139, 90, 60, 0.1);
  }
}
</style>
