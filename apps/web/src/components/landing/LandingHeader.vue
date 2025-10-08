<template>
  <header class="landing-header">
    <div class="header-content">
      <div class="logo">
        <h1>Orchestrator AI</h1>
        <span class="tagline">AI for Small Business</span>
      </div>
      
      
      
      <!-- Main Navigation -->
      <nav class="header-nav">
        <NamespaceSwitcher v-if="authStore.isAuthenticated" />
        <!-- View Toggle - only show in demo namespace -->
        <ViewToggle v-if="isDemoNamespace" />
        <a href="/videos" class="nav-link">
          <ion-icon :icon="playCircleOutline"></ion-icon>
          All Videos
        </a>
        <ion-button 
          fill="outline" 
          size="small" 
          class="login-button"
          @click="navigateToApp"
        >
          <ion-icon slot="start" :icon="appsOutline"></ion-icon>
          {{ authStore.isAuthenticated ? 'Enter App' : 'Login' }}
        </ion-button>
      </nav>
    </div>
  </header>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { IonButton, IonIcon } from '@ionic/vue';
import { 
  playCircleOutline, 
  appsOutline
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';
import NamespaceSwitcher from '@/components/common/NamespaceSwitcher.vue';
import ViewToggle from '@/components/landing/ViewToggle.vue';

const router = useRouter();
const authStore = useAuthStore();
const { currentNamespace } = storeToRefs(authStore);

// Check if we're in the demo namespace
const isDemoNamespace = computed(() => {
  return (currentNamespace?.value || 'demo') === 'demo';
});

function navigateToApp() {
  if (authStore.isAuthenticated) {
    router.push('/app');
  } else {
    router.push('/login?redirect=/app');
  }
}
</script>
<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(253, 248, 246, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(139, 90, 60, 0.1);
  z-index: var(--z-fixed);
  padding: var(--space-3) 0;
  box-shadow: var(--shadow-brown);
}
.header-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
.logo h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--landing-primary);
  margin: 0;
  line-height: 1;
  letter-spacing: -0.025em;
}
.logo .tagline {
  font-size: var(--text-xs);
  color: var(--landing-secondary);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.075em;
}
.header-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--landing-dark);
  text-decoration: none;
  font-weight: var(--font-weight-medium);
  font-size: var(--text-sm);
  transition: var(--transition-smooth);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}
.nav-link::before {
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
.nav-link:hover {
  color: var(--landing-primary);
  transform: translateY(-1px);
}
.nav-link:hover::before {
  opacity: 1;
}
.nav-link ion-icon {
  font-size: var(--text-base);
  position: relative;
  z-index: 1;
}
.login-button {
  --border-color: var(--landing-primary);
  --color: var(--landing-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-sm);
  --border-radius: var(--radius-lg);
  --box-shadow: var(--shadow-sm);
}
.login-button:hover {
  --background: var(--landing-accent);
  --color: var(--landing-white);
  --box-shadow: var(--shadow-forest);
  transform: translateY(-1px);
}
/* Mobile responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
  }
  .header-nav {
    gap: 0.75rem;
  }
  .nav-link {
    font-size: 0.8rem;
    padding: 0.75rem; /* Better touch target padding */
    min-height: 2.75rem; /* 44px minimum touch target */
  }
  .nav-link span {
    display: none;
  }
  .login-button {
    font-size: 0.75rem;
  }
}
/* Mobile responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 0 1rem;
  }
  
  .header-nav {
    gap: 0.75rem;
  }
  
  .nav-link {
    font-size: 0.8rem;
    padding: 0.75rem;
    min-height: 2.75rem;
  }
  
  .nav-link span {
    display: none;
  }
  
  .login-button {
    font-size: 0.75rem;
  }
}

/* Add top padding to body content to account for fixed header */
:global(body) {
  padding-top: 60px;
}
</style>
