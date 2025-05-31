import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessagesStore } from '../../../src/stores/messagesStore';
import { useUiStore } from '../../../src/stores/uiStore';
import { useAgentsStore } from '../../../src/stores/agentsStore'; // Import the actual hook for mocking
import * as apiService from '../../../src/services/apiService';
import { AgentInfo } from '../../../src/types/chat';

vi.mock('../../../src/services/apiService', () => ({
  postMessageToOrchestrator: vi.fn(),
  getAvailableAgents: vi.fn(),
}));

vi.mock('../../../src/stores/uiStore', () => ({
  useUiStore: vi.fn(() => ({
    setAppLoading: vi.fn(),
    isAppLoading: false, // Provide default state if accessed as getter
    isPttRecording: false,
    setPttRecording: vi.fn(),
  })),
}));

// Simplified mock for agentsStore
const mockFetchAvailableAgents = vi.fn();
let mockGetAvailableAgents: AgentInfo[] = [];
const mockGetAgentError = null;

vi.mock('../../../src/stores/agentsStore', () => ({
  useAgentsStore: vi.fn(() => ({
    fetchAvailableAgents: mockFetchAvailableAgents,
    getAvailableAgents: mockGetAvailableAgents, // This is a direct property in the mock
    getAgentError: mockGetAgentError,
  })),
}));

describe('Messages Store', () => {
  let messagesStore: ReturnType<typeof useMessagesStore>;
  let mockUiStoreInstance: ReturnType<typeof useUiStore>;
  let mockAgentsStoreInstance: ReturnType<typeof useAgentsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    messagesStore = useMessagesStore();
    mockUiStoreInstance = useUiStore();
    mockAgentsStoreInstance = useAgentsStore(); 

    // Reset shared mock states/spies before each test
    vi.clearAllMocks(); // Clears call history etc. for vi.fn()
    mockFetchAvailableAgents.mockClear();
    mockGetAvailableAgents = []; // Reset the data array
    // If useAgentsStore is called multiple times and needs fresh instance state, re-assign mockAgentsStoreInstance here
    // For now, assuming one instance per test via beforeEach is enough for messagesStore
    vi.mocked(useAgentsStore).mockReturnValue({
        fetchAvailableAgents: mockFetchAvailableAgents,
        getAvailableAgents: mockGetAvailableAgents,
        getAgentError: mockGetAgentError,
    });
    vi.mocked(useUiStore).mockReturnValue({
        setAppLoading: vi.fn(),
        isAppLoading: false,
        isPttRecording: false,
        setPttRecording: vi.fn(),
    });
    mockUiStoreInstance = useUiStore(); // re-get after configuring mockReturnValue
    mockAgentsStoreInstance = useAgentsStore(); // re-get
  });

  it('initializes with an empty messages array', () => {
    expect(messagesStore.getMessages).toEqual([]);
  });

  it('adds a user message', () => {
    messagesStore.addUserMessage('Hello user');
    expect(messagesStore.getMessages.length).toBe(1);
    const msg = messagesStore.getMessages[0];
    expect(msg.text).toBe('Hello user');
    expect(msg.sender).toBe('user');
  });

  it('adds an agent message', () => {
    messagesStore.addAgentMessage('Hello agent', 'TestAgent');
    expect(messagesStore.getMessages.length).toBe(1);
    const msg = messagesStore.getMessages[0];
    expect(msg.text).toBe('Hello agent');
    expect(msg.sender).toBe('agent');
  });

  it('adds a system message for agent list', () => {
    const agents: AgentInfo[] = [{ id: '1', name: 'Agent X', description: 'Desc X' }];
    messagesStore.addAgentListMessage(agents);
    expect(messagesStore.getMessages.length).toBe(1);
    const msg = messagesStore.getMessages[0];
    expect(msg.messageType).toBe('agentList');
    expect(msg.data.agents).toEqual(agents);
  });

  describe('submitMessageToOrchestrator', () => {
    it('adds user message and calls API for normal messages', async () => {
      const mockApiResponse = { query: 'Hi', responses: [{ agent_id: 'bot1', agent_name: 'Bot', text: 'Reply' }] }; 
      vi.mocked(apiService.postMessageToOrchestrator).mockResolvedValue(mockApiResponse);
      
      await messagesStore.submitMessageToOrchestrator('Hi');

      expect(messagesStore.getMessages.length).toBe(2);
      expect(apiService.postMessageToOrchestrator).toHaveBeenCalledWith('Hi');
      expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(true);
      expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(false);
    });

    it('handles agent discovery keywords', async () => {
        const fetchedAgents: AgentInfo[] = [{ id: 'agentA', name: 'Discovery Agent', description: 'Finds things' }];
        mockFetchAvailableAgents.mockResolvedValue(undefined); // Simulate successful fetch
        // Critical: ensure the mockGetAvailableAgents data is what the store will see *after* fetch
        // This means the mock for useAgentsStore needs to provide this data when getAvailableAgents is accessed
        // One way: update the shared mock variable that the mock function closes over.
        mockGetAvailableAgents.splice(0, mockGetAvailableAgents.length, ...fetchedAgents); // Update the array in place

        await messagesStore.submitMessageToOrchestrator('list agents');

        expect(mockFetchAvailableAgents).toHaveBeenCalled();
        expect(apiService.postMessageToOrchestrator).not.toHaveBeenCalled();
        expect(messagesStore.getMessages.length).toBe(2); 
        expect(messagesStore.getMessages[1].messageType).toBe('agentList');
        expect(messagesStore.getMessages[1].data.agents).toEqual(fetchedAgents);
        expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(true);
        expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(false);
    });

    it('handles API error during submission', async () => {
        vi.mocked(apiService.postMessageToOrchestrator).mockRejectedValue(new Error('Network Error'));
        
        await messagesStore.submitMessageToOrchestrator('Problem');

        expect(messagesStore.getMessages.length).toBe(2);
        expect(messagesStore.getMessages[1].text).toBe('Network Error');
        expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(true);
        expect(mockUiStoreInstance.setAppLoading).toHaveBeenCalledWith(false);
    });
  });
}); 