import { ref, computed } from 'vue';
import { ApiClient, ApiEndpoint, ApiConfiguration, API_FEATURES } from '../types/api';
import { V1ApiClient } from './clients/v1ApiClient';
import { V2ApiClient } from './clients/v2ApiClient';

// Environment configuration
const DEFAULT_V1_BASE_URL = import.meta.env.VITE_API_V1_BASE_URL || 'http://localhost:8000';
const DEFAULT_V2_BASE_URL = import.meta.env.VITE_API_V2_BASE_URL || 'http://localhost:8001';

// Default API endpoint configurations
const DEFAULT_ENDPOINTS: ApiEndpoint[] = [
  {
    version: 'v1',
    technology: 'python-fastapi',
    baseUrl: DEFAULT_V1_BASE_URL,
    name: 'V1 Python FastAPI',
    description: 'Original Python FastAPI implementation with full agent support',
    features: [
      API_FEATURES.ORCHESTRATOR,
      API_FEATURES.AGENT_DISCOVERY,
      API_FEATURES.SESSION_MANAGEMENT,
    ],
    isAvailable: true,
  },
  {
    version: 'v2',
    technology: 'python-fastapi',
    baseUrl: DEFAULT_V2_BASE_URL,
    name: 'V2 Python FastAPI',
    description: 'Enhanced Python FastAPI with hierarchical agents and improved features',
    features: [
      API_FEATURES.ORCHESTRATOR,
      API_FEATURES.AGENT_DISCOVERY,
      API_FEATURES.SESSION_MANAGEMENT,
      API_FEATURES.HIERARCHICAL_AGENTS,
      API_FEATURES.MULTI_MODAL,
    ],
    isAvailable: true,
  },
  // Future endpoint for NestJS
  {
    version: 'v2',
    technology: 'typescript-nestjs',
    baseUrl: 'http://localhost:3000', // Future NestJS port
    name: 'V2 TypeScript NestJS',
    description: 'TypeScript NestJS implementation with advanced features',
    features: [
      API_FEATURES.ORCHESTRATOR,
      API_FEATURES.AGENT_DISCOVERY,
      API_FEATURES.SESSION_MANAGEMENT,
      API_FEATURES.HIERARCHICAL_AGENTS,
      API_FEATURES.REAL_TIME_CHAT,
      API_FEATURES.MULTI_MODAL,
    ],
    isAvailable: false, // Not implemented yet
  },
];

class ApiManager {
  private _configuration = ref<ApiConfiguration>({
    currentEndpoint: DEFAULT_ENDPOINTS[1], // Default to V2 instead of V1
    availableEndpoints: DEFAULT_ENDPOINTS,
    defaultEndpoint: DEFAULT_ENDPOINTS[1], // Default to V2 instead of V1
  });

  private _currentClient = ref<ApiClient | null>(null);
  private _clientInstances = new Map<string, ApiClient>();

  constructor() {
    this.initializeCurrentClient();
  }

  // Reactive getters
  get configuration() {
    return this._configuration.value;
  }

  get currentClient() {
    return this._currentClient.value;
  }

  get currentEndpoint() {
    return this._configuration.value.currentEndpoint;
  }

  get availableEndpoints() {
    return this._configuration.value.availableEndpoints.filter(endpoint => endpoint.isAvailable);
  }

  // Computed reactive properties
  get isV1() {
    return computed(() => this.currentEndpoint.version === 'v1');
  }

  get isV2() {
    return computed(() => this.currentEndpoint.version === 'v2');
  }

  get supportedFeatures() {
    return computed(() => this.currentEndpoint.features);
  }

  // Initialize the current client based on configuration
  private initializeCurrentClient() {
    const endpoint = this._configuration.value.currentEndpoint;
    this._currentClient.value = this.createClientForEndpoint(endpoint);
  }

  // Create a client instance for a specific endpoint
  private createClientForEndpoint(endpoint: ApiEndpoint): ApiClient {
    const clientKey = `${endpoint.version}-${endpoint.technology}`;
    
    // Return cached instance if it exists
    if (this._clientInstances.has(clientKey)) {
      return this._clientInstances.get(clientKey)!;
    }

    // Create new client instance
    let client: ApiClient;
    
    if (endpoint.version === 'v1') {
      client = new V1ApiClient(endpoint);
    } else if (endpoint.version === 'v2' && endpoint.technology === 'python-fastapi') {
      client = new V2ApiClient(endpoint);
    } else {
      throw new Error(`Unsupported API configuration: ${endpoint.version} with ${endpoint.technology}`);
    }

    // Cache the instance
    this._clientInstances.set(clientKey, client);
    return client;
  }

