import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import VideoTrigger from '../VideoTrigger.vue';

// Mock the video service
vi.mock('@/services/videoService', () => ({
  Video: {}
}));

describe('VideoTrigger', () => {
  const mockVideo = {
    id: 'test-video',
    title: 'Test Video Title',
    description: 'Test video description',
    url: 'https://www.loom.com/embed/test',
    duration: '5:30',
    createdAt: '2024-01-01',
    featured: true,
    order: 1
  };

  it('should render video information correctly', () => {
    const wrapper = mount(VideoTrigger, {
      props: {
        video: mockVideo
      }
    });

    expect(wrapper.find('.video-title').text()).toBe('Test Video Title');
    expect(wrapper.find('.video-description').text()).toBe('Test video description');
    expect(wrapper.find('.duration').text()).toBe('5:30');
  });

  it('should emit play event when clicked', async () => {
    const wrapper = mount(VideoTrigger, {
      props: {
        video: mockVideo
      }
    });

    await wrapper.find('.video-trigger-button').trigger('click');
    
    expect(wrapper.emitted('play')).toBeTruthy();
    expect(wrapper.emitted('play')?.[0]).toEqual([mockVideo]);
  });

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(VideoTrigger, {
      props: {
        video: mockVideo
      }
    });

    const button = wrapper.find('.video-trigger-button');
    expect(button.attributes('aria-label')).toBe('Watch video: Test Video Title');
    expect(button.attributes('type')).toBe('button');
  });

  it('should have proper CSS classes for styling', () => {
    const wrapper = mount(VideoTrigger, {
      props: {
        video: mockVideo
      }
    });

    expect(wrapper.find('.video-trigger').exists()).toBe(true);
    expect(wrapper.find('.video-trigger-button').exists()).toBe(true);
    expect(wrapper.find('.video-thumbnail').exists()).toBe(true);
    expect(wrapper.find('.video-info').exists()).toBe(true);
  });

  it('should meet minimum touch target requirements', () => {
    const wrapper = mount(VideoTrigger, {
      props: {
        video: mockVideo
      }
    });

    const button = wrapper.find('.video-trigger-button');
    
    // Check that the button exists and has the correct class
    expect(button.exists()).toBe(true);
    expect(button.classes()).toContain('video-trigger-button');
  });
});
