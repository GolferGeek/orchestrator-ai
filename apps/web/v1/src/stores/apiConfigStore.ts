import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ApiEndpoint, ApiConfiguration, API_FEATURES } from '../types/api';
import { apiManager } from '../services/apiManager';

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
    ...apiManager.configuration.availableEndpoints,
    ...state.value.discoveredEndpoints,
  ]);

  const healthyEndpoints = computed(() =>
    allEndpoints.value.filter(endpoint => {
      const health = state.value.endpointHealthStatus[endpoint.name];
      return health?.isHealthy && endpoint.isAvailable;
    })
  );

  const availableFeatures = computed(() => {
    const currentEndpoint = apiManager.currentEndpoint;
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
      
      console.log('API configuration initialized');
    } catch (error) {
      console.error('Failed to initialize API configuration:', error);
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
      console.warn('Failed to load saved configuration:', error);
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
      console.warn('Failed to save configuration:', error);
    }
  };

  const performHealthChecks = async () => {
    try {
      const results = await apiManager.checkAllEndpointsHealth();
      const now = new Date();
      
      for (const [endpointName, isHealthy] of Object.entries(results)) {
        state.value.endpointHealthStatus[endpointName] = {
          isHealthy,
          lastChecked: now,
          error: isHealthy ? undefined : 'Health check failed',
        };
        
        // Update endpoint availability based on health
        apiManager.updateEndpointAvailability(endpointName, isHealthy);
      }
      
      saveConfiguration();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const performHealthCheckForEndpoint = async (endpointName: string) => {
    try {
      const endpoint = apiManager.getEndpointByName(endpointName);
      if (!endpoint) return false;
      
      const startTime = Date.now();
      const client = apiManager['createClientForEndpoint'](endpoint);
      const isHealthy = await client.healthCheck();
      const responseTime = Date.now() - startTime;
      
      state.value.endpointHealthStatus[endpointName] = {
        isHealthy,
        lastChecked: new Date(),
        responseTime,
        error: isHealthy ? undefined : 'Health check failed',
      };
      
      apiManager.updateEndpointAvailability(endpointName, isHealthy);
      saveConfiguration();
      
      return isHealthy;
    } catch (error) {
      console.error(`Health check failed for ${endpointName}:`, error);
      
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
          console.debug(`Discovery failed for ${baseUrl}:`, error);
        }
      }
      
      state.value.discoveredEndpoints = discovered;
      state.value.lastDiscoveryTime = new Date();
      
      console.log(`Discovered ${discovered.length} endpoints`);
      
    } catch (error) {
      console.error('Endpoint discovery failed:', error);
    } finally {
      state.value.discoveryInProgress = false;
      saveConfiguration();
    }
  };

  const updateFeatureAvailability = async (endpointName: string) => {
    try {
      const endpoint = apiManager.getEndpointByName(endpointName);
      if (!endpoint) return;
      
      // For V2 APIs, try to get dynamic feature list
      if (endpoint.version === 'v2') {
        const client = apiManager['createClientForEndpoint'](endpoint);
        if ('getApiCapabilities' in client) {
          const capabilities = await (client as any).getApiCapabilities();
          state.value.featureAvailability[endpointName] = capabilities;
        }
      } else {
        // Use static feature list
        state.value.featureAvailability[endpointName] = endpoint.features;
      }
      
      saveConfiguration();
    } catch (error) {
      console.warn(`Failed to update feature availability for ${endpointName}:`, error);
      // Fall back to static features
      const endpoint = apiManager.getEndpointByName(endpointName);
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
    
    console.log(`Started health monitoring with ${interval}ms interval`);
  };

  const stopHealthMonitoring = () => {
    if (healthMonitoringInterval) {
      clearInterval(healthMonitoringInterval);
      healthMonitoringInterval = null;
      console.log('Stopped health monitoring');
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