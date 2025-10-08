import { Test, TestingModule } from '@nestjs/testing';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';

describe('VideosController', () => {
  let controller: VideosController;
  let service: VideosService;

  const mockVideosService = {
    getVideos: jest.fn(),
    getCategories: jest.fn(),
    getTranscript: jest.fn(),
    createVideo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VideosController],
      providers: [
        {
          provide: VideosService,
          useValue: mockVideosService,
        },
      ],
    }).compile();

    controller = module.get<VideosController>(VideosController);
    service = module.get<VideosService>(VideosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVideos', () => {
    it('should return videos data', async () => {
      const mockVideosData = { categories: {}, agentDefaults: {}, metadata: {} };
      mockVideosService.getVideos.mockResolvedValue(mockVideosData);

      const result = await controller.getVideos();
      
      expect(result).toBe(mockVideosData);
      expect(service.getVideos).toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    it('should return video categories', async () => {
      const mockCategories = [
        { key: 'agents', title: 'Agent Tutorials', description: 'Learn about agents' }
      ];
      mockVideosService.getCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories();
      
      expect(result).toBe(mockCategories);
      expect(service.getCategories).toHaveBeenCalled();
    });
  });

  describe('getTranscript', () => {
    it('should return transcript for valid video ID', async () => {
      const mockTranscript = {
        title: 'Test Transcript',
        content: 'Transcript content here...'
      };
      mockVideosService.getTranscript.mockResolvedValue(mockTranscript);

      const result = await controller.getTranscript('test-video-id');
      
      expect(result).toBe(mockTranscript);
      expect(service.getTranscript).toHaveBeenCalledWith('test-video-id');
    });
  });

  describe('createVideo', () => {
    it('should create video successfully', async () => {
      const createVideoDto: CreateVideoDto = {
        id: 'test-video',
        title: 'Test Video',
        description: 'Test description',
        url: 'https://example.com/video',
        duration: '5:00',
        createdAt: '2025-01-24',
        order: 1,
        categoryKey: 'agents'
      };
      
      const mockCreatedVideo = { ...createVideoDto, featured: false };
      mockVideosService.createVideo.mockResolvedValue(mockCreatedVideo);

      const result = await controller.createVideo(createVideoDto);
      
      expect(result).toBe(mockCreatedVideo);
      expect(service.createVideo).toHaveBeenCalledWith(createVideoDto);
    });
  });
});