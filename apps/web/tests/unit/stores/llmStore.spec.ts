import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLLMStore } from '../../../src/stores/llmStore';

// Mock the apiManager
vi.mock('../../../src/services/apiManager', () => ({
  apiManager: {
    currentClient: {},
    currentEndpoint: {
      baseUrl: 'http://localhost:3001/api'
    }
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('LLM Store', () => {
  let llmStore: ReturnType<typeof useLLMStore>;

  const mockProviders = [
    {
      id: 'provider-1',
      name: 'OpenAI',
      apiBaseUrl: 'https://api.openai.com/v1',
      authType: 'api_key',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'provider-2',
      name: 'Anthropic',
      apiBaseUrl: 'https://api.anthropic.com',
      authType: 'api_key',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
  ];

  const mockModels = [
    {
      id: 'model-1',
      name: 'GPT-4o',
      modelId: 'gpt-4o',
      providerId: 'provider-1',
      pricingInputPer1k: 0.005,
      pricingOutputPer1k: 0.015,
      maxTokens: 128000,
      contextWindow: 128000,
      supportsThinking: false,
      strengths: ['reasoning', 'coding'],
      useCases: ['analysis', 'coding'],
      status: 'active'
    },
    {
      id: 'model-2',
      name: 'GPT-4o-mini',
      modelId: 'gpt-4o-mini',
      providerId: 'provider-1',
      pricingInputPer1k: 0.00015,
      pricingOutputPer1k: 0.0006,
      maxTokens: 128000,
      contextWindow: 128000,
      supportsThinking: false,
      strengths: ['speed', 'cost-effective'],
      useCases: ['chat', 'simple-tasks'],
      status: 'active'
    },
    {
      id: 'model-3',
      name: 'Claude 3 Opus',
      modelId: 'claude-3-opus-20240229',
      providerId: 'provider-2',
      pricingInputPer1k: 0.015,
      pricingOutputPer1k: 0.075,
      maxTokens: 4096,
      contextWindow: 200000,
      supportsThinking: false,
      strengths: ['reasoning', 'analysis'],
      useCases: ['research', 'writing'],
      status: 'active'
    }
  ];

  const mockCIDAFMCommands = [
    {
      id: 'cmd-1',
      name: 'concise',
      type: '^',
      description: 'Make responses more concise',
      example: '^concise Please be brief',
      isBuiltin: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'cmd-2',
      name: 'friendly',
      type: '&',
      description: 'Use a friendly tone',
      example: '&friendly How are you today?',
      isBuiltin: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    llmStore = useLLMStore();
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(llmStore.selectedProvider).toBeUndefined();
      expect(llmStore.selectedModel).toBeUndefined();
      expect(llmStore.selectedCIDAFMCommands).toEqual([]);
      expect(llmStore.customModifiers).toEqual([]);
      expect(llmStore.temperature).toBe(0.7);
      expect(llmStore.maxTokens).toBeUndefined();
      expect(llmStore.providers).toEqual([]);
      expect(llmStore.models).toEqual([]);
      expect(llmStore.cidafmCommands).toEqual([]);
      expect(llmStore.loadingProviders).toBe(false);
      expect(llmStore.loadingModels).toBe(false);
      expect(llmStore.loadingCommands).toBe(false);
    });
  });

  describe('Getters', () => {
    beforeEach(() => {
      llmStore.providers = mockProviders;
      llmStore.models = mockModels;
      llmStore.cidafmCommands = mockCIDAFMCommands;
      llmStore.selectedProvider = mockProviders[0];
      llmStore.selectedModel = mockModels[0];
    });

    it('should return current LLM selection', () => {
      llmStore.selectedCIDAFMCommands = ['concise'];
      llmStore.customModifiers = ['be creative'];
      llmStore.temperature = 0.8;
      llmStore.maxTokens = 2000;

      const selection = llmStore.currentLLMSelection;
      
      expect(selection.providerId).toBe('provider-1');
      expect(selection.modelId).toBe('model-1');
      expect(selection.temperature).toBe(0.8);
      expect(selection.maxTokens).toBe(2000);
      expect(selection.cidafmOptions).toBeDefined();
      expect(selection.cidafmOptions?.executedCommands).toEqual(['concise']);
      expect(selection.cidafmOptions?.customOptions?.customModifiers).toEqual(['be creative']);
    });

    it('should return available models for selected provider', () => {
      const availableModels = llmStore.availableModels;
      
      expect(availableModels).toHaveLength(2);
      expect(availableModels.every(m => m.providerId === 'provider-1')).toBe(true);
    });

    it('should return all models when no provider selected', () => {
      llmStore.selectedProvider = undefined;
      
      const availableModels = llmStore.availableModels;
      
      expect(availableModels).toHaveLength(3);
    });

    it('should group builtin commands by type', () => {
      const grouped = llmStore.builtinCommandsByType;
      
      expect(grouped).toHaveProperty('^');
      expect(grouped).toHaveProperty('&');
      expect(grouped['^']).toHaveLength(1);
      expect(grouped['&']).toHaveLength(1);
      expect(grouped['^'][0].name).toBe('concise');
      expect(grouped['&'][0].name).toBe('friendly');
    });

    it('should calculate estimated cost per 1k tokens', () => {
      const cost = llmStore.estimatedCostPer1kTokens;
      
      expect(cost).toEqual({
        input: 0.005,
        output: 0.015
      });
    });

    it('should check if selection is valid', () => {
      expect(llmStore.isValidSelection).toBe(true);
      
      llmStore.selectedModel = undefined;
      expect(llmStore.isValidSelection).toBe(false);
    });

    it('should get provider by ID', () => {
      const provider = llmStore.getProviderById('provider-2');
      expect(provider?.name).toBe('Anthropic');
    });

    it('should get model by ID', () => {
      const model = llmStore.getModelById('model-2');
      expect(model?.name).toBe('GPT-4o-mini');
    });
  });

  describe('API Actions', () => {
    it('should fetch providers successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProviders,
      } as Response);

      await llmStore.fetchProviders();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9000/providers',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(llmStore.providers).toEqual(mockProviders);
      expect(llmStore.loadingProviders).toBe(false);
      expect(llmStore.providerError).toBeUndefined();
    });

    it('should handle provider fetch errors', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error',
      } as Response);

      await llmStore.fetchProviders();

      expect(llmStore.providers).toEqual([]);
      expect(llmStore.loadingProviders).toBe(false);
      expect(llmStore.providerError).toBe('Failed to fetch providers: Server Error');
    });

    it('should fetch models successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockModels,
      } as Response);

      await llmStore.fetchModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9000/models',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(llmStore.models).toEqual(mockModels);
      expect(llmStore.loadingModels).toBe(false);
      expect(llmStore.modelError).toBeUndefined();
    });

    it('should fetch CIDAFM commands successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCIDAFMCommands,
      } as Response);

      await llmStore.fetchCIDAFMCommands();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:9000/cidafm/commands',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(llmStore.cidafmCommands).toEqual(mockCIDAFMCommands);
      expect(llmStore.loadingCommands).toBe(false);
      expect(llmStore.commandError).toBeUndefined();
    });

    it('should initialize and set defaults', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockImplementation((url) => {
        if (url?.toString().includes('/providers')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockProviders,
          } as Response);
        }
        if (url?.toString().includes('/models')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockModels,
          } as Response);
        }
        if (url?.toString().includes('/cidafm/commands')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCIDAFMCommands,
          } as Response);
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await llmStore.initialize();

      expect(llmStore.providers).toEqual(mockProviders);
      expect(llmStore.models).toEqual(mockModels);
      expect(llmStore.cidafmCommands).toEqual(mockCIDAFMCommands);
      expect(llmStore.selectedProvider?.name).toBe('OpenAI'); // Should default to OpenAI
      expect(llmStore.selectedModel?.modelId).toBe('gpt-4o-mini'); // Should default to mini
    });
  });

  describe('Selection Actions', () => {
    beforeEach(() => {
      llmStore.providers = mockProviders;
      llmStore.models = mockModels;
    });

    it('should set provider and clear incompatible model', () => {
      llmStore.selectedModel = mockModels[2]; // Claude model
      
      llmStore.setProvider(mockProviders[0]); // OpenAI provider
      
      expect(llmStore.selectedProvider).toStrictEqual(mockProviders[0]);
      expect(llmStore.selectedModel).toBeUndefined(); // Should be cleared
    });

    it('should set provider and keep compatible model', () => {
      llmStore.selectedModel = mockModels[0]; // OpenAI model
      
      llmStore.setProvider(mockProviders[0]); // OpenAI provider
      
      expect(llmStore.selectedProvider).toStrictEqual(mockProviders[0]);
      expect(llmStore.selectedModel).toStrictEqual(mockModels[0]); // Should be kept
    });

    it('should auto-select first model when setting provider', () => {
      llmStore.setProvider(mockProviders[1]); // Anthropic
      
      expect(llmStore.selectedProvider).toStrictEqual(mockProviders[1]);
      expect(llmStore.selectedModel).toStrictEqual(mockModels[2]); // Claude model
    });

    it('should set model and ensure provider is selected', () => {
      llmStore.setModel(mockModels[2]); // Claude model
      
      expect(llmStore.selectedModel).toStrictEqual(mockModels[2]);
      expect(llmStore.selectedProvider).toStrictEqual(mockProviders[1]); // Anthropic provider
    });
  });

  describe('CIDAFM Actions', () => {
    it('should toggle CIDAFM commands', () => {
      llmStore.toggleCIDAFMCommand('concise');
      expect(llmStore.selectedCIDAFMCommands).toContain('concise');
      
      llmStore.toggleCIDAFMCommand('concise');
      expect(llmStore.selectedCIDAFMCommands).not.toContain('concise');
    });

    it('should add custom modifiers', () => {
      llmStore.addCustomModifier('be creative');
      expect(llmStore.customModifiers).toContain('be creative');
      
      // Should not add duplicates
      llmStore.addCustomModifier('be creative');
      expect(llmStore.customModifiers).toHaveLength(1);
    });

    it('should remove custom modifiers', () => {
      llmStore.customModifiers = ['be creative', 'be helpful'];
      
      llmStore.removeCustomModifier('be creative');
      expect(llmStore.customModifiers).toEqual(['be helpful']);
    });
  });

  describe('Parameter Actions', () => {
    it('should set temperature within bounds', () => {
      llmStore.setTemperature(1.5);
      expect(llmStore.temperature).toBe(1.5);
      
      llmStore.setTemperature(-0.5);
      expect(llmStore.temperature).toBe(0);
      
      llmStore.setTemperature(3.0);
      expect(llmStore.temperature).toBe(2);
    });

    it('should set max tokens', () => {
      llmStore.setMaxTokens(1000);
      expect(llmStore.maxTokens).toBe(1000);
      
      llmStore.setMaxTokens(undefined);
      expect(llmStore.maxTokens).toBeUndefined();
    });
  });

  describe('Local Storage', () => {
    const mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      vi.clearAllMocks();
    });

    it('should save preferences to localStorage', () => {
      llmStore.providers = mockProviders;
      llmStore.models = mockModels;
      llmStore.selectedProvider = mockProviders[0];
      llmStore.selectedModel = mockModels[0];
      llmStore.selectedCIDAFMCommands = ['concise'];
      llmStore.customModifiers = ['be creative'];
      llmStore.temperature = 0.8;
      llmStore.maxTokens = 2000;

      llmStore.saveToLocalStorage();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'llm-preferences',
        JSON.stringify({
          selectedProviderId: 'provider-1',
          selectedModelId: 'model-1',
          selectedCIDAFMCommands: ['concise'],
          customModifiers: ['be creative'],
          temperature: 0.8,
          maxTokens: 2000,
        })
      );
    });

    it('should load preferences from localStorage', () => {
      llmStore.providers = mockProviders;
      llmStore.models = mockModels;
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        selectedProviderId: 'provider-1',
        selectedModelId: 'model-1',
        selectedCIDAFMCommands: ['concise'],
        customModifiers: ['be creative'],
        temperature: 0.8,
        maxTokens: 2000,
      }));

      llmStore.loadFromLocalStorage();

      expect(llmStore.selectedProvider).toStrictEqual(mockProviders[0]);
      expect(llmStore.selectedModel).toStrictEqual(mockModels[0]);
      expect(llmStore.selectedCIDAFMCommands).toEqual(['concise']);
      expect(llmStore.customModifiers).toEqual(['be creative']);
      expect(llmStore.temperature).toBe(0.8);
      expect(llmStore.maxTokens).toBe(2000);
    });

    it('should reset to defaults', () => {
      llmStore.providers = mockProviders;
      llmStore.models = mockModels;
      llmStore.selectedCIDAFMCommands = ['concise'];
      llmStore.customModifiers = ['be creative'];
      llmStore.temperature = 0.8;
      llmStore.maxTokens = 2000;

      llmStore.resetToDefaults();

      expect(llmStore.selectedCIDAFMCommands).toEqual([]);
      expect(llmStore.customModifiers).toEqual([]);
      expect(llmStore.temperature).toBe(0.7);
      expect(llmStore.maxTokens).toBeUndefined();
      expect(llmStore.selectedProvider?.name).toBe('OpenAI'); // Should set default
    });
  });
});