  // Switch to a different API endpoint
  async switchToEndpoint(endpoint: ApiEndpoint): Promise<void> {
    if (!endpoint.isAvailable) {
      throw new Error(`Endpoint ${endpoint.name} is not available`);
    }

    try {
      // Create client for the new endpoint
      const newClient = this.createClientForEndpoint(endpoint);
      
      // Optionally perform health check
      const isHealthy = await newClient.healthCheck();
      if (!isHealthy) {
        console.warn(`Health check failed for ${endpoint.name}, but proceeding anyway`);
      }

      // Update configuration
      this._configuration.value.currentEndpoint = endpoint;
      this._currentClient.value = newClient;

      console.log(`Switched to API endpoint: ${endpoint.name}`);
    } catch (error) {
      console.error(`Failed to switch to endpoint ${endpoint.name}:`, error);
      throw error;
    }
  }

  // Switch to endpoint by version and technology
  async switchToVersion(version: 'v1' | 'v2', technology?: 'python-fastapi' | 'typescript-nestjs'): Promise<void> {
    const availableEndpoints = this.availableEndpoints;
    let targetEndpoint: ApiEndpoint | undefined;

    if (technology) {
      targetEndpoint = availableEndpoints.find(
        ep => ep.version === version && ep.technology === technology
      );
    } else {
      // Find first available endpoint for the version
      targetEndpoint = availableEndpoints.find(ep => ep.version === version);
    }

    if (!targetEndpoint) {
      throw new Error(`No available endpoint found for version ${version}${technology ? ` with ${technology}` : ''}`);
    }

    await this.switchToEndpoint(targetEndpoint);
  }

  // Check if a feature is supported by the current endpoint
  isFeatureSupported(feature: string): boolean {
    return this.currentClient?.isFeatureSupported(feature) ?? false;
  }

  // Get endpoint by name
  getEndpointByName(name: string): ApiEndpoint | undefined {
    return this._configuration.value.availableEndpoints.find(ep => ep.name === name);
  }

  // Add a new endpoint (useful for dynamic configuration)
  addEndpoint(endpoint: ApiEndpoint): void {
    const endpoints = this._configuration.value.availableEndpoints;
    const existingIndex = endpoints.findIndex(
      ep => ep.version === endpoint.version && ep.technology === endpoint.technology
    );

    if (existingIndex >= 0) {
      endpoints[existingIndex] = endpoint;
    } else {
      endpoints.push(endpoint);
    }
  }

  // Update endpoint availability
  updateEndpointAvailability(name: string, isAvailable: boolean): void {
    const endpoint = this.getEndpointByName(name);
    if (endpoint) {
      endpoint.isAvailable = isAvailable;
    }
  }

  // Perform health checks on all endpoints
  async checkAllEndpointsHealth(): Promise<{ [name: string]: boolean }> {
    const results: { [name: string]: boolean } = {};
    
    for (const endpoint of this._configuration.value.availableEndpoints) {
      if (endpoint.isAvailable) {
        try {
          const client = this.createClientForEndpoint(endpoint);
          results[endpoint.name] = await client.healthCheck();
        } catch (error) {
          results[endpoint.name] = false;
        }
      } else {
        results[endpoint.name] = false;
      }
    }

    return results;
  }

  // Reset to default endpoint
  async resetToDefault(): Promise<void> {
    await this.switchToEndpoint(this._configuration.value.defaultEndpoint);
  }

  // Update authorization token for all client instances
  setAuthToken(token: string | null): void {
    // Update all cached client instances
    this._clientInstances.forEach((client) => {
      if ('setAuthToken' in client) {
        (client as any).setAuthToken(token);
      }
    });

    // Update the current client
    if (this._currentClient.value && 'setAuthToken' in this._currentClient.value) {
      (this._currentClient.value as any).setAuthToken(token);
    }

    console.log(`Auth token ${token ? 'set' : 'cleared'} for all API clients`);
  }

  // Clear authentication for all clients
  clearAuth(): void {
    this.setAuthToken(null);
  }
}

// Create and export singleton instance
export const apiManager = new ApiManager();

// Export for use in composables
export { ApiManager }; 