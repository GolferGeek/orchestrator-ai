<template>
  <div class="view-toggle" :class="{ 'is-technical': isTechnicalView }">
    <button
      class="toggle-button"
      :class="{ 'active': isMarketingView }"
      @click="navigateToMarketing"
      :aria-pressed="isMarketingView"
      aria-label="Switch to Landing view"
    >
      <ion-icon :icon="homeOutline" />
      <span class="toggle-label">Landing</span>
    </button>
    
    <button
      class="toggle-button"
      :class="{ 'active': isTechnicalView }"
      @click="navigateToTechnical"
      :aria-pressed="isTechnicalView"
      aria-label="Switch to Technical view"
    >
      <ion-icon :icon="documentTextOutline" />
      <span class="toggle-label">Technical</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { homeOutline, documentTextOutline } from 'ionicons/icons';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const isMarketingView = computed(() => route.path === '/landing' || route.path === '/');
const isTechnicalView = computed(() => route.path === '/technical');

function navigateToMarketing() {
  router.push('/landing');
}

function navigateToTechnical() {
  router.push('/technical');
}
</script>

<style scoped>
.view-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 90, 60, 0.2);
  border-radius: var(--radius-lg);
  padding: 2px;
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-smooth);
}

.view-toggle:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.toggle-button {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--landing-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  border-radius: calc(var(--radius-lg) - 2px);
  cursor: pointer;
  transition: var(--transition-smooth);
  min-height: 44px; /* Accessibility: minimum touch target */
  position: relative;
  overflow: hidden;
}

.toggle-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--landing-primary-50);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.toggle-button:hover {
  color: var(--landing-primary);
  transform: translateY(-1px);
}

.toggle-button:hover::before {
  opacity: 1;
}

.toggle-button.active {
  background: var(--landing-primary);
  color: var(--landing-white);
  box-shadow: var(--shadow-sm);
}

.toggle-button.active::before {
  opacity: 0;
}

.toggle-button ion-icon {
  font-size: var(--text-base);
  position: relative;
  z-index: 1;
}

.toggle-label {
  position: relative;
  z-index: 1;
  white-space: nowrap;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .toggle-label {
    display: none;
  }
  
  .toggle-button {
    padding: var(--space-2);
    min-width: 44px;
    justify-content: center;
  }
  
  .view-toggle {
    padding: 1px;
  }
}

/* Focus styles for accessibility */
.toggle-button:focus {
  outline: 2px solid var(--landing-primary);
  outline-offset: 2px;
}

.toggle-button:focus:not(:focus-visible) {
  outline: none;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .view-toggle {
    border-color: var(--landing-dark);
  }
  
  .toggle-button {
    border: 1px solid transparent;
  }
  
  .toggle-button.active {
    border-color: var(--landing-dark);
  }
}
</style>
