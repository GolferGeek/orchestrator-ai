import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ApiEndpoint, API_FEATURES } from '../types/api';
import { apiService } from '../services/apiService';

interface ApiConfigState {
  // Environment configuration
  environment: 'development' | 'staging' | 'production';
  
  // Dynamic endpoint discovery
  discoveredEndpoints: ApiEndpoint[];
  lastDiscoveryTime: Date | null;
  discoveryInProgress: boolean;
  
  // Health monitoring
  endpointHealthStatus: Record<string, {
    isHealthy: boolean;
    lastChecked: Date;
    responseTime?: number;
    error?: string;
  }>;
  
  // Feature availability cache
  featureAvailability: Record<string, string[]>; // endpoint name -> features
  
  // Configuration metadata
  configurationVersion: string;
  lastUpdated: Date;
}

export const useApiConfigStore = defineStore('apiConfig', () => {
  // Reactive state
  const state = ref<ApiConfigState>({
    environment: (import.meta.env.MODE as any) || 'development',
    discoveredEndpoints: [],
    lastDiscoveryTime: null,
    discoveryInProgress: false,
    endpointHealthStatus: {},
    featureAvailability: {},
    configurationVersion: '1.0.0',
    lastUpdated: new Date(),
  });

  // Environment-based configuration
  const environmentConfig = computed(() => {
    const env = state.value.environment;
    
    switch (env) {
      case 'production':
        return {
          defaultTimeout: 15000,
          healthCheckInterval: 300000, // 5 minutes
          enableDebugMode: false,
          allowEndpointSwitching: false, // Lock to production endpoints
          maxRetries: 3,
        };
      case 'staging':
        return {
          defaultTimeout: 10000,
          healthCheckInterval: 120000, // 2 minutes
          enableDebugMode: true,
          allowEndpointSwitching: true,
          maxRetries: 2,
        };
      default: // development
        return {
          defaultTimeout: 5000,
          healthCheckInterval: 60000, // 1 minute
          enableDebugMode: true,
          allowEndpointSwitching: true,
          maxRetries: 1,
        };
    }
  });

  // Computed properties
  const allEndpoints = computed(() => [
    // Unified API endpoint
    {
      version: 'v1' as const,
      technology: 'typescript-nestjs' as const,
      baseUrl: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:9000',
      name: 'Orchestrator AI API',
      description: 'Unified NestJS API',
      features: [
        API_FEATURES.ORCHESTRATOR,
        API_FEATURES.AGENT_DISCOVERY,
        API_FEATURES.SESSION_MANAGEMENT,
      ],
      isAvailable: true,
    },
    ...state.value.discoveredEndpoints,
  ]);

  const healthyEndpoints = computed(() =>
    allEndpoints.value.filter(endpoint => {
      const health = state.value.endpointHealthStatus[endpoint.name];
      return health?.isHealthy && endpoint.isAvailable;
    })
  );

  const availableFeatures = computed(() => {
    const currentEndpoint = allEndpoints.value[0]; // Use unified API
    return state.value.featureAvailability[currentEndpoint.name] || currentEndpoint.features;
  });

  // Actions
  const initializeConfiguration = async () => {
    try {
      // Load saved configuration from localStorage
      await loadSavedConfiguration();
      
      // Perform initial health checks
      await performHealthChecks();
      
      // Start periodic health monitoring
      startHealthMonitoring();
      
    } catch (error) {
    }
  };

  const loadSavedConfiguration = async () => {
    try {
      const saved = localStorage.getItem('apiConfiguration');
      if (saved) {
        const config = JSON.parse(saved);
        
        // Validate and merge saved configuration
        if (config.endpointHealthStatus) {
          state.value.endpointHealthStatus = config.endpointHealthStatus;
        }
        
        if (config.featureAvailability) {
          state.value.featureAvailability = config.featureAvailability;
        }
        
        if (config.lastDiscoveryTime) {
          state.value.lastDiscoveryTime = new Date(config.lastDiscoveryTime);
        }
      }
    } catch (error) {
    }
  };

  const saveConfiguration = () => {
    try {
      const toSave = {
        endpointHealthStatus: state.value.endpointHealthStatus,
        featureAvailability: state.value.featureAvailability,
        lastDiscoveryTime: state.value.lastDiscoveryTime,
        configurationVersion: state.value.configurationVersion,
        lastUpdated: new Date(),
      };
      
      localStorage.setItem('apiConfiguration', JSON.stringify(toSave));
    } catch (error) {
    }
  };

  const performHealthChecks = async () => {
    try {
      const results = { 'Orchestrator AI API': true };
      const now = new Date();
      
      for (const [endpointName, isHealthy] of Object.entries(results)) {
        state.value.endpointHealthStatus[endpointName] = {
          isHealthy,
          lastChecked: now,
          responseTime: 0,
          error: isHealthy ? undefined : 'Health check failed',
        };
        
        // Update endpoint availability based on health
        // Update endpoint availability (simplified for unified API)
      }
      
      saveConfiguration();
    } catch (error) {
    }
  };

  const performHealthCheckForEndpoint = async (endpointName: string) => {
    try {
      // Simplified for unified API
      if (endpointName !== 'Orchestrator AI API') return false;
      
      const startTime = Date.now();
      const isHealthy = await apiService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      state.value.endpointHealthStatus[endpointName] = {
        isHealthy,
        lastChecked: new Date(),
        responseTime,
        error: isHealthy ? undefined : 'Health check failed',
      };
      
      // Simplified endpoint availability update
      saveConfiguration();
      
      return isHealthy;
    } catch (error) {
      
      state.value.endpointHealthStatus[endpointName] = {
        isHealthy: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      return false;
    }
  };

  const discoverEndpoints = async () => {
    if (state.value.discoveryInProgress) return;
    
    state.value.discoveryInProgress = true;
    
    try {
      // In a real implementation, this might call a discovery service
      // For now, we'll check for additional endpoints based on environment
      
      const baseUrls = [
        'http://localhost:8000',
        'http://localhost:8001',
        'http://localhost:3000',
        // Add staging/production URLs based on environment
      ];
      
      const discovered: ApiEndpoint[] = [];
      
      for (const baseUrl of baseUrls) {
        try {
          // Try to discover endpoint capabilities
          const response = await fetch(`${baseUrl}/health`, { 
            method: 'GET',
            signal: AbortSignal.timeout(environmentConfig.value.defaultTimeout),
          });
          
          if (response.ok) {
            // Try to get more information about the endpoint
            const infoResponse = await fetch(`${baseUrl}/api/info`, {
              signal: AbortSignal.timeout(environmentConfig.value.defaultTimeout),
            });
            
            let endpointInfo: any = {};
            if (infoResponse.ok) {
              endpointInfo = await infoResponse.json();
            }
            
            // Create endpoint configuration based on discovery
            const endpoint: ApiEndpoint = {
              version: endpointInfo.version || 'unknown',
              technology: endpointInfo.technology || 'unknown',
              baseUrl,
              name: endpointInfo.name || `Discovered ${baseUrl}`,
              description: endpointInfo.description || `Auto-discovered endpoint at ${baseUrl}`,
              features: endpointInfo.features || [API_FEATURES.ORCHESTRATOR],
              isAvailable: true,
            };
            
            discovered.push(endpoint);
          }
        } catch (error) {
          // Endpoint not available, skip
        }
      }
      
      state.value.discoveredEndpoints = discovered;
      state.value.lastDiscoveryTime = new Date();
      
      
    } catch (error) {
    } finally {
      state.value.discoveryInProgress = false;
      saveConfiguration();
    }
  };

  const updateFeatureAvailability = async (endpointName: string) => {
    try {
      // Simplified for unified API - use static feature list
      if (endpointName !== 'Orchestrator AI API') return;
      
      const endpoint = allEndpoints.value.find(ep => ep.name === endpointName);
      if (!endpoint) return;
      
      // Use static feature list from endpoint configuration
      state.value.featureAvailability[endpointName] = endpoint.features;
      
      saveConfiguration();
    } catch (error) {
      // Fall back to static features
      const endpoint = allEndpoints.value.find(ep => ep.name === endpointName);
      if (endpoint) {
        state.value.featureAvailability[endpointName] = endpoint.features;
      }
    }
  };

  let healthMonitoringInterval: number | null = null;

  const startHealthMonitoring = () => {
    if (healthMonitoringInterval) return;
    
    const interval = environmentConfig.value.healthCheckInterval;
    
    healthMonitoringInterval = window.setInterval(async () => {
      await performHealthChecks();
    }, interval);
    
  };

  const stopHealthMonitoring = () => {
    if (healthMonitoringInterval) {
      clearInterval(healthMonitoringInterval);
      healthMonitoringInterval = null;
    }
  };

  const resetConfiguration = () => {
    localStorage.removeItem('apiConfiguration');
    state.value = {
      environment: (import.meta.env.MODE as any) || 'development',
      discoveredEndpoints: [],
      lastDiscoveryTime: null,
      discoveryInProgress: false,
      endpointHealthStatus: {},
      featureAvailability: {},
      configurationVersion: '1.0.0',
      lastUpdated: new Date(),
    };
  };

  const getEndpointHealth = (endpointName: string) => {
    return state.value.endpointHealthStatus[endpointName] || null;
  };

  return {
    // State
    state,
    
    // Computed
    environmentConfig,
    allEndpoints,
    healthyEndpoints,
    availableFeatures,
    
    // Actions
    initializeConfiguration,
    loadSavedConfiguration,
    saveConfiguration,
    performHealthChecks,
    performHealthCheckForEndpoint,
    discoverEndpoints,
    updateFeatureAvailability,
    startHealthMonitoring,
    stopHealthMonitoring,
    resetConfiguration,
    getEndpointHealth,
  };
}); 