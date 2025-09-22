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
}

export const videoService = new VideoService();
