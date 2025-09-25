import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { IonIcon } from '@ionic/vue';
import AccordionSection from '../AccordionSection.vue';

// Mock IonIcon
vi.mock('@ionic/vue', () => ({
  IonIcon: {
    name: 'IonIcon',
    template: '<div data-testid="ion-icon"></div>',
  },
}));

describe('AccordionSection', () => {
  it('should render with correct title and id', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    expect(wrapper.find('h2').text()).toBe('Test Section');
    expect(wrapper.find('button').attributes('id')).toBe('accordion-header-test-section');
  });

  it('should be collapsed by default when isExpanded is false', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const content = wrapper.find('.accordion-content');
    expect(content.isVisible()).toBe(false);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false');
  });

  it('should be expanded when isExpanded is true', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: true,
      },
    });

    const content = wrapper.find('.accordion-content');
    expect(content.isVisible()).toBe(true);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('should toggle expansion when header is clicked', async () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.accordion-content');

    // Initially collapsed
    expect(content.isVisible()).toBe(false);

    // Click to expand
    await button.trigger('click');
    await wrapper.vm.$nextTick();

    expect(content.isVisible()).toBe(true);
    expect(button.attributes('aria-expanded')).toBe('true');
  });

  it('should render slot content when expanded', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: true,
      },
      slots: {
        content: '<p>Test content</p>',
      },
    });

    expect(wrapper.find('p').text()).toBe('Test content');
  });

  it('should have proper accessibility attributes', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.accordion-content');

    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.attributes('aria-controls')).toBe('accordion-content-test-section');
    expect(content.attributes('id')).toBe('accordion-content-test-section');
    expect(content.attributes('aria-labelledby')).toBe('accordion-header-test-section');
    expect(content.attributes('role')).toBe('region');
  });

  it('should update when isExpanded prop changes', async () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    expect(wrapper.find('.accordion-content').isVisible()).toBe(false);

    await wrapper.setProps({ isExpanded: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.accordion-content').isVisible()).toBe(true);
  });

  it('should render chevron icon', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.findComponent(IonIcon);
    expect(icon.exists()).toBe(true);
  });

  it('should have proper CSS classes', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    expect(wrapper.classes()).toContain('accordion-section');
    expect(wrapper.classes()).not.toContain('is-expanded');
  });

  it('should have is-expanded class when expanded', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: true,
      },
    });

    expect(wrapper.classes()).toContain('is-expanded');
  });

  it('should handle keyboard navigation', async () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const button = wrapper.find('button');
    const content = wrapper.find('.accordion-content');

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

  it('should support defaultExpanded prop', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        defaultExpanded: true,
      },
    });

    expect(wrapper.find('.accordion-content').isVisible()).toBe(true);
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('should have proper icon accessibility attributes', () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand section: Test Section');
    expect(icon.attributes('tabindex')).toBe('0');
  });

  it('should update icon aria-label when expanded', async () => {
    const wrapper = mount(AccordionSection, {
      props: {
        id: 'test-section',
        title: 'Test Section',
        isExpanded: false,
      },
    });

    const icon = wrapper.find('[role="button"]');
    expect(icon.attributes('aria-label')).toBe('Expand section: Test Section');

    await wrapper.setProps({ isExpanded: true });
    await wrapper.vm.$nextTick();

    expect(icon.attributes('aria-label')).toBe('Collapse section: Test Section');
  });
});
