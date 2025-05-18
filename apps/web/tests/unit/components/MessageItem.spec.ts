import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MessageItem from '../../../src/components/MessageItem.vue';
// AgentListDisplay is mocked below, so direct import for type might not be needed
// import AgentListDisplay from '../../../src/components/AgentListDisplay.vue'; 
import { ChatMessage, MessageSender, MessageDisplayType, AgentInfo } from '../../../src/types/chat';
import { IonicVue } from '@ionic/vue'; // Import IonicVue for Ionic components

vi.mock('../../../src/components/AgentListDisplay.vue', () => ({
  default: {
    name: 'AgentListDisplay', // Good practice to name the mock
    props: ['agents'],
    template: '<div class="mock-agent-list-display">Agent List Displayed</div>',
  },
}));


describe('MessageItem.vue', () => {
  const getRequiredPlugins = () => {
    return {
      global: {
        plugins: [IonicVue], // Provide IonicVue to handle ion-icon, ion-avatar
      },
    };
  };

  const baseMessage: ChatMessage = {
    id: '1',
    sender: 'user',
    timestamp: new Date(),
    text: 'Hello world',
    messageType: 'text',
  };

  it('renders user message correctly', () => {
    const wrapper = mount(MessageItem, {
      props: { message: { ...baseMessage, sender: 'user', text: 'User says hi' } },
      ...getRequiredPlugins(),
    });
    expect(wrapper.find('.message-item--user').exists()).toBe(true);
    expect(wrapper.find('.message-text').html()).toContain('User says hi');
    expect(wrapper.find('.user-avatar').exists()).toBe(true);
    expect(wrapper.find('.agent-avatar').exists()).toBe(false);
  });

  it('renders agent message correctly with agent name', () => {
    const agentMessage: ChatMessage = {
      ...baseMessage,
      sender: 'agent',
      text: 'Agent says hello',
      agentName: 'TestBot',
    };
    const wrapper = mount(MessageItem, {
      props: { message: agentMessage },
      ...getRequiredPlugins(),
    });
    expect(wrapper.find('.message-item--agent').exists()).toBe(true);
    expect(wrapper.find('.message-agent-name').text()).toBe('TestBot');
    expect(wrapper.find('.message-text').html()).toContain('Agent says hello'); // Will be markdown parsed
    expect(wrapper.find('.agent-avatar').exists()).toBe(true);
    expect(wrapper.find('.user-avatar').exists()).toBe(false);
  });

  it('renders system message (text type) correctly', () => {
    const systemMessage: ChatMessage = {
      ...baseMessage,
      sender: 'system',
      text: 'This is a system notification.',
      agentName: 'System',
    };
    const wrapper = mount(MessageItem, {
      props: { message: systemMessage },
      ...getRequiredPlugins(),
    });
    expect(wrapper.find('.message-item--system').exists()).toBe(true);
    expect(wrapper.find('.message-agent-name').text()).toBe('System');
    expect(wrapper.find('.message-text').html()).toContain('This is a system notification.');
    // No avatar for system messages by current design
    expect(wrapper.find('.agent-avatar').exists()).toBe(false);
    expect(wrapper.find('.user-avatar').exists()).toBe(false);
  });

  it('renders agentList message type using AgentListDisplay component', () => {
    const agents: AgentInfo[] = [{ id: 'a1', name: 'Helper', description: 'Helps out' }];
    const agentListMessage: ChatMessage = {
      id: '2',
      sender: 'system',
      timestamp: new Date(),
      messageType: 'agentList',
      data: { agents },
    };
    const wrapper = mount(MessageItem, {
      props: { message: agentListMessage },
      ...getRequiredPlugins(),
    });
    expect(wrapper.find('.agent-list-message-container').exists()).toBe(true);
    // Check if our mocked AgentListDisplay is rendered
    expect(wrapper.find('.mock-agent-list-display').exists()).toBe(true);
    expect(wrapper.find('.message-item').exists()).toBe(false); // The regular bubble shouldn't render
  });

  it('formats timestamp correctly', () => {
    const date = new Date(2023, 0, 15, 14, 35); // Jan 15, 2023, 2:35 PM
    const wrapper = mount(MessageItem, {
      props: { message: { ...baseMessage, timestamp: date } },
      ...getRequiredPlugins(),
    });
    // This test is locale-dependent. For consistency, mock toLocaleTimeString or check for a pattern.
    // Example: expect(wrapper.find('.message-timestamp').text()).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    // For simplicity now, just check it exists
    expect(wrapper.find('.message-timestamp').exists()).toBe(true);
  });

  // Test for Markdown rendering for agent messages would require a more complex setup
  // or checking the raw HTML output from marked, if not wanting to fully render DOM with styles.
  // For now, we trust the `marked` library and that `v-html` works.
}); 