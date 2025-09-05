import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import EnhancedChatInput from '../../../src/components/EnhancedChatInput.vue';
import { useLLMStore } from '../../../src/stores/llmStore';
import { useUiStore } from '../../../src/stores/uiStore';

// Mock Ionic components
vi.mock('@ionic/vue', () => ({
  IonTextarea: {
    name: 'IonTextarea',
    template: '<textarea v-bind="$attrs" v-model="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  IonButtons: {
    name: 'IonButtons',
    template: '<div class="ion-buttons"><slot /></div>'
  },
  IonButton: {
    name: 'IonButton',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  },
  IonIcon: {
    name: 'IonIcon',
    template: '<span class="ion-icon" />'
  },
  IonToolbar: {
    name: 'IonToolbar',
    template: '<div class="ion-toolbar"><slot /></div>'
  },
  toastController: {
    create: vi.fn(() => Promise.resolve({
      present: vi.fn()
    }))
  }
}));

// Mock stores
vi.mock('../../../src/stores/llmStore', () => ({
  useLLMStore: vi.fn()
}));

vi.mock('../../../src/stores/uiStore', () => ({
  useUiStore: vi.fn()
}));

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false)
  }
}));

// Mock child components
vi.mock('../../../src/components/LLMSelector.vue', () => ({
  default: {
    name: 'LLMSelector',
    template: '<div class="mock-llm-selector">LLM Selector</div>'
  }
}));

vi.mock('../../../src/components/CIDAFMControls.vue', () => ({
  default: {
    name: 'CIDAFMControls', 
    template: '<div class="mock-cidafm-controls">CIDAFM Controls</div>'
  }
}));

// Mock icons
vi.mock('ionicons/icons', () => ({
  sendOutline: 'send-outline',
  micOutline: 'mic-outline',
  micOffOutline: 'mic-off-outline',
  chevronUpOutline: 'chevron-up-outline'
}));

