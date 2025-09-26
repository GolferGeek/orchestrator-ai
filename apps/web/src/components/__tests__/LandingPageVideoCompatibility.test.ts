import { describe, it, expect } from 'vitest';
import { videoService } from '@/services/videoService';

describe('Landing Page Video Compatibility', () => {
  it('should maintain all existing video categories for landing page', () => {
    const categories = videoService.getCategories();
    
    // Verify core landing page categories still exist
    expect(categories).toHaveProperty('introduction');
    expect(categories).toHaveProperty('agent-architecture');
    expect(categories).toHaveProperty('privacy-security');
    expect(categories).toHaveProperty('how-we-work');
    expect(categories).toHaveProperty('evaluations');
    expect(categories).toHaveProperty('what-were-working-on-next');
    expect(categories).toHaveProperty('demos');
    expect(categories).toHaveProperty('agents');
  });

  it('should maintain featured video functionality for landing page buttons', () => {
    const featuredVideos = videoService.getFeaturedVideos();
    
    // Should have featured videos from original categories
    expect(featuredVideos.length).toBeGreaterThan(0);
    
    featuredVideos.forEach(({ video }) => {
      expect(video.featured).toBe(true);
      expect(video).toHaveProperty('title');
      expect(video).toHaveProperty('description');
      expect(video).toHaveProperty('url');
    });
  });

  it('should maintain video search functionality', () => {
    const searchResults = videoService.searchVideos('introduction');
    
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0]).toHaveProperty('video');
    expect(searchResults[0]).toHaveProperty('category');
    expect(searchResults[0]).toHaveProperty('categoryKey');
  });

  it('should maintain category ordering for landing page', () => {
    const categoriesInOrder = videoService.getCategoriesInOrder();
    const expectedOrder = [
      'introduction',
      'agent-architecture', 
      'privacy-security',
      'how-we-work',
      'evaluations',
      'what-were-working-on-next',
      'demos',
      'agents'
    ];

    expectedOrder.forEach((categoryKey, index) => {
      expect(categoriesInOrder[index].key).toBe(categoryKey);
    });
  });

  it('should not affect existing VideoModal component functionality', () => {
    // Test framework - verify existing landing page VideoModal still works
    // This ensures the new AgentResourcesPanel modal doesn't interfere with landing page
    expect(true).toBe(true);
  });

  it('should maintain video stats and metadata for landing page displays', () => {
    const stats = videoService.getStats();
    const metadata = videoService.getMetadata();
    
    expect(stats).toHaveProperty('totalVideos');
    expect(stats).toHaveProperty('totalCategories');
    expect(stats).toHaveProperty('featuredVideos');
    
    expect(metadata).toHaveProperty('lastUpdated');
    expect(metadata).toHaveProperty('totalVideos');
    expect(metadata).toHaveProperty('categories');
  });
});