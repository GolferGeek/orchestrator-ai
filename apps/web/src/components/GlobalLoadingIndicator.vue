<template>
  <ion-loading
    :is-open="isLoading"
    :message="loadingMessage"
    :spinner="spinnerType"
    :duration="0"
    :backdrop-dismiss="false"
    @did-dismiss="onDidDismiss"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonLoading } from '@ionic/vue';
import { useLoadingStore } from '../stores/loadingStore';

const loadingStore = useLoadingStore();

const isLoading = computed(() => loadingStore.isLoading);
const loadingMessage = computed(() => loadingStore.message || 'Loading...');
const spinnerType = computed(() => loadingStore.spinnerType || 'dots');

const onDidDismiss = () => {
  // Optional: handle loading dismissed
};
</script>

<style scoped>
/* Custom loading styles if needed */
</style>