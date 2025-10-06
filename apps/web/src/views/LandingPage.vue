<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';

const router = useRouter();
const authStore = useAuthStore();
const { currentNamespace } = storeToRefs(authStore);

onMounted(() => {
  const namespace = (currentNamespace.value || 'demo').toLowerCase();

  // For demo namespace, redirect to landing view
  if (namespace === 'demo') {
    router.replace('/landing');
  } 
  // For my-org namespace
  else if (namespace === 'my-org') {
    router.replace('/my-org');
  }
  // For saas-* namespaces
  else if (namespace.startsWith('saas-')) {
    router.replace('/saas');
  }
  // Default to landing
  else {
    router.replace('/landing');
  }
});
</script>

<template>
  <div></div>
</template>

<style scoped>
.landing-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
