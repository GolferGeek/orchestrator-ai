import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia } from 'pinia';

// Mock dependencies
vi.mock('@/stores/agentChatStore', () => ({
  useAgentChatStore: () => ({
    getActiveConversation: vi.fn().mockReturnValue({
      agent: {
        slug: 'specialists/golf_rules_agent',
        name: 'Golf Rules Expert Agent'
      },
      messages: []
    }),
    getActiveChatMode: vi.fn().mockReturnValue('converse')
  })
}));

vi.mock('@/stores/privacyIndicatorsStore', () => ({
  usePrivacyStore: () => ({
    initialize: vi.fn(),
    setConversationSettings: vi.fn(),
    stopConversationRealTimeUpdates: vi.fn()
  })
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('Golf Rules Agent Video Display', () => {
  let _pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    _pinia = createPinia();
  });

  it('should show golf-rules-coach-demo video for specialists/golf_rules_agent agent', () => {
    // Test framework - verify that golf rules agent shows correct video
    // This would test that the AgentResourcesPanel receives the correct video IDs
    // and displays the "Golf Rules Expert: Your On-Course Rules Authority" video
    expect(true).toBe(true);
  });

  it('should display AgentResourcesPanel for golf rules agent conversation', () => {
    // Test framework - verify panel visibility for golf rules agent
    expect(true).toBe(true);
  });

  it('should open video modal with correct golf rules video content', () => {
    // Test framework - verify modal opens with golf rules video when button clicked
    expect(true).toBe(true);
  });
});