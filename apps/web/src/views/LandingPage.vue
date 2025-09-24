<template>
  <Suspense>
    <template #default>
      <component :is="activeLandingComponent" />
    </template>
    <template #fallback>
      <div class="landing-loading">
        <ion-spinner name="crescent" />
      </div>
    </template>
  </Suspense>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { IonSpinner } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

const landingComponents = {
  demo: defineAsyncComponent(() => import('./landing/demo/DemoLandingPage.vue')),
  'my-org': defineAsyncComponent(() => import('./landing/my-org/MyOrgLandingPage.vue')),
  saas: defineAsyncComponent(() => import('./landing/saas/SaasLandingPage.vue')),
} as const;

type LandingNamespace = keyof typeof landingComponents;

const resolvedNamespace = computed<LandingNamespace>(() => {
  const available = authStore.availableNamespaces.value;
  const namespace = (authStore.currentNamespace.value || '').toLowerCase();

  if (namespace in landingComponents) {
    return namespace as LandingNamespace;
  }

  if (available.includes('my-org')) {
    return 'my-org';
  }

  return 'demo';
});

const activeLandingComponent = computed(() => landingComponents[resolvedNamespace.value]);
</script>

<style scoped>
.landing-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
