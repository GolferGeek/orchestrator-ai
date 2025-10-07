<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { storeToRefs } from 'pinia';

const router = useRouter();
const authStore = useAuthStore();
const { currentNamespace } = storeToRefs(authStore);

function resolveLandingPath(nsRaw: string | null | undefined): string {
  const ns = (nsRaw || 'demo').toLowerCase();
  const compact = ns.replace(/[^a-z0-9]/g, '');
  if (compact === 'demo') return '/landing';
  if (compact === 'myorg') return '/my-org';
  if (ns === 'saas' || ns.startsWith('saas-') || compact.startsWith('saas')) return '/saas';
  return '/landing';
}

onMounted(() => {
  const target = resolveLandingPath(currentNamespace.value);
  router.replace(target);
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
