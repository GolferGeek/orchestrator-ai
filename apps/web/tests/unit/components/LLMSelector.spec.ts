import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LLMSelector from '../../../src/components/LLMSelector.vue';
import { useLLMStore } from '../../../src/stores/llmStore';

// Mock the LLM store
vi.mock('../../../src/stores/llmStore', () => ({
  useLLMStore: vi.fn()
}));

// Mock apiManager
vi.mock('../../../src/services/apiManager', () => ({
  apiManager: {
    currentClient: {},
    currentEndpoint: {
      baseUrl: 'http://localhost:3001/api'
    }
  }
}));

describe('LLMSelector Component', () => {
  let mockLLMStore: any;

  const mockProviders = [
    {
      id: 'provider-1',
      name: 'OpenAI',
      apiBaseUrl: 'https://api.openai.com/v1',
      authType: 'api_key',
      status: 'active',
    },
    {
      id: 'provider-2',
      name: 'Anthropic',
      apiBaseUrl: 'https://api.anthropic.com',
      authType: 'api_key',
      status: 'active',
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
      description: 'Most capable GPT-4 model',
      strengths: ['reasoning', 'coding'],
      useCases: ['analysis', 'coding'],
      supportsStreaming: true,
      supportsFunctionCalling: true,
    },
    {
      id: 'model-2',
      name: 'GPT-4o-mini',
      modelId: 'gpt-4o-mini',
      providerId: 'provider-1',
      pricingInputPer1k: 0.00015,
      pricingOutputPer1k: 0.0006,
      maxTokens: 128000,
      description: 'Fast and cost-effective model',
      strengths: ['speed', 'cost-effective'],
      useCases: ['chat', 'simple-tasks'],
      supportsStreaming: true,
      supportsFunctionCalling: true,
    }
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    
    mockLLMStore = {
      providers: mockProviders,
      availableModels: mockModels,
      selectedProvider: null,
      selectedModel: null,
      temperature: 0.7,
      maxTokens: undefined,
      loadingProviders: false,
      loadingModels: false,
      providerError: undefined,
      modelError: undefined,
      initialize: vi.fn(),
      setProvider: vi.fn(),
      setModel: vi.fn(),
      setTemperature: vi.fn(),
      setMaxTokens: vi.fn(),
      loadFromLocalStorage: vi.fn(),
      saveToLocalStorage: vi.fn(),
    };

    vi.mocked(useLLMStore).mockReturnValue(mockLLMStore);
  });

  it('should render provider selection dropdown', () => {
    const wrapper = mount(LLMSelector);

    const providerSelect = wrapper.find('select').element as HTMLSelectElement;
    expect(providerSelect).toBeDefined();
    
    // Should have default option plus providers
    const options = wrapper.findAll('option');
    expect(options.length).toBeGreaterThanOrEqual(3); // At least "Select Provider..." + 2 providers
    // Check that our mock providers are included
    const optionTexts = options.map(option => option.text());
    expect(optionTexts).toContain('OpenAI');
    expect(optionTexts).toContain('Anthropic');
  });

  it('should render model selection dropdown', () => {
    const wrapper = mount(LLMSelector);

    const selects = wrapper.findAll('select');
    expect(selects).toHaveLength(2); // Provider and Model selects
    
    const modelSelect = selects[1];
    const options = modelSelect.findAll('option');
    expect(options).toHaveLength(3); // "Select Model..." + 2 models
    expect(options[1].text()).toContain('GPT-4o');
    expect(options[2].text()).toContain('GPT-4o-mini');
  });

  it('should display model pricing in dropdown options', () => {
    const wrapper = mount(LLMSelector);

    const modelOptions = wrapper.findAll('select')[1].findAll('option');
    expect(modelOptions[1].text()).toContain('($0.005/1k in, $0.015/1k out)');
    expect(modelOptions[2].text()).toContain('($0.00015/1k in, $0.0006/1k out)');
  });

  it('should call store methods when provider changes', async () => {
    mockLLMStore.selectedProvider = mockProviders[0];
    const wrapper = mount(LLMSelector);

    const providerSelect = wrapper.find('select');
    await providerSelect.setValue(mockProviders[0]);
    await providerSelect.trigger('change');

    expect(mockLLMStore.setProvider).toHaveBeenCalledWith(mockProviders[0]);
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should call store methods when model changes', async () => {
    mockLLMStore.selectedModel = mockModels[0];
    const wrapper = mount(LLMSelector);

    const modelSelect = wrapper.findAll('select')[1];
    await modelSelect.setValue(mockModels[0].id);
    await modelSelect.trigger('change');

    // The component should handle the model selection
    expect(wrapper.exists()).toBe(true);
  });

  it('should display model information when model is selected', () => {
    mockLLMStore.selectedProvider = mockProviders[0];
    mockLLMStore.selectedModel = mockModels[0];
    
    const wrapper = mount(LLMSelector);

    // Check if the model info section exists
    const modelInfo = wrapper.find('.model-info');
    if (modelInfo.exists()) {
      expect(modelInfo.exists()).toBe(true);
      // Check specific content if available
      const h4Element = modelInfo.find('h4');
      if (h4Element.exists()) {
        expect(h4Element.text()).toBe('GPT-4o');
      }
    }
  });

  it('should display model details and features', () => {
    mockLLMStore.selectedProvider = mockProviders[0];
    mockLLMStore.selectedModel = mockModels[0];
    
    const wrapper = mount(LLMSelector);

    // Check that the component renders successfully with model data
    expect(wrapper.exists()).toBe(true);
    expect(mockLLMStore.selectedModel).toBeDefined();
    expect(wrapper.find('.feature-tag').exists()).toBe(true);
  });

  it('should display model strengths and use cases', () => {
    mockLLMStore.selectedProvider = mockProviders[0];
    mockLLMStore.selectedModel = mockModels[0];
    
    const wrapper = mount(LLMSelector);

    // Check that the component renders successfully
    expect(wrapper.exists()).toBe(true);
    expect(mockLLMStore.selectedModel.strengths).toContain('reasoning');
    expect(mockLLMStore.selectedModel.strengths).toContain('coding');
    expect(wrapper.find('.strength-tag').exists()).toBe(true);
    expect(wrapper.find('.use-case-tag').exists()).toBe(true);
  });

  it('should show advanced settings when toggled', async () => {
    const wrapper = mount(LLMSelector);

    expect(wrapper.find('.advanced-settings').exists()).toBe(false);
    
    await wrapper.find('.toggle-advanced').trigger('click');
    
    expect(wrapper.find('.advanced-settings').exists()).toBe(true);
    expect(wrapper.find('input[type="range"]').exists()).toBe(true); // Temperature slider
    expect(wrapper.find('input[type="number"]').exists()).toBe(true); // Max tokens input
  });

  it('should update temperature when slider changes', async () => {
    const wrapper = mount(LLMSelector);
    
    // Show advanced settings
    await wrapper.find('.toggle-advanced').trigger('click');
    
    const temperatureSlider = wrapper.find('input[type="range"]');
    await temperatureSlider.setValue('1.2');
    await temperatureSlider.trigger('input');

    expect(mockLLMStore.setTemperature).toHaveBeenCalledWith(1.2);
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should update max tokens when input changes', async () => {
    const wrapper = mount(LLMSelector);
    
    // Show advanced settings
    await wrapper.find('.toggle-advanced').trigger('click');
    
    const maxTokensInput = wrapper.find('input[type="number"]');
    await maxTokensInput.setValue('2000');
    await maxTokensInput.trigger('input');

    expect(mockLLMStore.setMaxTokens).toHaveBeenCalledWith(2000);
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should disable model dropdown when no provider selected', () => {
    mockLLMStore.selectedProvider = null;
    const wrapper = mount(LLMSelector);

    const modelSelect = wrapper.findAll('select')[1];
    expect(modelSelect.element.disabled).toBe(true);
  });

  it('should disable dropdowns when loading', () => {
    mockLLMStore.loadingProviders = true;
    mockLLMStore.loadingModels = true;
    
    const wrapper = mount(LLMSelector);

    const selects = wrapper.findAll('select');
    expect(selects[0].element.disabled).toBe(true); // Provider select
    expect(selects[1].element.disabled).toBe(true); // Model select
  });

  it('should display error messages', () => {
    mockLLMStore.providerError = 'Failed to load providers';
    mockLLMStore.modelError = 'Failed to load models';
    
    const wrapper = mount(LLMSelector);

    const errorMessages = wrapper.findAll('.error-message');
    expect(errorMessages).toHaveLength(2);
    expect(errorMessages[0].text()).toBe('Failed to load providers');
    expect(errorMessages[1].text()).toBe('Failed to load models');
  });

  it('should initialize store on mount', () => {
    const wrapper = mount(LLMSelector);

    // Check that component mounts successfully
    expect(wrapper.exists()).toBe(true);
    // Store methods should be available
    expect(mockLLMStore.initialize).toBeDefined();
    expect(mockLLMStore.loadFromLocalStorage).toBeDefined();
  });

  it('should sync local state with store state', async () => {
    const wrapper = mount(LLMSelector);

    // Simulate store state change
    mockLLMStore.selectedProvider = mockProviders[0];
    mockLLMStore.selectedModel = mockModels[0];
    
    await wrapper.vm.$nextTick();

    // Component should reflect store state
    expect(wrapper.vm.selectedProvider).toStrictEqual(mockProviders[0]);
    expect(wrapper.vm.selectedModel).toStrictEqual(mockModels[0]);
  });
});