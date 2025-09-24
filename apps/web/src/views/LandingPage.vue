<template>
  <div class="landing-page-container">
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
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { IonSpinner } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';

const authStore = useAuthStore();
const { currentNamespace } = storeToRefs(authStore);

const landingComponents = {
  demo: defineAsyncComponent(() => import('./landing/demo/DemoLandingPage.vue')),
  'my-org': defineAsyncComponent(() => import('./landing/my-org/MyOrgLandingPage.vue')),
  saas: defineAsyncComponent(() => import('./landing/saas/SaasLandingPage.vue')),
} as const;

type LandingNamespace = keyof typeof landingComponents;

const resolvedNamespace = computed<LandingNamespace>(() => {
  const namespace = (currentNamespace.value || 'demo').toLowerCase();

  // Check if namespace exists in components, handle saas-* namespaces
  if (namespace in landingComponents) {
    return namespace as LandingNamespace;
  }

  // For saas-* namespaces (like saas-ifm), use the saas component
  if (namespace.startsWith('saas-')) {
    return 'saas';
  }

  // Default to demo if namespace not found
  return 'demo';
});

const activeLandingComponent = computed(() => landingComponents[resolvedNamespace.value]);
</script>

<style scoped>
.landing-page-container {
  width: 100%;
  height: 100%;
}

.landing-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
