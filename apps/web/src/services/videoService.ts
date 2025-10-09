import videosData from '@/data/videos.json';

export interface Video {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: string;
  createdAt: string;
  featured: boolean;
  order: number;
}

export interface VideoCategory {
  title: string;
  description: string;
  order: number;
  videos: Video[];
}

export interface VideosData {
  categoryOrder: string[];
  categories: Record<string, VideoCategory>;
  metadata: {
    lastUpdated: string;
    totalVideos: number;
    categories: number;
  };
}

class VideoService {
  private data: VideosData = videosData;
  // Map agent slugs/names to video IDs (restored from intern work)
  private readonly agentVideoMap: Record<string, string[]> = {
    // Slug-based keys
    'finance/metrics': ['metrics-agent-walkthrough'],
    'marketing/marketing_swarm': ['marketing-swarm-demo'],
    'engineering/requirements_writer': ['requirements-writer-tutorial'],
    'specialists/golf_rules_agent': ['golf-rules-coach-demo'],
    'productivity/jokes_agent': ['jokes-agent-demo'],
    // Name-based keys (normalized to lowercase, spaces to underscore, slashes retained)
    'finance metrics': ['metrics-agent-walkthrough'],
    'marketing swarm': ['marketing-swarm-demo'],
    'requirements writer': ['requirements-writer-tutorial'],
    'golf rules coach': ['golf-rules-coach-demo'],
    'jokes agent': ['jokes-agent-demo'],
  };

  /**
   * Get all video categories in order
   */
  getCategories(): Record<string, VideoCategory> {
    return this.data.categories;
  }

  /**
   * Get categories in the specified order
   */
  getCategoriesInOrder(): Array<{ key: string; category: VideoCategory }> {
    return this.data.categoryOrder.map(key => ({
      key,
      category: this.data.categories[key]
    })).filter(item => item.category); // Filter out any missing categories
  }

  /**
   * Get a specific category by key
   */
  getCategory(categoryKey: string): VideoCategory | null {
    return this.data.categories[categoryKey] || null;
  }

  /**
   * Get all videos from all categories
   */
  getAllVideos(): Video[] {
    const allVideos: Video[] = [];
    Object.values(this.data.categories).forEach(category => {
      allVideos.push(...category.videos);
    });
    return allVideos;
  }

  /**
   * Get videos by a list of IDs, preserving the order of IDs when possible
   */
  getVideosByIds(ids: string[]): Video[] {
    if (!ids || !ids.length) return [];
    const byId: Record<string, Video> = {};
    Object.values(this.data.categories).forEach(category => {
      category.videos.forEach(v => {
        byId[v.id] = v;
      });
    });
    return ids.map(id => byId[id]).filter(Boolean) as Video[];
  }

  /**
   * Get featured videos (used for landing page buttons)
   */
  getFeaturedVideos(): Array<{ categoryKey: string; video: Video; category: VideoCategory }> {
    const featured: Array<{ categoryKey: string; video: Video; category: VideoCategory }> = [];
    
    Object.entries(this.data.categories).forEach(([categoryKey, category]) => {
      const featuredVideo = category.videos.find(video => video.featured);
      if (featuredVideo) {
        featured.push({
          categoryKey,
          video: featuredVideo,
          category
        });
      }
    });
    
    return featured;
  }

  /**
   * Return default/fallback video IDs for agents without explicit mapping
   */
  getDefaultVideoIds(): string[] {
    return ['agent-default-overview'];
  }

  /**
   * Get videos for a specific category (sorted by order)
   */
  getVideosByCategory(categoryKey: string): Video[] {
    const category = this.getCategory(categoryKey);
    if (!category) return [];
    
    return [...category.videos].sort((a, b) => a.order - b.order);
  }

  /**
   * Get a specific video by ID
   */
  getVideoById(videoId: string): { video: Video; category: VideoCategory; categoryKey: string } | null {
    for (const [categoryKey, category] of Object.entries(this.data.categories)) {
      const video = category.videos.find(v => v.id === videoId);
      if (video) {
        return { video, category, categoryKey };
      }
    }
    return null;
  }

  /**
   * Get recent videos (sorted by creation date)
   */
  getRecentVideos(limit: number = 10): Video[] {
    const allVideos = this.getAllVideos();
    return allVideos
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Map agent identifier (slug or name) to video IDs
   */
  getAgentVideoIdsByNameOrSlug(identifier: string): string[] {
    return this.getAgentVideoIds(identifier);
  }

  /**
   * Map agent slug to video IDs (canonical function referenced by tests)
   */
  getAgentVideoIds(agentSlugOrName: string): string[] {
    if (!agentSlugOrName) return [];
    const norm = this.normalizeIdentifier(agentSlugOrName);
    // Exact match
    if (this.agentVideoMap[norm]) {
      return this.agentVideoMap[norm];
    }
    // Try replacing spaces with underscores
    const alt = norm.replace(/\s+/g, '_');
    if (this.agentVideoMap[alt]) {
      return this.agentVideoMap[alt];
    }
    // No mapping
    return [];
  }

  /**
   * Return full video objects for an agent
   */
  getAgentVideos(agentSlugOrName: string): Video[] {
    const ids = this.getAgentVideoIds(agentSlugOrName);
    if (ids.length === 0) return [];
    return this.getVideosByIds(ids);
  }

  /**
   * Search videos by title or description
   */
  searchVideos(query: string): Array<{ video: Video; category: VideoCategory; categoryKey: string }> {
    const results: Array<{ video: Video; category: VideoCategory; categoryKey: string }> = [];
    const searchTerm = query.toLowerCase();

    Object.entries(this.data.categories).forEach(([categoryKey, category]) => {
      category.videos.forEach(video => {
        if (
          video.title.toLowerCase().includes(searchTerm) ||
          video.description.toLowerCase().includes(searchTerm)
        ) {
          results.push({ video, category, categoryKey });
        }
      });
    });

    return results;
  }

  /**
   * Get metadata about the video collection
   */
  getMetadata() {
    return this.data.metadata;
  }

  /**
   * Get video statistics
   */
  getStats() {
    const allVideos = this.getAllVideos();
    const totalDuration = allVideos.reduce((total, video) => {
      const [minutes, seconds] = video.duration.split(':').map(Number);
      return total + (minutes * 60 + seconds);
    }, 0);

    return {
      totalVideos: allVideos.length,
      totalCategories: Object.keys(this.data.categories).length,
      totalDurationSeconds: totalDuration,
      totalDurationFormatted: this.formatDuration(totalDuration),
      featuredVideos: allVideos.filter(v => v.featured).length
    };
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }

  private normalizeIdentifier(value: string): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase();
  }
}

export const videoService = new VideoService();
