import apiService from './apiService';

export interface ProviderWithModels {
  id: string;
  name: string; // provider name like 'openai', 'ollama'
  display_name?: string;
  models: Array<{
    id: string;
    model_name: string; // API model name like 'o4-mini', 'gpt-oss:220b'
    display_name?: string;
    is_active?: boolean;
  }>;
}

export async function fetchProvidersWithModels(options: { status?: 'active' | 'inactive' | 'deprecated'; sovereignMode?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (typeof options.sovereignMode === 'boolean') params.set('sovereign_mode', String(options.sovereignMode));
  const url = `/providers/with-models${params.toString() ? `?${params.toString()}` : ''}`;
  try {
    const data = await apiService.getQuiet(url, [500]);
    return data as ProviderWithModels[];
  } catch {
    // Graceful fallback on error
    return [];
  }
}
