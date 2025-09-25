<template>
  <component :is="activeLandingComponent" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, defineComponent, h } from 'vue';
import { IonContent, IonPage, IonSpinner } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';

const authStore = useAuthStore();
const { currentNamespace } = storeToRefs(authStore);

const LoadingLandingPage = defineComponent({
  name: 'LoadingLandingPage',
  setup() {
    return () => h(IonPage, null, {
      default: () => h(IonContent, { fullscreen: true, class: 'landing-loading' }, () =>
        h(IonSpinner, { name: 'crescent' })
      )
    });
  }
});

const createAsyncLanding = (loader: () => Promise<any>) =>
  defineAsyncComponent({
    loader,
    loadingComponent: LoadingLandingPage,
    suspensible: false,
  });

const landingComponents = {
  demo: createAsyncLanding(() => import('./landing/demo/DemoLandingPage.vue')),
  'my-org': createAsyncLanding(() => import('./landing/my-org/MyOrgLandingPage.vue')),
  saas: createAsyncLanding(() => import('./landing/saas/SaasLandingPage.vue')),
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
.landing-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
