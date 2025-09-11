import apiService from './apiService';

export interface GlobalModelConfig {
  provider?: string;
  model?: string;
  parameters?: Record<string, any>;
  default?: { provider: string; model: string; parameters?: Record<string, any> };
  localOnly?: { provider: string; model: string; parameters?: Record<string, any> };
}

export async function fetchGlobalModelConfig() {
  const { data } = await apiService.axiosInstance.get('/system/model-config/global');
  return data;
}

export async function updateGlobalModelConfig(config: GlobalModelConfig) {
  const { data } = await apiService.axiosInstance.put('/system/model-config/global', { config });
  return data;
}

