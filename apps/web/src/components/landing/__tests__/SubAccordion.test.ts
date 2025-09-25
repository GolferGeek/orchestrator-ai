import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { IonIcon } from '@ionic/vue';
import SubAccordion from '../SubAccordion.vue';

// Mock IonIcon
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    template: '<div data-testid="ion-icon"></div>',
  },
}));

describe('SubAccordion', () => {
  it('should render with correct title', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    expect(wrapper.find('h3').text()).toBe('Test Sub Section');
  });

  it('should generate proper ID when no id prop provided', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-accordion-content');
    
    expect(button.attributes('id')).toMatch(/^sub-accordion-header-sub-sub-test-sub-section-/);
    expect(content.attributes('id')).toMatch(/^sub-accordion-content-sub-sub-test-sub-section-/);
  });

  it('should use provided id prop', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        id: 'custom-id',
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-accordion-content');
    
    expect(button.attributes('id')).toBe('sub-accordion-header-sub-sub-custom-id');
    expect(content.attributes('id')).toBe('sub-accordion-content-sub-sub-custom-id');
  });

  it('should be collapsed by default when isExpanded is false', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const content = wrapper.find('.sub-accordion-content');
    expect(content.isVisible()).toBe(false);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false');
  });

  it('should be expanded when isExpanded is true', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: true,
      },
    });

    const content = wrapper.find('.sub-accordion-content');
    expect(content.isVisible()).toBe(true);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('should toggle expansion when header is clicked', async () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-accordion-content');

    // Initially collapsed
    expect(content.isVisible()).toBe(false);

    // Click to expand
    await button.trigger('click');
    await wrapper.vm.$nextTick();

    expect(content.isVisible()).toBe(true);
    expect(button.attributes('aria-expanded')).toBe('true');
  });

  it('should render slot content when expanded', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: true,
      },
      slots: {
        default: '<p>Test sub content</p>',
      },
    });

    expect(wrapper.find('p').text()).toBe('Test sub content');
  });

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        id: 'test-sub',
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-accordion-content');

    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-controls')).toBe('sub-accordion-content-sub-sub-test-sub');
    expect(content.attributes('id')).toBe('sub-accordion-content-sub-sub-test-sub');
    expect(content.attributes('aria-labelledby')).toBe('sub-accordion-header-sub-sub-test-sub');
    expect(content.attributes('role')).toBe('region');
  });

  it('should handle keyboard navigation', async () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.sub-accordion-content');

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
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand subsection: Test Sub Section');
    expect(icon.attributes('tabindex')).toBe('0');
  });

  it('should update icon aria-label when expanded', async () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand subsection: Test Sub Section');

    await wrapper.setProps({ isExpanded: true });
    await wrapper.vm.$nextTick();

    expect(icon.attributes('aria-label')).toBe('Collapse subsection: Test Sub Section');
  });

  it('should render chevron icon', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.findComponent(IonIcon);
    expect(icon.exists()).toBe(true);
  });

  it('should have proper CSS classes', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: false,
      },
    });

    expect(wrapper.classes()).toContain('sub-accordion');
    expect(wrapper.classes()).not.toContain('is-expanded');
  });

  it('should have is-expanded class when expanded', () => {
    const wrapper = mount(SubAccordion, {
      props: {
        title: 'Test Sub Section',
        isExpanded: true,
      },
    });

    expect(wrapper.classes()).toContain('is-expanded');
  });
});
