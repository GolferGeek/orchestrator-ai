<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/admin/pii"></ion-back-button>
        </ion-buttons>
        <ion-title>LLM Call Details</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading">Loading...</div>
      <div v-if="error">{{ error }}</div>
      <div v-if="callDetails">
        <!-- Display call details here -->
        <pre>{{ callDetails }}</pre>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent } from '@ionic/vue';
import { apiService } from '@/services/apiService';

const route = useRoute();
const callDetails = ref(null);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  const runId = route.params.runId as string;
  if (runId) {
    loading.value = true;
    try {
      // NOTE: We will need to create this endpoint
      const response = await apiService.get(`/llm/sanitization/llm-usage/${runId}`);
      if (response.success) {
        callDetails.value = response.data;
      } else {
        throw new Error(response.message || 'Failed to fetch call details');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unknown error occurred';
    } finally {
      loading.value = false;
    }
  }
});
</script>
