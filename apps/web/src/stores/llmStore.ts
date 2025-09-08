import { defineStore } from 'pinia';
import { 
  Provider, 
  Model, 
  CIDAFMCommand, 
  LLMSelection, 
  LLMPreferencesState,
  CIDAFMOptions 
} from '../types/llm';
import { apiService } from '../services/apiService';
import { sovereignPolicyService } from '../services/sovereignPolicyService';
import { useSovereignPolicyStore } from './sovereignPolicyStore';
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
        providerName: this.selectedProvider?.name,
        modelName: this.selectedModel?.modelName,
        cidafmOptions: Object.keys(cidafmOptions).some(key => cidafmOptions[key as keyof CIDAFMOptions] !== undefined) ? cidafmOptions : undefined,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      };
    },
    // Get models for the currently selected provider
    availableModels(): Model[] {
      if (!this.selectedProvider) return this.models;
      return this.models.filter(model => model.providerName === this.selectedProvider?.name);
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
    getProviderByName: (state) => (name: string): Provider | undefined => {
      return state.providers.find(p => p.name === name);
    },
    // Get model by name
    getModelByName: (state) => (providerName: string, modelName: string): Model | undefined => {
      return state.models.find(m => m.providerName === providerName && m.modelName === modelName);
    },
  },
  actions: {
    // Fetch all providers from API
    async fetchProviders() {
      this.loadingProviders = true;
      this.providerError = undefined;
      try {
        // Use unified API service
        const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:7100';
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${baseUrl}/providers`, {
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
        this.providerError = error instanceof Error ? error.message : 'Failed to fetch providers';
      } finally {
        this.loadingProviders = false;
      }
    },
    // Fetch all models from API with sovereign mode filtering
    async fetchModels() {
      this.loadingModels = true;
      this.modelError = undefined;
      try {
        // Get sovereign policy store to check if we should filter models
        const sovereignPolicyStore = useSovereignPolicyStore();
        const shouldFilterForSovereign = sovereignPolicyStore.effectiveSovereignMode;
        
        // Use sovereign policy service to fetch models with appropriate filtering
        this.models = await sovereignPolicyService.getModels(shouldFilterForSovereign);
        
        console.log(`Fetched ${this.models.length} models (sovereign mode: ${shouldFilterForSovereign})`);
      } catch (error) {
        this.modelError = error instanceof Error ? error.message : 'Failed to fetch models';
        console.error('Error fetching models:', error);
      } finally {
        this.loadingModels = false;
      }
    },
    // Fetch CIDAFM commands from API
    async fetchCIDAFMCommands() {
      this.loadingCommands = true;
      this.commandError = undefined;
      try {
        // Use unified API service
        const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_NESTJS_BASE_URL || 'http://localhost:7100';
        const authToken = localStorage.getItem('authToken');
        const response = await fetch(`${baseUrl}/cidafm/commands`, {
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
        this.commandError = error instanceof Error ? error.message : 'Failed to fetch CIDAFM commands';
      } finally {
        this.loadingCommands = false;
      }
    },
    // Initialize all data
    async initialize(userPreferences?: { preferredProvider?: string; preferredModel?: string }) {
      await Promise.all([
        this.fetchProviders(),
        this.fetchModels(),
        this.fetchCIDAFMCommands(),
      ]);
      
      // Set default selections if available
      if (this.providers.length > 0 && !this.selectedProvider) {
        let targetProvider: string | undefined;
        
        // Use user preferences if provided
        if (userPreferences?.preferredProvider) {
          targetProvider = userPreferences.preferredProvider;
        }
        
        // Find the preferred provider or fall back to defaults
        const preferredProvider = targetProvider ? 
          this.providers.find(p => p.name === targetProvider) : null;
        const ollama = this.providers.find(p => p.name.toLowerCase().includes('ollama'));
        const openai = this.providers.find(p => p.name.toLowerCase().includes('openai'));
        
        this.selectedProvider = preferredProvider || ollama || openai || this.providers[0];
      }
      
      if (this.selectedProvider && this.availableModels.length > 0 && !this.selectedModel) {
        let targetModel: string | undefined;
        
        // Use user preferences if provided
        if (userPreferences?.preferredModel) {
          targetModel = userPreferences.preferredModel;
        }
        
        // Find the preferred model or fall back to defaults
        const preferredModel = targetModel ? 
          this.availableModels.find(m => m.modelName === targetModel) : null;
          
        // Default model priority: user preference > OSS 20G > llama3.2 > thinking models > fallback
        const ossModel = this.availableModels.find(m => 
          m.modelName.includes('gpt-oss:20b') || m.modelName.includes('gpt-oss')
        );
        const llama32Model = this.availableModels.find(m => 
          m.modelName.includes('llama3.2') || m.modelName.includes('llama-3.2')
        );
        const thinkingModel = this.availableModels.find(m => 
          m.modelName.includes('deepseek-r1') ||
          m.modelName.includes('qwq') ||
          m.modelName.includes('qwen') ||
          m.name.toLowerCase().includes('reasoning') ||
          m.name.toLowerCase().includes('thinking')
        );
        // Fallback to GPT models if no preferred models available
        const fallbackModel = this.availableModels.find(m => 
          m.modelName.includes('gpt-4o-mini') || 
          m.modelName.includes('gpt-3.5-turbo')
        );
        
        this.selectedModel = preferredModel || ossModel || llama32Model || thinkingModel || fallbackModel || this.availableModels[0];
      }
    },
    // Set selected provider and clear model if incompatible
    setProvider(provider: Provider) {
      this.selectedProvider = provider;
      // Clear model if it doesn't belong to this provider
      if (this.selectedModel && this.selectedModel.providerName !== provider.name) {
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
      if (!this.selectedProvider || this.selectedProvider.name !== model.providerName) {
        this.selectedProvider = this.getProviderByName(model.providerName);
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
          if (preferences.selectedProviderName) {
            this.selectedProvider = this.getProviderByName(preferences.selectedProviderName);
          }
          if (preferences.selectedProviderName && preferences.selectedModelName) {
            this.selectedModel = this.getModelByName(preferences.selectedProviderName, preferences.selectedModelName);
          }
          this.selectedCIDAFMCommands = preferences.selectedCIDAFMCommands || [];
          this.customModifiers = preferences.customModifiers || [];
          this.temperature = preferences.temperature ?? 0.7;
          this.maxTokens = preferences.maxTokens;
        }
      } catch (error) {
        // Failed to load LLM preferences from localStorage
      }
    },
    // Save preferences to local storage
    saveToLocalStorage() {
      try {
        const preferences = {
          selectedProviderName: this.selectedProvider?.name,
          selectedModelName: this.selectedModel?.modelName,
          selectedCIDAFMCommands: this.selectedCIDAFMCommands,
          customModifiers: this.customModifiers,
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        };
        localStorage.setItem('llm-preferences', JSON.stringify(preferences));
      } catch (error) {
        // Failed to save LLM preferences to localStorage
      }
    },
  },
});