import { defineStore } from 'pinia';
import { 
  Provider, 
  Model, 
  CIDAFMCommand, 
  LLMSelection, 
  LLMPreferencesState,
  CIDAFMOptions 
} from '../types/llm';
import { apiManager } from '../services/apiManager';

export const useLLMStore = defineStore('llm', {
  state: (): LLMPreferencesState => ({
    selectedProvider: undefined,
    selectedModel: undefined,
    selectedCIDAFMCommands: [],
    customModifiers: [],
    temperature: 0.7,
    maxTokens: undefined,
    
    providers: [],
    models: [],
    cidafmCommands: [],
    
    loadingProviders: false,
    loadingModels: false,
    loadingCommands: false,
    
    providerError: undefined,
    modelError: undefined,
    commandError: undefined,
  }),

  getters: {
    // Get current LLM selection for API calls
    currentLLMSelection(): LLMSelection {
      const cidafmOptions: CIDAFMOptions = {
        activeStateModifiers: [],
        responseModifiers: [],
        executedCommands: this.selectedCIDAFMCommands,
        customOptions: {
          customModifiers: this.customModifiers,
          temperatureOverride: this.temperature !== 0.7 ? this.temperature : undefined,
          maxTokensOverride: this.maxTokens,
        },
      };

      return {
        providerId: this.selectedProvider?.id,
        modelId: this.selectedModel?.id,
        cidafmOptions: Object.keys(cidafmOptions).some(key => cidafmOptions[key as keyof CIDAFMOptions] !== undefined) ? cidafmOptions : undefined,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      };
    },

    // Get models for the currently selected provider
    availableModels(): Model[] {
      if (!this.selectedProvider) return this.models;
      return this.models.filter(model => model.providerId === this.selectedProvider?.id);
    },

    // Get built-in CIDAFM commands grouped by type
    builtinCommandsByType(): Record<string, CIDAFMCommand[]> {
      const builtin = this.cidafmCommands.filter(cmd => cmd.isBuiltin);
      return builtin.reduce((groups, cmd) => {
        const type = cmd.type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(cmd);
        return groups;
      }, {} as Record<string, CIDAFMCommand[]>);
    },

    // Calculate estimated cost for current selection
    estimatedCostPer1kTokens(): { input: number; output: number } | null {
      if (!this.selectedModel) return null;
      return {
        input: this.selectedModel.pricingInputPer1k || 0,
        output: this.selectedModel.pricingOutputPer1k || 0,
      };
    },

    // Check if current selection is valid
    isValidSelection(): boolean {
      return !!(this.selectedProvider && this.selectedModel);
    },

    // Get provider by ID
    getProviderById: (state) => (id: string): Provider | undefined => {
      return state.providers.find(p => p.id === id);
    },

    // Get model by ID
    getModelById: (state) => (id: string): Model | undefined => {
      return state.models.find(m => m.id === id);
    },
  },

  actions: {
    // Fetch all providers from API
    async fetchProviders() {
      this.loadingProviders = true;
      this.providerError = undefined;

      try {
        const client = apiManager.currentClient;
        if (!client) {
          throw new Error('No API client available');
        }

        // Use the NestJS API endpoint
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${apiManager.currentEndpoint.baseUrl}/providers`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch providers: ${response.statusText}`);
        }

        this.providers = await response.json();
      } catch (error) {
        console.error('Error fetching providers:', error);
        this.providerError = error instanceof Error ? error.message : 'Failed to fetch providers';
      } finally {
        this.loadingProviders = false;
      }
    },

    // Fetch all models from API
    async fetchModels() {
      this.loadingModels = true;
      this.modelError = undefined;

      try {
        const client = apiManager.currentClient;
        if (!client) {
          throw new Error('No API client available');
        }

        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${apiManager.currentEndpoint.baseUrl}/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        this.models = await response.json();
      } catch (error) {
        console.error('Error fetching models:', error);
        this.modelError = error instanceof Error ? error.message : 'Failed to fetch models';
      } finally {
        this.loadingModels = false;
      }
    },

    // Fetch CIDAFM commands from API
    async fetchCIDAFMCommands() {
      this.loadingCommands = true;
      this.commandError = undefined;

      try {
        const client = apiManager.currentClient;
        if (!client) {
          throw new Error('No API client available');
        }

        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${apiManager.currentEndpoint.baseUrl}/cidafm/commands`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch CIDAFM commands: ${response.statusText}`);
        }

        this.cidafmCommands = await response.json();
      } catch (error) {
        console.error('Error fetching CIDAFM commands:', error);
        this.commandError = error instanceof Error ? error.message : 'Failed to fetch CIDAFM commands';
      } finally {
        this.loadingCommands = false;
      }
    },

    // Initialize all data
    async initialize() {
      await Promise.all([
        this.fetchProviders(),
        this.fetchModels(),
        this.fetchCIDAFMCommands(),
      ]);

      // Set default selections if available
      if (this.providers.length > 0 && !this.selectedProvider) {
        // Default to OpenAI if available
        const openai = this.providers.find(p => p.name.toLowerCase().includes('openai'));
        this.selectedProvider = openai || this.providers[0];
      }

      if (this.selectedProvider && this.availableModels.length > 0 && !this.selectedModel) {
        // Default to a reasonable model (gpt-4o-mini if available)
        const defaultModel = this.availableModels.find(m => 
          m.modelId.includes('gpt-4o-mini') || 
          m.modelId.includes('gpt-3.5-turbo')
        );
        this.selectedModel = defaultModel || this.availableModels[0];
      }
    },

    // Set selected provider and clear model if incompatible
    setProvider(provider: Provider) {
      this.selectedProvider = provider;
      
      // Clear model if it doesn't belong to this provider
      if (this.selectedModel && this.selectedModel.providerId !== provider.id) {
        this.selectedModel = undefined;
      }

      // Auto-select first available model for this provider
      if (!this.selectedModel && this.availableModels.length > 0) {
        this.selectedModel = this.availableModels[0];
      }
    },

    // Set selected model
    setModel(model: Model) {
      this.selectedModel = model;
      
      // Ensure provider is also selected
      if (!this.selectedProvider || this.selectedProvider.id !== model.providerId) {
        this.selectedProvider = this.getProviderById(model.providerId);
      }
    },

    // Toggle CIDAFM command selection
    toggleCIDAFMCommand(commandName: string) {
      const index = this.selectedCIDAFMCommands.indexOf(commandName);
      if (index > -1) {
        this.selectedCIDAFMCommands.splice(index, 1);
      } else {
        this.selectedCIDAFMCommands.push(commandName);
      }
    },

    // Add custom modifier
    addCustomModifier(modifier: string) {
      if (modifier.trim() && !this.customModifiers.includes(modifier.trim())) {
        this.customModifiers.push(modifier.trim());
      }
    },

    // Remove custom modifier
    removeCustomModifier(modifier: string) {
      const index = this.customModifiers.indexOf(modifier);
      if (index > -1) {
        this.customModifiers.splice(index, 1);
      }
    },

    // Set temperature
    setTemperature(temperature: number) {
      this.temperature = Math.max(0, Math.min(2, temperature));
    },

    // Set max tokens
    setMaxTokens(maxTokens: number | undefined) {
      this.maxTokens = maxTokens;
    },

    // Reset to defaults
    resetToDefaults() {
      this.selectedCIDAFMCommands = [];
      this.customModifiers = [];
      this.temperature = 0.7;
      this.maxTokens = undefined;
      
      // Keep provider/model selection but reset to first available if none selected
      if (!this.selectedProvider && this.providers.length > 0) {
        const openai = this.providers.find(p => p.name.toLowerCase().includes('openai'));
        this.selectedProvider = openai || this.providers[0];
      }
      
      if (!this.selectedModel && this.availableModels.length > 0) {
        this.selectedModel = this.availableModels[0];
      }
    },

    // Load preferences from local storage
    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem('llm-preferences');
        if (saved) {
          const preferences = JSON.parse(saved);
          
          if (preferences.selectedProviderId) {
            this.selectedProvider = this.getProviderById(preferences.selectedProviderId);
          }
          
          if (preferences.selectedModelId) {
            this.selectedModel = this.getModelById(preferences.selectedModelId);
          }
          
          this.selectedCIDAFMCommands = preferences.selectedCIDAFMCommands || [];
          this.customModifiers = preferences.customModifiers || [];
          this.temperature = preferences.temperature ?? 0.7;
          this.maxTokens = preferences.maxTokens;
        }
      } catch (error) {
        console.warn('Failed to load LLM preferences from localStorage:', error);
      }
    },

    // Save preferences to local storage
    saveToLocalStorage() {
      try {
        const preferences = {
          selectedProviderId: this.selectedProvider?.id,
          selectedModelId: this.selectedModel?.id,
          selectedCIDAFMCommands: this.selectedCIDAFMCommands,
          customModifiers: this.customModifiers,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        };
        
        localStorage.setItem('llm-preferences', JSON.stringify(preferences));
      } catch (error) {
        console.warn('Failed to save LLM preferences to localStorage:', error);
      }
    },
  },
});