import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { IonIcon, IonSpinner } from '@ionic/vue';
import SubSubAccordion from '../SubSubAccordion.vue';

// Mock Ionic components
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    template: '<div data-testid="ion-icon"></div>',
  },
  IonSpinner: {
    name: 'IonSpinner',
    template: '<div data-testid="ion-spinner"></div>',
  },
}));

describe('SubSubAccordion', () => {
  it('should render with correct title', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    expect(wrapper.find('h4').text()).toBe('Test Sub Sub Section');
  });

  it('should generate proper ID when no id prop provided', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-sub-accordion-content');
    
    expect(button.attributes('id')).toMatch(/^sub-sub-accordion-header-sub-sub-test-sub-sub-section-/);
    expect(content.attributes('id')).toMatch(/^sub-sub-accordion-content-sub-sub-test-sub-sub-section-/);
  });

  it('should use provided id prop', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        id: 'custom-sub-sub-id',
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-sub-accordion-content');
    
    expect(button.attributes('id')).toBe('sub-sub-accordion-header-sub-sub-custom-sub-sub-id');
    expect(content.attributes('id')).toBe('sub-sub-accordion-content-sub-sub-custom-sub-sub-id');
  });

  it('should be collapsed by default when isExpanded is false', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const content = wrapper.find('.sub-sub-accordion-content');
    expect(content.isVisible()).toBe(false);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false');
  });

  it('should be expanded when isExpanded is true', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
      },
    });

    const content = wrapper.find('.sub-sub-accordion-content');
    expect(content.isVisible()).toBe(true);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('should toggle expansion when header is clicked', async () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-sub-accordion-content');

    // Initially collapsed
    expect(content.isVisible()).toBe(false);

    // Click to expand
    await button.trigger('click');
    await wrapper.vm.$nextTick();

    expect(content.isVisible()).toBe(true);
    expect(button.attributes('aria-expanded')).toBe('true');
  });

  it('should render slot content when expanded and not lazy loaded', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
        lazyLoad: false,
      },
      slots: {
        default: '<p>Test sub sub content</p>',
      },
    });

    expect(wrapper.find('p').text()).toBe('Test sub sub content');
  });

  it('should render lazy loaded content when lazyLoad is true', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
        lazyLoad: true,
      },
      slots: {
        default: '<p>Lazy loaded content</p>',
      },
    });

    // Should render the content directly (Suspense handles the async part)
    expect(wrapper.find('p').text()).toBe('Lazy loaded content');
  });

  it('should show loading placeholder when lazy loading', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
        lazyLoad: true,
      },
    });

    // The Suspense fallback should be available
    const loadingPlaceholder = wrapper.find('.loading-placeholder');
    expect(loadingPlaceholder.exists()).toBe(true);
  });

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        id: 'test-sub-sub',
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-sub-accordion-content');

    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-controls')).toBe('sub-sub-accordion-content-sub-sub-test-sub-sub');
    expect(content.attributes('id')).toBe('sub-sub-accordion-content-sub-sub-test-sub-sub');
    expect(content.attributes('aria-labelledby')).toBe('sub-sub-accordion-header-sub-sub-test-sub-sub');
    expect(content.attributes('role')).toBe('region');
  });

  it('should handle keyboard navigation', async () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-sub-accordion-content');

    // Test Enter key
    await button.trigger('keydown', { key: 'Enter' });
    await wrapper.vm.$nextTick();
    expect(content.isVisible()).toBe(true);

    // Test Space key
    await button.trigger('keydown', { key: ' ' });
    await wrapper.vm.$nextTick();
    expect(content.isVisible()).toBe(false);

    // Test Arrow Down key (should expand)
    await button.trigger('keydown', { key: 'ArrowDown' });
    await wrapper.vm.$nextTick();
    expect(content.isVisible()).toBe(true);

    // Test Arrow Up key (should collapse)
    await button.trigger('keydown', { key: 'ArrowUp' });
    await wrapper.vm.$nextTick();
    expect(content.isVisible()).toBe(false);

    // Test Escape key (should collapse when expanded)
    await button.trigger('keydown', { key: 'ArrowDown' }); // Expand first
    await wrapper.vm.$nextTick();
    await button.trigger('keydown', { key: 'Escape' });
    await wrapper.vm.$nextTick();
    expect(content.isVisible()).toBe(false);
  });

  it('should have proper icon accessibility attributes', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand sub-subsection: Test Sub Sub Section');
    expect(icon.attributes('tabindex')).toBe('0');
  });

  it('should update icon aria-label when expanded', async () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand sub-subsection: Test Sub Sub Section');

    await wrapper.setProps({ isExpanded: true });
    await wrapper.vm.$nextTick();

    expect(icon.attributes('aria-label')).toBe('Collapse sub-subsection: Test Sub Sub Section');
  });

  it('should render chevron icon', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.findComponent(IonIcon);
    expect(icon.exists()).toBe(true);
  });

  it('should have proper CSS classes', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: false,
      },
    });

    expect(wrapper.classes()).toContain('sub-sub-accordion');
    expect(wrapper.classes()).not.toContain('is-expanded');
  });

  it('should have is-expanded class when expanded', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
      },
    });

    expect(wrapper.classes()).toContain('is-expanded');
  });

  it('should default lazyLoad to false', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
      },
    });

    // Should not have Suspense wrapper when lazyLoad is false
    const suspense = wrapper.findComponent({ name: 'Suspense' });
    expect(suspense.exists()).toBe(false);
  });

  it('should use Suspense when lazyLoad is true', () => {
    const wrapper = mount(SubSubAccordion, {
      props: {
        title: 'Test Sub Sub Section',
        isExpanded: true,
        lazyLoad: true,
      },
    });

    // Should have Suspense wrapper when lazyLoad is true
    const suspense = wrapper.findComponent({ name: 'Suspense' });
    expect(suspense.exists()).toBe(true);
  });
});
