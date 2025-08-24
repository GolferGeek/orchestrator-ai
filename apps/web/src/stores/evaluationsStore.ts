import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { evaluationService } from '@/services/evaluationService';
import type { 
  EvaluationWithMessage, 
  AllEvaluationsFilters, 
  AllEvaluationsResponse 
} from '@/types/evaluation';
export const useEvaluationsStore = defineStore('evaluations', () => {
  // State
  const evaluations = ref<EvaluationWithMessage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const filters = ref<AllEvaluationsFilters>({
    page: 1,
    limit: 20
  });
  // Computed
  const hasEvaluations = computed(() => evaluations.value.length > 0);
  const hasMorePages = computed(() => pagination.value.page < pagination.value.totalPages);
  const currentPageInfo = computed(() => 
    `${pagination.value.page} of ${pagination.value.totalPages}`
  );
  // Actions
  async function fetchEvaluations(newFilters?: Partial<AllEvaluationsFilters>) {
    try {
      isLoading.value = true;
      error.value = null;
      // Update filters if provided
      if (newFilters) {
        filters.value = { ...filters.value, ...newFilters };
      }
      const response: AllEvaluationsResponse = 
        await evaluationService.getAllUserEvaluations(filters.value);
      evaluations.value = response.evaluations;
      pagination.value = response.pagination;
    } catch (err) {

      error.value = err instanceof Error ? err.message : 'Failed to fetch evaluations';
      evaluations.value = [];
    } finally {
      isLoading.value = false;
    }
  }
  async function loadNextPage() {
    if (!hasMorePages.value || isLoading.value) return;
    await fetchEvaluations({ page: pagination.value.page + 1 });
  }
  async function loadPreviousPage() {
    if (pagination.value.page <= 1 || isLoading.value) return;
    await fetchEvaluations({ page: pagination.value.page - 1 });
  }
  async function goToPage(page: number) {
    if (page < 1 || page > pagination.value.totalPages || isLoading.value) return;
    await fetchEvaluations({ page });
  }
  async function applyFilters(newFilters: Partial<AllEvaluationsFilters>) {
    // Reset to first page when applying new filters
    await fetchEvaluations({ ...newFilters, page: 1 });
  }
  function clearFilters() {
    filters.value = { page: 1, limit: 20 };
    fetchEvaluations();
  }
  function refreshEvaluations() {
    fetchEvaluations();
  }
  function getEvaluationById(id: string): EvaluationWithMessage | undefined {
    return evaluations.value.find(evaluation => evaluation.id === id);
  }
  // Reset store state
  function reset() {
    evaluations.value = [];
    isLoading.value = false;
    error.value = null;
    pagination.value = {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    };
    filters.value = {
      page: 1,
      limit: 20
    };
  }
  return {
    // State
    evaluations,
    isLoading,
    error,
    pagination,
    filters,
    // Computed
    hasEvaluations,
    hasMorePages,
    currentPageInfo,
    // Actions
    fetchEvaluations,
    loadNextPage,
    loadPreviousPage,
    goToPage,
    applyFilters,
    clearFilters,
    refreshEvaluations,
    getEvaluationById,
    reset
  };
});