describe('EnhancedChatInput Component', () => {
  let mockLLMStore: any;
  let mockUiStore: any;

  const mockProvider = {
    id: 'provider-1',
    name: 'OpenAI'
  };

  const mockModel = {
    id: 'model-1',
    name: 'GPT-4o',
    pricingInputPer1k: 0.005,
    pricingOutputPer1k: 0.015
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    
    mockLLMStore = {
      selectedProvider: mockProvider,
      selectedModel: mockModel,
      currentLLMSelection: {
        providerId: 'provider-1',
        modelId: 'model-1',
        temperature: 0.7
      }
    };

    mockUiStore = {
      setPttRecording: vi.fn()
    };

    vi.mocked(useLLMStore).mockReturnValue(mockLLMStore);
    vi.mocked(useUiStore).mockReturnValue(mockUiStore);

    // Mock SpeechRecognition
    const mockSpeechRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      onstart: null,
      onend: null,
      onresult: null,
      onerror: null,
      continuous: false,
      interimResults: false,
      lang: 'en-US'
    };

    Object.defineProperty(window, 'SpeechRecognition', {
      value: vi.fn(() => mockSpeechRecognition),
      writable: true
    });

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: vi.fn(() => mockSpeechRecognition),
      writable: true
    });
  });

  it('should render main chat input elements', () => {
    const wrapper = mount(EnhancedChatInput);

    expect(wrapper.find('.enhanced-chat-input').exists()).toBe(true);
    expect(wrapper.find('.chat-input-toolbar').exists()).toBe(true);
    expect(wrapper.find('.llm-status').exists()).toBe(true);
    expect(wrapper.find('textarea').exists()).toBe(true);
    expect(wrapper.find('.input-buttons').exists()).toBe(true);
  });

  it('should display current LLM selection in status', () => {
    const wrapper = mount(EnhancedChatInput);

    const llmStatus = wrapper.find('.llm-status');
    expect(llmStatus.find('.provider-name').text()).toBe('OpenAI');
    expect(llmStatus.find('.model-name').text()).toBe('GPT-4o');
  });

  it('should show default values when no selection', () => {
    mockLLMStore.selectedProvider = null;
    mockLLMStore.selectedModel = null;
    
    const wrapper = mount(EnhancedChatInput);

    expect(wrapper.find('.provider-name').text()).toBe('Default');
    expect(wrapper.find('.model-name').text()).toBe('GPT-4o-mini');
  });

  it('should toggle LLM panel visibility', async () => {
    const wrapper = mount(EnhancedChatInput);

    expect(wrapper.find('.llm-panel').exists()).toBe(false);
    
    await wrapper.find('.llm-toggle-btn').trigger('click');
    
    expect(wrapper.find('.llm-panel').exists()).toBe(true);
  });

  it('should render LLM panel with tabs', async () => {
    const wrapper = mount(EnhancedChatInput);
    
    await wrapper.find('.llm-toggle-btn').trigger('click');

    expect(wrapper.find('.panel-tabs').exists()).toBe(true);
    
    const tabs = wrapper.findAll('.tab-button');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].text()).toBe('AI Model');
    expect(tabs[1].text()).toBe('Behavior');
  });

  it('should switch between panel tabs', async () => {
    const wrapper = mount(EnhancedChatInput);
    
    await wrapper.find('.llm-toggle-btn').trigger('click');
    
    // Should start with 'model' tab active
    expect(wrapper.vm.activeTab).toBe('model');
    expect(wrapper.find('.mock-llm-selector').exists()).toBe(true);
    expect(wrapper.find('.mock-cidafm-controls').exists()).toBe(false);
    
    // Switch to 'behavior' tab
    const behaviorTab = wrapper.findAll('.tab-button')[1];
    await behaviorTab.trigger('click');
    
    expect(wrapper.vm.activeTab).toBe('behavior');
    expect(wrapper.find('.mock-llm-selector').exists()).toBe(false);
    expect(wrapper.find('.mock-cidafm-controls').exists()).toBe(true);
  });

  it('should close panel when close button clicked', async () => {
    const wrapper = mount(EnhancedChatInput);
    
    await wrapper.find('.llm-toggle-btn').trigger('click');
    expect(wrapper.find('.llm-panel').exists()).toBe(true);
    
    await wrapper.find('.close-panel').trigger('click');
    expect(wrapper.find('.llm-panel').exists()).toBe(false);
  });

  it('should emit sendMessage event with text and LLM selection', async () => {
    const wrapper = mount(EnhancedChatInput);

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello world');
    
    await wrapper.find('.send-button').trigger('click');

    const emittedEvents = wrapper.emitted('sendMessage');
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents?.[0]).toEqual(['Hello world', mockLLMStore.currentLLMSelection]);
  });

  it('should clear input after sending message', async () => {
    const wrapper = mount(EnhancedChatInput);

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello world');
    await wrapper.find('.send-button').trigger('click');

    expect(wrapper.vm.inputText).toBe('');
  });

  it('should handle enter key to send message', async () => {
    const wrapper = mount(EnhancedChatInput);

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello world');
    await textarea.trigger('keydown.enter');

    const emittedEvents = wrapper.emitted('sendMessage');
    expect(emittedEvents).toHaveLength(1);
  });

  it('should allow shift+enter for new line', async () => {
    const wrapper = mount(EnhancedChatInput);

    const textarea = wrapper.find('textarea');
    await textarea.setValue('Hello world');
    await textarea.trigger('keydown.enter', { shiftKey: true });

    // Should not emit sendMessage
    expect(wrapper.emitted('sendMessage')).toBeFalsy();
  });

  it('should disable send button when input is empty', () => {
    const wrapper = mount(EnhancedChatInput);

    const sendButton = wrapper.find('.send-button');
    expect(sendButton.element.disabled).toBe(true);
  });

  it('should enable send button when input has text', async () => {
    const wrapper = mount(EnhancedChatInput);

    await wrapper.find('textarea').setValue('Hello');
    await wrapper.vm.$nextTick();

    const sendButton = wrapper.find('.send-button');
    expect(sendButton.element.disabled).toBe(false);
  });

  it('should calculate and display cost estimate', async () => {
    const wrapper = mount(EnhancedChatInput);

    await wrapper.find('textarea').setValue('This is a test message that should generate a cost estimate');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.cost-estimate').exists()).toBe(true);
    expect(wrapper.find('.cost-estimate').text()).toContain('$');
  });

  it('should handle cost calculation for different input lengths', async () => {
    const wrapper = mount(EnhancedChatInput);

    // Short input
    await wrapper.find('textarea').setValue('Hi');
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.estimatedCost).toBe('< 0.001');

    // Longer input
    const longText = 'This is a much longer message that should generate a higher cost estimate '.repeat(10);
    await wrapper.find('textarea').setValue(longText);
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.estimatedCost).not.toBe('< 0.001');
  });

  it('should handle PTT button toggle', async () => {
    const wrapper = mount(EnhancedChatInput);

    const pttButton = wrapper.find('.ptt-button');
    expect(pttButton.exists()).toBe(true);
    
    await pttButton.trigger('click');

    const emittedEvents = wrapper.emitted('pttToggle');
    if (emittedEvents) {
      expect(emittedEvents).toHaveLength(1);
    }
    expect(mockUiStore.setPttRecording).toHaveBeenCalled();
  });

  it('should disable send button when recording', async () => {
    const wrapper = mount(EnhancedChatInput);

    // Start recording
    wrapper.vm.isRecording = true;
    await wrapper.vm.$nextTick();

    const sendButton = wrapper.find('.send-button');
    expect(sendButton.element.disabled).toBe(true);
  });

  it('should not send message when recording', async () => {
    const wrapper = mount(EnhancedChatInput);

    await wrapper.find('textarea').setValue('Hello');
    wrapper.vm.isRecording = true;
    await wrapper.vm.$nextTick();

    await wrapper.find('textarea').trigger('keydown.enter');

    expect(wrapper.emitted('sendMessage')).toBeFalsy();
  });

  it('should handle speech recognition setup for web platform', () => {
    const wrapper = mount(EnhancedChatInput);

    // Should have set up speech recognition for web
    expect(wrapper.vm.recognition).toBeDefined();
  });

  it('should update UI store when recording state changes', async () => {
    const wrapper = mount(EnhancedChatInput);

    wrapper.vm.isRecording = true;
    await wrapper.vm.$nextTick();

    expect(mockUiStore.setPttRecording).toHaveBeenCalledWith(true);
  });

  it('should clean up speech recognition on unmount', () => {
    const mockRecognition = {
      stop: vi.fn(),
      start: vi.fn(),
      onstart: null,
      onend: null,
      onresult: null,
      onerror: null
    };

    const wrapper = mount(EnhancedChatInput);
    wrapper.vm.recognition = mockRecognition;
    wrapper.vm.isRecording = true;

    wrapper.unmount();

    expect(mockRecognition.stop).toHaveBeenCalled();
  });

  it('should show cost estimate only when enabled', async () => {
    const wrapper = mount(EnhancedChatInput);

    await wrapper.find('textarea').setValue('Hello world');
    await wrapper.vm.$nextTick();

    // Should show by default
    expect(wrapper.find('.cost-estimate').exists()).toBe(true);

    // Hide cost estimate
    wrapper.vm.showCostEstimate = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.cost-estimate').exists()).toBe(false);
  });
});