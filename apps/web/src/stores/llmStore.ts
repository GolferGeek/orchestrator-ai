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
    // Sovereign mode state
    sovereignMode: false,
    sovereignPolicy: null,
    sovereignLoading: false,
    sovereignError: null,
    // Sanitization stats state
    sanitizationStats: {
      activePatterns: 0,
      pseudonyms: 0,
      protectedToday: 0,
      totalSanitizations: 0,
      cacheHitRate: 0,
      averageProcessingTime: 0
    },
    sanitizationStatsLoading: false,
    sanitizationStatsError: null,
    sanitizationStatsLastUpdated: null,
  }),
  getters: {
    // Effective sovereign mode (policy enforced OR user enabled)
    effectiveSovereignMode: (state) => {
      return state.sovereignPolicy?.enforced || state.sovereignMode;
    },
    
    // Get filtered providers based on sovereign mode
    filteredProviders: (state) => {
      const effectiveMode = state.sovereignPolicy?.enforced || state.sovereignMode;
      if (effectiveMode) {
        // In sovereign mode, only show Ollama providers
        return state.providers.filter(provider => 
          provider.name.toLowerCase() === 'ollama'
        );
      }
      return state.providers;
    },
    
    // Get filtered models based on sovereign mode
    filteredModels: (state) => {
      const effectiveMode = state.sovereignPolicy?.enforced || state.sovereignMode;
      if (effectiveMode) {
        // In sovereign mode, only show Ollama models
        return state.models.filter(model => 
          model.providerName.toLowerCase() === 'ollama'
        );
      }
      return state.models;
    },
    
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
    
    // Get models for the currently selected provider (using filtered models)
    availableModels(): Model[] {
      if (!this.selectedProvider) return this.filteredModels;
      return this.filteredModels.filter(model => model.providerName === this.selectedProvider?.name);
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
    // Get provider by name (from filtered providers)
    getProviderByName(): (name: string) => Provider | undefined {
      return (name: string) => {
        return this.filteredProviders.find(p => p.name === name);
      };
    },
    // Get model by name (from filtered models)
    getModelByName(): (providerName: string, modelName: string) => Model | undefined {
      return (providerName: string, modelName: string) => {
        return this.filteredModels.find(m => m.providerName === providerName && m.modelName === modelName);
      };
    },
    
    // Compute routing mode based on selected provider
    currentRoutingMode: (state) => {
      if (!state.selectedProvider) return 'external';
      
      // Check if provider is Ollama (local)
      if (state.selectedProvider.name.toLowerCase().includes('ollama')) {
        return 'local';
      }
      
      // All other providers are external
      return 'external';
    },
    
    // Compute trust level based on selected provider and model
    currentTrustLevel: (state) => {
      if (!state.selectedProvider || !state.selectedModel) return 'medium';
      
      const providerName = state.selectedProvider.name.toLowerCase();
      const modelName = state.selectedModel.modelName.toLowerCase();
      
      // Local models (Ollama) get high trust
      if (providerName.includes('ollama')) {
        return 'high';
      }
      
      // Well-established providers get medium trust
      if (providerName.includes('openai') || 
          providerName.includes('anthropic') || 
          providerName.includes('google')) {
        return 'medium';
      }
      
      // Other providers get low trust by default
      return 'low';
    },
    
    // Compute trust score based on provider and model
    currentTrustScore: (state) => {
      if (!state.selectedProvider || !state.selectedModel) return null;
      
      const providerName = state.selectedProvider.name.toLowerCase();
      const modelName = state.selectedModel.modelName.toLowerCase();
      
      // Local models get highest trust score
      if (providerName.includes('ollama')) {
        return 95;
      }
      
      // OpenAI models
      if (providerName.includes('openai')) {
        if (modelName.includes('gpt-4')) return 85;
        if (modelName.includes('gpt-3.5')) return 80;
        return 75;
      }
      
      // Anthropic models
      if (providerName.includes('anthropic')) {
        if (modelName.includes('claude-3')) return 85;
        return 80;
      }
      
      // Google models
      if (providerName.includes('google')) {
        return 75;
      }
      
      // Default for other providers
      return 60;
    },

    // Formatted sanitization stats for display
    formattedSanitizationStats: (state) => ({
      activePatterns: state.sanitizationStats.activePatterns.toLocaleString(),
      pseudonyms: state.sanitizationStats.pseudonyms.toLocaleString(),
      protectedToday: state.sanitizationStats.protectedToday.toLocaleString(),
      totalSanitizations: state.sanitizationStats.totalSanitizations.toLocaleString(),
      cacheHitRate: `${(state.sanitizationStats.cacheHitRate * 100).toFixed(1)}%`,
      averageProcessingTime: `${state.sanitizationStats.averageProcessingTime.toFixed(1)}ms`
    }),

    // Check if sanitization stats are stale (older than 5 minutes)
    sanitizationStatsStale: (state) => {
      if (!state.sanitizationStatsLastUpdated) return true;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      return new Date(state.sanitizationStatsLastUpdated) < fiveMinutesAgo;
    },
  },
  actions: {
    // Initialize sovereign mode from localStorage and fetch policy
    async initializeSovereignMode() {
      this.sovereignLoading = true;
      this.sovereignError = null;
      
      try {
        // Load user preference from localStorage
        const savedPreference = localStorage.getItem('sovereignMode');
        if (savedPreference !== null) {
          this.sovereignMode = JSON.parse(savedPreference);
        }
        
        // Fetch corporate policy from backend
        try {
          this.sovereignPolicy = await sovereignPolicyService.getPolicy();
        } catch (error) {
          console.warn('Failed to fetch sovereign policy, using defaults:', error);
          this.sovereignPolicy = { enforced: false };
        }
        
      } catch (error) {
        this.sovereignError = error instanceof Error ? error.message : 'Failed to initialize sovereign mode';
        console.error('Failed to initialize sovereign mode:', error);
      } finally {
        this.sovereignLoading = false;
      }
    },
    
    // Update sovereign mode user preference
    setSovereignMode(enabled: boolean) {
      // If corporate enforces sovereign mode, user can't disable it
      if (this.sovereignPolicy?.enforced && !enabled) {
        throw new Error('Cannot disable sovereign mode - required by organization policy');
      }
      
      const wasEnabled = this.sovereignMode;
      this.sovereignMode = enabled;
      
      // Persist to localStorage
      localStorage.setItem('sovereignMode', JSON.stringify(enabled));
      
      // Handle provider/model selection changes SYNCHRONOUSLY when sovereign mode changes
      if (enabled && !wasEnabled) {
        // Switching TO sovereign mode - immediately set Ollama provider
        console.log('Switching to sovereign mode, setting Ollama provider...');
        
        // Find Ollama provider from the newly filtered providers
        const ollamaProvider = this.filteredProviders.find(p => 
          p.name.toLowerCase().includes('ollama')
        );
        
        if (ollamaProvider) {
          // Set provider immediately
          this.selectedProvider = ollamaProvider;
          
          // Find best Ollama model from the newly filtered models
          const ollamaModels = this.filteredModels.filter(m => 
            m.providerName === ollamaProvider.name
          );
          
          if (ollamaModels.length > 0) {
            // Priority: gpt-oss:20b > gpt-oss > llama3.2 > any available
            const preferredModel = 
              ollamaModels.find(m => m.modelName.includes('gpt-oss:20b')) ||
              ollamaModels.find(m => m.modelName.includes('gpt-oss')) ||
              ollamaModels.find(m => m.modelName.includes('llama3.2')) ||
              ollamaModels[0];
            
            this.selectedModel = preferredModel;
            
            console.log('Switched to sovereign mode:', {
              provider: this.selectedProvider.name,
              model: this.selectedModel.modelName,
              availableModels: ollamaModels.length
            });
          }
        }
      } else if (!enabled && wasEnabled) {
        // Switching FROM sovereign mode - current selection should remain valid
        console.log('Switched from sovereign mode, current selection remains valid');
      }
    },
    // Fetch all providers from API (filtering handled reactively by getters)
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
        
        console.log(`Fetched ${this.providers.length} providers (filtering handled reactively)`);
      } catch (error) {
        this.providerError = error instanceof Error ? error.message : 'Failed to fetch providers';
      } finally {
        this.loadingProviders = false;
      }
    },
    // Fetch all models from API (filtering handled reactively by getters)
    async fetchModels() {
      this.loadingModels = true;
      this.modelError = undefined;
      try {
        // Fetch all models - filtering will be handled reactively by getters
        this.models = await sovereignPolicyService.getModels(false); // Always fetch all models
        
        console.log(`Fetched ${this.models.length} models (filtering handled reactively)`);
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
      if (this.filteredProviders.length > 0 && !this.selectedProvider) {
        let targetProvider: string | undefined;
        
        // Use user preferences if provided
        if (userPreferences?.preferredProvider) {
          targetProvider = userPreferences.preferredProvider;
        }
        
        // Find the preferred provider from filtered providers
        const preferredProvider = targetProvider ? 
          this.filteredProviders.find(p => p.name === targetProvider) : null;
        
        // If user preference is not available in filtered providers, use fallbacks
        const ollama = this.filteredProviders.find(p => p.name.toLowerCase().includes('ollama'));
        const openai = this.filteredProviders.find(p => p.name.toLowerCase().includes('openai'));
        
        this.selectedProvider = preferredProvider || ollama || openai || this.filteredProviders[0];
      }
      
      if (this.selectedProvider && this.filteredModels.length > 0 && !this.selectedModel) {
        let targetModel: string | undefined;
        
        // Use user preferences if provided
        if (userPreferences?.preferredModel) {
          targetModel = userPreferences.preferredModel;
        }
        
        // Get models for the selected provider from filtered models
        const providerModels = this.filteredModels.filter(m => 
          m.providerName === this.selectedProvider?.name
        );
        
        // Find the preferred model from provider's models
        const preferredModel = targetModel ? 
          providerModels.find(m => m.modelName === targetModel) : null;
          
        // Default model priority: user preference > OSS 20B > llama3.2 > thinking models > fallback
        const ossModel = providerModels.find(m => 
          m.modelName.includes('gpt-oss:20b') || m.modelName.includes('gpt-oss')
        );
        const llama32Model = providerModels.find(m => 
          m.modelName.includes('llama3.2') || m.modelName.includes('llama-3.2')
        );
        const thinkingModel = providerModels.find(m => 
          m.modelName.includes('deepseek-r1') ||
          m.modelName.includes('qwq') ||
          m.modelName.includes('qwen') ||
          m.name.toLowerCase().includes('reasoning') ||
          m.name.toLowerCase().includes('thinking')
        );
        // Fallback to GPT models if no preferred models available
        const fallbackModel = providerModels.find(m => 
          m.modelName.includes('gpt-4o-mini') || 
          m.modelName.includes('gpt-3.5-turbo')
        );
        
        this.selectedModel = preferredModel || ossModel || llama32Model || thinkingModel || fallbackModel || providerModels[0];
        
        console.log('LLM Store Initialization:', {
          userPreferences,
          selectedProvider: this.selectedProvider?.name,
          selectedModel: this.selectedModel?.modelName,
          availableProviders: this.filteredProviders.length,
          availableModels: providerModels.length,
          sovereignMode: this.effectiveSovereignMode
        });
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

    // Fetch sanitization stats from API
    async fetchSanitizationStats(force = false) {
      if (this.sanitizationStatsLoading || (!force && !this.sanitizationStatsStale)) {
        return;
      }

      try {
        this.sanitizationStatsLoading = true;
        this.sanitizationStatsError = null;

        const response = await apiService.get('/llm/sanitization/stats');
        const data = response.data;

        // Handle different response structures
        let statsData = data;
        if (data && typeof data === 'object') {
          // If data has nested structure, use it directly
          // If data is the stats object itself, use it
          statsData = data;
        }

        // Transform the comprehensive stats into our simplified format with safe fallbacks
        this.sanitizationStats = {
          activePatterns: statsData?.databaseStats?.activePatterns || 
                         statsData?.activePatterns || 
                         0,
          pseudonyms: statsData?.databaseStats?.activeMappings || 
                     statsData?.activeMappings || 
                     0,
          protectedToday: statsData?.databaseStats?.todaysSanitizations || 
                         statsData?.todaysSanitizations || 
                         0,
          totalSanitizations: statsData?.sanitizationStats?.totalSanitizations || 
                             statsData?.totalSanitizations || 
                             0,
          cacheHitRate: statsData?.cacheStats?.hitRate || 
                       statsData?.hitRate || 
                       0,
          averageProcessingTime: statsData?.sanitizationStats?.averageProcessingTimeMs || 
                                statsData?.averageProcessingTimeMs || 
                                0
        };

        this.sanitizationStatsLastUpdated = new Date().toISOString();
      } catch (error) {
        this.sanitizationStatsError = error instanceof Error ? error.message : 'Failed to fetch sanitization stats';
        console.error('Error fetching sanitization stats:', error);
        
        // Fallback to reasonable defaults on error
        this.sanitizationStats = {
          activePatterns: 0,
          pseudonyms: 0,
          protectedToday: 0,
          totalSanitizations: 0,
          cacheHitRate: 0,
          averageProcessingTime: 0
        };
      } finally {
        this.sanitizationStatsLoading = false;
      }
    },

    // Refresh sanitization stats (force fetch)
    async refreshSanitizationStats() {
      return this.fetchSanitizationStats(true);
    },
  },
});