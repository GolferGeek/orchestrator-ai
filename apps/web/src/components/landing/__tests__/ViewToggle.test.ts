import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { IonIcon } from '@ionic/vue';
import ViewToggle from '../ViewToggle.vue';

// Mock vue-router
const mockPush = vi.fn();
const mockRoute = {
  path: '/marketing',
  query: {},
};

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => mockRoute,
}));

// Mock IonIcon
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    template: '<div data-testid="ion-icon"></div>',
  },
}));

describe('ViewToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoute.path = '/marketing';
  });

  it('should render both toggle buttons', () => {
    const wrapper = mount(ViewToggle);
    
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);
    
    expect(buttons[0].text()).toContain('Marketing');
    expect(buttons[1].text()).toContain('Technical');
  });

  it('should show marketing view as active when on marketing route', () => {
    mockRoute.path = '/marketing';
    const wrapper = mount(ViewToggle);
    
    const marketingButton = wrapper.findAll('button')[0];
    const technicalButton = wrapper.findAll('button')[1];
    
    expect(marketingButton.classes()).toContain('active');
    expect(technicalButton.classes()).not.toContain('active');
  });

  it('should show technical view as active when on technical route', () => {
    mockRoute.path = '/technical';
    const wrapper = mount(ViewToggle);
    
    const marketingButton = wrapper.findAll('button')[0];
    const technicalButton = wrapper.findAll('button')[1];
    
    expect(marketingButton.classes()).not.toContain('active');
    expect(technicalButton.classes()).toContain('active');
  });

  it('should navigate to /marketing when marketing button is clicked', async () => {
    const wrapper = mount(ViewToggle);
    
    const marketingButton = wrapper.findAll('button')[0];
    await marketingButton.trigger('click');
    
    expect(mockPush).toHaveBeenCalledWith('/marketing');
  });

  it('should navigate to /technical when technical button is clicked', async () => {
    const wrapper = mount(ViewToggle);
    
    const technicalButton = wrapper.findAll('button')[1];
    await technicalButton.trigger('click');
    
    expect(mockPush).toHaveBeenCalledWith('/technical');
  });

  it('should have proper accessibility attributes', () => {
    mockRoute.path = '/marketing';
    const wrapper = mount(ViewToggle);
    
    const marketingButton = wrapper.findAll('button')[0];
    const technicalButton = wrapper.findAll('button')[1];
    
    expect(marketingButton.attributes('aria-pressed')).toBe('true');
    expect(marketingButton.attributes('aria-label')).toBe('Switch to Marketing view');
    
    expect(technicalButton.attributes('aria-pressed')).toBe('false');
    expect(technicalButton.attributes('aria-label')).toBe('Switch to Technical view');
  });

  it('should render icons for both buttons', () => {
    const wrapper = mount(ViewToggle);
    
    const icons = wrapper.findAllComponents(IonIcon);
    expect(icons).toHaveLength(2);
  });

  it('should have proper CSS classes for styling', () => {
    mockRoute.path = '/marketing';
    const wrapper = mount(ViewToggle);
    
    expect(wrapper.classes()).toContain('view-toggle');
    expect(wrapper.classes()).not.toContain('is-technical');
  });

  it('should have is-technical class when on technical route', () => {
    mockRoute.path = '/technical';
    const wrapper = mount(ViewToggle);
    
    expect(wrapper.classes()).toContain('is-technical');
  });

  it('should show marketing view as active when on root route', () => {
    mockRoute.path = '/';
    const wrapper = mount(ViewToggle);
    
    const marketingButton = wrapper.findAll('button')[0];
    expect(marketingButton.classes()).toContain('active');
  });
});
