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
  recordingStatus?: string;
  transcriptId?: string;
  tags?: string[];
  agentDefaults?: string[];
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
  agentDefaults: Record<string, string[]>;
  metadata: {
    lastUpdated: string;
    totalVideos: number;
    categories: number;
  };
}

class VideoService {
  private data: VideosData = videosData;

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
   * Search videos by title, description, tags, or transcript ID
   */
  searchVideos(query: string): Array<{ video: Video; category: VideoCategory; categoryKey: string }> {
    const results: Array<{ video: Video; category: VideoCategory; categoryKey: string }> = [];
    const searchTerm = query.toLowerCase();

    Object.entries(this.data.categories).forEach(([categoryKey, category]) => {
      category.videos.forEach(video => {
        // Search in title and description (existing functionality)
        const titleMatch = video.title.toLowerCase().includes(searchTerm);
        const descriptionMatch = video.description.toLowerCase().includes(searchTerm);
        
        // Search in tags
        const tagMatch = video.tags?.some(tag => 
          tag.toLowerCase().includes(searchTerm)
        ) || false;
        
        // Search in transcript ID
        const transcriptMatch = video.transcriptId?.toLowerCase().includes(searchTerm) || false;
        
        // Search in video ID
        const idMatch = video.id.toLowerCase().includes(searchTerm);

        if (titleMatch || descriptionMatch || tagMatch || transcriptMatch || idMatch) {
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
   * Get videos by their IDs (batch retrieval for agent resources)
   */
  getVideosByIds(videoIds: string[]): Video[] {
    const allVideos = this.getAllVideos();
    return videoIds
      .map(id => allVideos.find(video => video.id === id))
      .filter((video): video is Video => video !== undefined)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Map agent names to their corresponding slugs (mirrors backend mapping)
   */
  private getAgentSlugFromName(agentName: string): string {
    const agentNameToSlugMap: Record<string, string> = {
      'Finance Metrics Agent': 'finance/metrics',
      'Marketing Swarm Agent': 'marketing/marketing_swarm',
      'Requirements Writer Agent': 'engineering/requirements_writer',
      'Rules Of Golf Agent': 'specialists/golf_rules_agent',
      'Rules Of Golf Expert': 'specialists/golf_rules_agent',
      'Golf Rules Agent': 'specialists/golf_rules_agent',
      'Jokes Agent': 'productivity/jokes_agent',
      'Jokes Productivity Agent': 'productivity/jokes_agent',
      // Add more mappings as needed
    };

    // First try exact match
    if (agentNameToSlugMap[agentName]) {
      return agentNameToSlugMap[agentName];
    }

    // Try partial matches for cases where we get partial identifiers like "metrics"
    const partialMatches: Record<string, string> = {
      'metrics': 'finance/metrics',
      'marketing_swarm': 'marketing/marketing_swarm',
      'requirements_writer': 'engineering/requirements_writer',
      'golf_rules_agent': 'specialists/golf_rules_agent',
      'jokes_agent': 'productivity/jokes_agent',
    };

    return partialMatches[agentName.toLowerCase()] || '';
  }

  /**
   * Get video IDs for a specific agent based on agentDefaults mapping
   */
  getAgentVideoIds(agentSlug: string): string[] {
    return this.data.agentDefaults[agentSlug] || [];
  }

  /**
   * Get video IDs for an agent by name or slug
   */
  getAgentVideoIdsByNameOrSlug(agentNameOrSlug: string): string[] {
    console.log('🎬 getAgentVideoIdsByNameOrSlug called with:', agentNameOrSlug);
    
    // First try direct slug lookup
    let videoIds = this.getAgentVideoIds(agentNameOrSlug);
    console.log('🎬 Direct slug lookup result:', videoIds);
    
    // If no videos found, try mapping from name to slug
    if (videoIds.length === 0) {
      const mappedSlug = this.getAgentSlugFromName(agentNameOrSlug);
      console.log('🎬 Mapped slug from name:', mappedSlug);
      if (mappedSlug) {
        videoIds = this.getAgentVideoIds(mappedSlug);
        console.log('🎬 Video IDs after mapping:', videoIds);
      }
    }
    
    console.log('🎬 Final video IDs:', videoIds);
    return videoIds;
  }

  /**
   * Get default fallback video IDs (agent-default-overview)
   */
  getDefaultVideoIds(): string[] {
    return ['agent-default-overview'];
  }

  /**
   * Get videos for an agent with fallback logic
   */
  getAgentVideos(agentSlug: string): Video[] {
    const agentVideoIds = this.getAgentVideoIds(agentSlug);
    
    if (agentVideoIds.length > 0) {
      return this.getVideosByIds(agentVideoIds);
    } else {
      return this.getVideosByIds(this.getDefaultVideoIds());
    }
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

  /**
   * Check if a video has an associated transcript
   */
  hasTranscript(videoId: string): boolean {
    const video = this.getAllVideos().find(v => v.id === videoId);
    return video?.transcriptId !== undefined && video?.transcriptId !== null;
  }

  /**
   * Get transcript ID for a video (defaults to video ID if not explicitly set)
   */
  getTranscriptId(videoId: string): string | null {
    const video = this.getAllVideos().find(v => v.id === videoId);
    if (!video) return null;
    
    // Return explicit transcript ID or default to video ID
    return video.transcriptId || video.id;
  }

  /**
   * Get videos by tags
   */
  getVideosByTags(tags: string[]): Video[] {
    const allVideos = this.getAllVideos();
    return allVideos.filter(video => 
      video.tags && tags.some(tag => video.tags!.includes(tag))
    );
  }

  /**
   * Get videos by recording status
   */
  getVideosByRecordingStatus(status: string): Video[] {
    const allVideos = this.getAllVideos();
    return allVideos.filter(video => video.recordingStatus === status);
  }

  /**
   * Get all unique tags across all videos
   */
  getAllTags(): string[] {
    const allVideos = this.getAllVideos();
    const tagSet = new Set<string>();
    
    allVideos.forEach(video => {
      if (video.tags) {
        video.tags.forEach(tag => tagSet.add(tag));
      }
    });
    
    return Array.from(tagSet).sort();
  }

  /**
   * Get videos that need recording (status is ready_for_recording or in_production)
   */
  getVideosNeedingRecording(): Video[] {
    return this.getVideosByRecordingStatus('ready_for_recording')
      .concat(this.getVideosByRecordingStatus('in_production'));
  }

  /**
   * Get completed videos (status is completed)
   */
  getCompletedVideos(): Video[] {
    return this.getVideosByRecordingStatus('completed');
  }
}

export const videoService = new VideoService();
