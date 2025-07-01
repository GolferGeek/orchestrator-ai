import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import CIDAFMControls from '../../../src/components/CIDAFMControls.vue';
import { useLLMStore } from '../../../src/stores/llmStore';

// Mock the LLM store
vi.mock('../../../src/stores/llmStore', () => ({
  useLLMStore: vi.fn()
}));

describe('CIDAFMControls Component', () => {
  let mockLLMStore: any;

  const mockCIDAFMCommands = [
    {
      id: 'cmd-1',
      name: 'concise',
      type: '^',
      description: 'Make responses more concise',
      example: '^concise Please be brief',
      isBuiltin: true,
      isActive: true,
    },
    {
      id: 'cmd-2',
      name: 'detailed',
      type: '^',
      description: 'Make responses more detailed',
      example: '^detailed Explain in detail',
      isBuiltin: true,
      isActive: true,
    },
    {
      id: 'cmd-3',
      name: 'friendly',
      type: '&',
      description: 'Use a friendly tone',
      example: '&friendly How are you today?',
      isBuiltin: true,
      isActive: true,
    },
    {
      id: 'cmd-4',
      name: 'professional',
      type: '&',
      description: 'Use a professional tone',
      example: '&professional Please provide the report',
      isBuiltin: true,
      isActive: true,
    },
    {
      id: 'cmd-5',
      name: 'execute',
      type: '!',
      description: 'Execute a specific command',
      example: '!execute run_analysis',
      isBuiltin: true,
      isActive: true,
    }
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    
    mockLLMStore = {
      cidafmCommands: mockCIDAFMCommands,
      selectedCIDAFMCommands: [],
      customModifiers: [],
      loadingCommands: false,
      commandError: undefined,
      builtinCommandsByType: {
        '^': mockCIDAFMCommands.filter(cmd => cmd.type === '^'),
        '&': mockCIDAFMCommands.filter(cmd => cmd.type === '&'),
        '!': mockCIDAFMCommands.filter(cmd => cmd.type === '!'),
      },
      fetchCIDAFMCommands: vi.fn(),
      toggleCIDAFMCommand: vi.fn(),
      addCustomModifier: vi.fn(),
      removeCustomModifier: vi.fn(),
      saveToLocalStorage: vi.fn(),
    };

    vi.mocked(useLLMStore).mockReturnValue(mockLLMStore);
  });

  it('should render CIDAFM header with help toggle', () => {
    const wrapper = mount(CIDAFMControls);

    expect(wrapper.find('h3').text()).toBe('Behavior Modifiers (CIDAFM)');
    expect(wrapper.find('.help-toggle').text()).toBe('?');
  });

  it('should toggle help section visibility', async () => {
    const wrapper = mount(CIDAFMControls);

    expect(wrapper.find('.help-section').exists()).toBe(false);
    
    await wrapper.find('.help-toggle').trigger('click');
    
    expect(wrapper.find('.help-section').exists()).toBe(true);
    expect(wrapper.text()).toContain('CIDAFM (Context Import Document + AI Function Module)');
  });

  it('should display help information correctly', async () => {
    const wrapper = mount(CIDAFMControls);
    
    await wrapper.find('.help-toggle').trigger('click');
    
    const helpSection = wrapper.find('.help-section');
    expect(helpSection.text()).toContain('Response Modifiers');
    expect(helpSection.text()).toContain('State Modifiers');
    expect(helpSection.text()).toContain('Execution Commands');
    expect(helpSection.text()).toContain('^');
    expect(helpSection.text()).toContain('&');
    expect(helpSection.text()).toContain('!');
  });

  it('should render command sections by type', () => {
    const wrapper = mount(CIDAFMControls);

    const commandSections = wrapper.findAll('.command-section');
    expect(commandSections).toHaveLength(3); // ^, &, !
    
    const headers = wrapper.findAll('.command-type-header');
    expect(headers[0].text()).toContain('Response Modifiers');
    expect(headers[0].text()).toContain('^');
    expect(headers[1].text()).toContain('State Modifiers');
    expect(headers[1].text()).toContain('&');
    expect(headers[2].text()).toContain('Execution Commands');
    expect(headers[2].text()).toContain('!');
  });

  it('should render command items with checkboxes', () => {
    const wrapper = mount(CIDAFMControls);

    const commandItems = wrapper.findAll('.command-item');
    expect(commandItems.length).toBeGreaterThan(0);
    
    const firstCommand = commandItems[0];
    expect(firstCommand.find('.command-checkbox').exists()).toBe(true);
    expect(firstCommand.find('.command-name').exists()).toBe(true);
    expect(firstCommand.find('.command-description').exists()).toBe(true);
  });

  it('should display command details correctly', () => {
    const wrapper = mount(CIDAFMControls);

    const commandItems = wrapper.findAll('.command-item');
    const conciseCommand = commandItems.find(item => 
      item.find('.command-name').text() === 'concise'
    );
    
    expect(conciseCommand).toBeDefined();
    if (conciseCommand) {
      expect(conciseCommand.find('.command-description').text()).toBe('Make responses more concise');
      expect(conciseCommand.find('.command-example').text()).toContain('^concise Please be brief');
    }
  });

  it('should toggle command selection', async () => {
    const wrapper = mount(CIDAFMControls);

    const firstCheckbox = wrapper.find('.command-checkbox');
    await firstCheckbox.trigger('change');

    expect(mockLLMStore.toggleCIDAFMCommand).toHaveBeenCalled();
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should show active state for selected commands', () => {
    mockLLMStore.selectedCIDAFMCommands = ['concise'];
    const wrapper = mount(CIDAFMControls);

    const commandItems = wrapper.findAll('.command-item');
    const activeCommand = commandItems.find(item => 
      item.classes().includes('active')
    );
    
    expect(activeCommand).toBeDefined();
  });

  it('should render custom modifiers section', () => {
    const wrapper = mount(CIDAFMControls);

    const customSection = wrapper.find('.custom-modifiers-section');
    expect(customSection.exists()).toBe(true);
    expect(customSection.find('h4').text()).toBe('Custom Modifiers');
    expect(customSection.find('.custom-input').exists()).toBe(true);
    expect(customSection.find('.add-button').exists()).toBe(true);
  });

  it('should add custom modifier on button click', async () => {
    const wrapper = mount(CIDAFMControls);

    const input = wrapper.find('.custom-input');
    await input.setValue('be creative');
    
    const addButton = wrapper.find('.add-button');
    await addButton.trigger('click');

    expect(mockLLMStore.addCustomModifier).toHaveBeenCalledWith('be creative');
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should add custom modifier on enter key', async () => {
    const wrapper = mount(CIDAFMControls);

    const input = wrapper.find('.custom-input');
    await input.setValue('be helpful');
    await input.trigger('keyup.enter');

    expect(mockLLMStore.addCustomModifier).toHaveBeenCalledWith('be helpful');
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should disable add button when input is empty', () => {
    const wrapper = mount(CIDAFMControls);

    const addButton = wrapper.find('.add-button');
    expect(addButton.element.disabled).toBe(true);
  });

  it('should display custom modifier tags', () => {
    mockLLMStore.customModifiers = ['be creative', 'be helpful'];
    const wrapper = mount(CIDAFMControls);

    const customTags = wrapper.findAll('.custom-tag');
    expect(customTags).toHaveLength(2);
    expect(customTags[0].text()).toContain('be creative');
    expect(customTags[1].text()).toContain('be helpful');
  });

  it('should remove custom modifier when remove button clicked', async () => {
    mockLLMStore.customModifiers = ['be creative'];
    const wrapper = mount(CIDAFMControls);

    const removeButton = wrapper.find('.remove-tag');
    await removeButton.trigger('click');

    expect(mockLLMStore.removeCustomModifier).toHaveBeenCalledWith('be creative');
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should show active summary when modifiers are selected', () => {
    mockLLMStore.selectedCIDAFMCommands = ['concise'];
    mockLLMStore.customModifiers = ['be creative'];
    
    const wrapper = mount(CIDAFMControls);

    const activeSummary = wrapper.find('.active-summary');
    expect(activeSummary.exists()).toBe(true);
    expect(activeSummary.find('h4').text()).toBe('Active Modifiers');
    
    const activeTags = activeSummary.findAll('.active-tag');
    expect(activeTags).toHaveLength(2); // 1 command + 1 custom modifier
  });

  it('should clear all modifiers when clear button clicked', async () => {
    mockLLMStore.selectedCIDAFMCommands = ['concise'];
    mockLLMStore.customModifiers = ['be creative'];
    
    const wrapper = mount(CIDAFMControls);

    const clearButton = wrapper.find('.clear-button');
    await clearButton.trigger('click');

    // Should directly modify store arrays
    expect(mockLLMStore.selectedCIDAFMCommands).toEqual([]);
    expect(mockLLMStore.customModifiers).toEqual([]);
    expect(mockLLMStore.saveToLocalStorage).toHaveBeenCalled();
  });

  it('should show loading state', () => {
    mockLLMStore.loadingCommands = true;
    const wrapper = mount(CIDAFMControls);

    expect(wrapper.find('.loading-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading behavior modifiers...');
    expect(wrapper.find('.command-sections').exists()).toBe(false);
  });

  it('should show error state', () => {
    mockLLMStore.commandError = 'Failed to load commands';
    const wrapper = mount(CIDAFMControls);

    expect(wrapper.find('.error-state').exists()).toBe(true);
    expect(wrapper.text()).toContain('Error loading commands: Failed to load commands');
  });

  it('should fetch commands on mount if not already loaded', () => {
    mockLLMStore.cidafmCommands = [];
    mount(CIDAFMControls);

    expect(mockLLMStore.fetchCIDAFMCommands).toHaveBeenCalled();
  });

  it('should not fetch commands if already loaded', () => {
    mockLLMStore.cidafmCommands = mockCIDAFMCommands;
    mount(CIDAFMControls);

    expect(mockLLMStore.fetchCIDAFMCommands).not.toHaveBeenCalled();
  });

  it('should return correct command type labels', () => {
    const wrapper = mount(CIDAFMControls);

    // Test the getCommandTypeLabel method
    expect(wrapper.vm.getCommandTypeLabel('^')).toBe('Response Modifiers');
    expect(wrapper.vm.getCommandTypeLabel('&')).toBe('State Modifiers');
    expect(wrapper.vm.getCommandTypeLabel('!')).toBe('Execution Commands');
    expect(wrapper.vm.getCommandTypeLabel('unknown')).toBe('Commands');
  });

  it('should check command selection correctly', () => {
    mockLLMStore.selectedCIDAFMCommands = ['concise', 'friendly'];
    const wrapper = mount(CIDAFMControls);

    expect(wrapper.vm.isCommandSelected('concise')).toBe(true);
    expect(wrapper.vm.isCommandSelected('friendly')).toBe(true);
    expect(wrapper.vm.isCommandSelected('detailed')).toBe(false);
  });
});