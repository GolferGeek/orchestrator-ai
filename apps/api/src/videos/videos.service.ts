import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CreateVideoDto } from './dto/create-video.dto';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);
  private readonly videosJsonPath = path.join(
    __dirname,
    '../../../web/src/data/videos.json',
  );
  private readonly videoTextsJsonPath = path.join(
    __dirname,
    '../../../web/src/data/videoTexts.json',
  );

  /**
   * Get all videos data
   */
  async getVideos() {
    try {
      const data = await fs.readFile(this.videosJsonPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        `Failed to read videos.json: ${(error as Error).message}`,
      );
      throw new NotFoundException('Videos data not found');
    }
  }

  /**
   * Get all video categories for dropdown
   */
  async getCategories() {
    const videosData = await this.getVideos();
    return videosData.categoryOrder.map((categoryKey: string) => ({
      key: categoryKey,
      title: videosData.categories[categoryKey]?.title || categoryKey,
      description: videosData.categories[categoryKey]?.description || '',
    }));
  }

  /**
   * Get video transcripts metadata
   */
  async getVideoTexts() {
    try {
      const data = await fs.readFile(this.videoTextsJsonPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        `Failed to read videoTexts.json: ${(error as Error).message}`,
      );
      // Return empty structure if file doesn't exist
      return {
        transcripts: {},
        metadata: {
          lastUpdated: new Date().toISOString().split('T')[0],
          totalTranscripts: 0,
          languages: ['en'],
          statuses: ['pending', 'available', 'needs_review'],
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Get transcript content by video ID
   */
  async getTranscript(videoId: string) {
    const videoTexts = await this.getVideoTexts();
    const transcript = videoTexts.transcripts[videoId];

    if (!transcript) {
      throw new NotFoundException(`Transcript not found for video: ${videoId}`);
    }

    try {
      const transcriptPath = path.join(
        __dirname,
        '../../../web/src/data',
        transcript.filePath,
      );
      const content = await fs.readFile(transcriptPath, 'utf-8');

      return {
        ...transcript,
        content,
      };
    } catch (error) {
      this.logger.error(
        `Failed to read transcript file: ${(error as Error).message}`,
      );
      throw new NotFoundException(
        `Transcript content not available for video: ${videoId}`,
      );
    }
  }

  /**
   * Create or update a video
   */
  async createVideo(createVideoDto: CreateVideoDto) {
    const videosData = await this.getVideos();

    // Validate category exists
    if (!videosData.categories[createVideoDto.categoryKey]) {
      throw new BadRequestException(
        `Invalid category: ${createVideoDto.categoryKey}`,
      );
    }

    // Check if video ID already exists
    const existingVideo = this.findVideoById(videosData, createVideoDto.id);
    if (existingVideo) {
      throw new BadRequestException(
        `Video with ID '${createVideoDto.id}' already exists`,
      );
    }

    // Create video object
    const newVideo = {
      id: createVideoDto.id,
      title: createVideoDto.title,
      description: createVideoDto.description,
      url: createVideoDto.url,
      duration: createVideoDto.duration,
      createdAt: createVideoDto.createdAt,
      featured: createVideoDto.featured || false,
      order: createVideoDto.order,
      ...(createVideoDto.recordingStatus && {
        recordingStatus: createVideoDto.recordingStatus,
      }),
      ...(createVideoDto.transcriptId && {
        transcriptId: createVideoDto.transcriptId,
      }),
    };

    // Add video to category
    videosData.categories[createVideoDto.categoryKey].videos.push(newVideo);

    // Sort videos by order within category
    videosData.categories[createVideoDto.categoryKey].videos.sort(
      (a: any, b: any) => a.order - b.order,
    );

    // Update agent defaults if provided
    if (
      createVideoDto.agentDefaults &&
      createVideoDto.agentDefaults.length > 0
    ) {
      if (!videosData.agentDefaults) {
        videosData.agentDefaults = {};
      }

      createVideoDto.agentDefaults.forEach((agentSlug) => {
        if (!videosData.agentDefaults[agentSlug]) {
          videosData.agentDefaults[agentSlug] = [];
        }
        if (!videosData.agentDefaults[agentSlug].includes(createVideoDto.id)) {
          videosData.agentDefaults[agentSlug].push(createVideoDto.id);
        }
      });
    }

    // Update metadata
    videosData.metadata.lastUpdated = new Date().toISOString().split('T')[0];
    videosData.metadata.totalVideos = this.countTotalVideos(videosData);

    // Write updated data
    await this.writeVideosData(videosData);

    // Create transcript entry if transcriptId provided
    if (createVideoDto.transcriptId) {
      await this.createTranscriptEntry(createVideoDto);
    }

    this.logger.log(
      `Created video: ${createVideoDto.id} in category: ${createVideoDto.categoryKey}`,
    );

    return newVideo;
  }

  /**
   * Find video by ID across all categories
   */
  private findVideoById(videosData: any, videoId: string) {
    for (const categoryKey of Object.keys(videosData.categories)) {
      const category = videosData.categories[categoryKey];
      const video = category.videos.find((v: any) => v.id === videoId);
      if (video) {
        return { video, categoryKey };
      }
    }
    return null;
  }

  /**
   * Count total videos across all categories
   */
  private countTotalVideos(videosData: any): number {
    return Object.values(videosData.categories).reduce(
      (total: number, category: any) => total + category.videos.length,
      0,
    );
  }

  /**
   * Write videos data to file with proper error handling
   */
  private async writeVideosData(videosData: any) {
    try {
      const jsonString = JSON.stringify(videosData, null, 2);
      await fs.writeFile(this.videosJsonPath, jsonString, 'utf-8');
    } catch (error) {
      this.logger.error(
        `Failed to write videos.json: ${(error as Error).message}`,
      );
      throw new BadRequestException('Failed to save video data');
    }
  }

  /**
   * Create transcript entry in videoTexts.json
   */
  private async createTranscriptEntry(videoData: CreateVideoDto) {
    try {
      const videoTexts = await this.getVideoTexts();

      videoTexts.transcripts[videoData.transcriptId!] = {
        title: `${videoData.title} - Transcript`,
        description: `Full transcript of the ${videoData.title.toLowerCase()} video.`,
        filePath: `video-texts/${videoData.transcriptId}-transcript.md`,
        videoId: videoData.id,
        lastUpdated: videoData.createdAt,
        status: 'pending',
        language: 'en',
        tags: videoData.tags || [],
      };

      videoTexts.metadata.lastUpdated = new Date().toISOString().split('T')[0];
      videoTexts.metadata.totalTranscripts = Object.keys(
        videoTexts.transcripts,
      ).length;

      await fs.writeFile(
        this.videoTextsJsonPath,
        JSON.stringify(videoTexts, null, 2),
        'utf-8',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to create transcript entry: ${(error as Error).message}`,
      );
      // Don't fail the video creation if transcript entry fails
    }
  }
}
