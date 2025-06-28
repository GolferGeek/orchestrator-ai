import { ref, computed } from 'vue';
import { ApiClient, ApiEndpoint, ApiConfiguration, API_FEATURES } from '../types/api';
import { ApiClient as V1ApiClient } from './clients/apiClient';

// Environment configuration
const DEFAULT_NESTJS_BASE_URL = import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:4000';

// Default API endpoint configuration - only NestJS
const DEFAULT_ENDPOINTS: ApiEndpoint[] = [
  {
    version: 'v1',
    technology: 'typescript-nestjs',
    baseUrl: DEFAULT_NESTJS_BASE_URL,
    name: 'Orchestrator AI API',
    description: 'TypeScript NestJS implementation with A2A agent framework',
    features: [
      API_FEATURES.ORCHESTRATOR,
      API_FEATURES.AGENT_DISCOVERY,
      API_FEATURES.SESSION_MANAGEMENT,
    ],
    isAvailable: true,
  },
];

class ApiManager {
  private _configuration = ref<ApiConfiguration>({
    currentEndpoint: DEFAULT_ENDPOINTS[0], // Default to NestJS
    availableEndpoints: DEFAULT_ENDPOINTS,
    defaultEndpoint: DEFAULT_ENDPOINTS[0], // Default to NestJS
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
      // NestJS uses the V1 API interface
      client = new V1ApiClient(endpoint);
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

  // Version switching removed - only NestJS v1 is supported

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

  // Reset to default configuration
  async resetToDefault(): Promise<void> {
    await this.switchToEndpoint(this._configuration.value.defaultEndpoint);
  }

  // Set authentication token for all clients
  setAuthToken(token: string | null): void {
    for (const client of this._clientInstances.values()) {
      if (client && typeof client.setAuthToken === 'function') {
        client.setAuthToken(token);
      }
    }
    
    // Also set for current client if it exists
    if (this._currentClient.value && typeof this._currentClient.value.setAuthToken === 'function') {
      this._currentClient.value.setAuthToken(token);
    }
  }

  // Clear authentication for all clients
  clearAuth(): void {
    this.setAuthToken(null);
  }
}

// Export singleton instance
export const apiManager = new ApiManager();

// Export for use in composables
export { ApiManager }; 