import { describe, it, expect } from 'vitest';
import { videoService } from '@/services/videoService';

describe('Agent Video Mapping Verification', () => {
  it('should map finance/metrics agent to metrics-agent-walkthrough video', () => {
    const videoIds = videoService.getAgentVideoIds('finance/metrics');
    expect(videoIds).toContain('metrics-agent-walkthrough');
  });

  it('should map marketing/marketing_swarm agent to marketing-swarm-demo video', () => {
    const videoIds = videoService.getAgentVideoIds('marketing/marketing_swarm');
    expect(videoIds).toContain('marketing-swarm-demo');
  });

  it('should map engineering/requirements_writer agent to requirements-writer-tutorial video', () => {
    const videoIds = videoService.getAgentVideoIds('engineering/requirements_writer');
    expect(videoIds).toContain('requirements-writer-tutorial');
  });

  it('should map specialists/golf_rules_agent agent to golf-rules-coach-demo video', () => {
    const videoIds = videoService.getAgentVideoIds('specialists/golf_rules_agent');
    expect(videoIds).toContain('golf-rules-coach-demo');
  });

  it('should map productivity/jokes_agent agent to jokes-agent-demo video', () => {
    const videoIds = videoService.getAgentVideoIds('productivity/jokes_agent');
    expect(videoIds).toContain('jokes-agent-demo');
  });

  it('should return empty array for unmapped agents', () => {
    const videoIds = videoService.getAgentVideoIds('unknown/agent');
    expect(videoIds).toEqual([]);
  });

  it('should provide fallback to agent-default-overview for unmapped agents', () => {
    const fallbackIds = videoService.getDefaultVideoIds();
    expect(fallbackIds).toContain('agent-default-overview');
  });

  it('should return videos with proper metadata for each agent', () => {
    const agents = [
      'finance/metrics',
      'marketing/marketing_swarm', 
      'engineering/requirements_writer',
      'specialists/golf_rules_agent',
      'productivity/jokes_agent'
    ];

    agents.forEach(agentSlug => {
      const videos = videoService.getAgentVideos(agentSlug);
      expect(videos.length).toBeGreaterThan(0);
      
      videos.forEach(video => {
        expect(video).toHaveProperty('id');
        expect(video).toHaveProperty('title');
        expect(video).toHaveProperty('description');
        expect(video).toHaveProperty('url');
        expect(video).toHaveProperty('duration');
        expect(video).toHaveProperty('order');
      });
    });
  });
});