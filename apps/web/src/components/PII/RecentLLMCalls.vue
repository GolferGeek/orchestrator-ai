<template>
  <div>
    <h2>Recent LLM Calls</h2>
    <div v-if="loading">Loading...</div>
    <div v-if="error">{{ error }}</div>
    <div v-if="calls.length > 0">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Provider</th>
            <th>Model</th>
            <th>Status</th>
            <th>PII Detected</th>
            <th>Pseudonyms Used</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="call in calls" :key="call.run_id" @click="goToDetails(call.run_id)">
            <td>{{ new Date(call.created_at).toLocaleString() }}</td>
            <td>{{ call.provider_name }}</td>
            <td>{{ call.model_name }}</td>
            <td>{{ call.status }}</td>
            <td>{{ call.pii_detected ? 'Yes' : 'No' }}</td>
            <td>{{ call.pseudonyms_used }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiService } from '@/services/apiService';

const router = useRouter();
const calls = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    const response = await apiService.get('/llm/sanitization/llm-usage/recent');
    if (response.success) {
      calls.value = response.data;
    } else {
      throw new Error(response.message || 'Failed to fetch recent calls');
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unknown error occurred';
  } finally {
    loading.value = false;
  }
});

const goToDetails = (runId: string) => {
  router.push({ name: 'LLMUsageDetails', params: { runId } });
};
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #ddd;
  padding: 8px;
}
tr:hover {
  background-color: #f5f5f5;
  cursor: pointer;
}
</style>
