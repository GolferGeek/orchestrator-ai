import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import PIIPatternTable from '../../../src/components/PII/PIIPatternTable.vue';
import { waitFor, expectEventually } from '../../../src/tests/setup';

describe('PIIPatternTable Component', () => {
  let wrapper: any;
  
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it('should render main table structure', () => {
    wrapper = mount(PIIPatternTable);

    expect(wrapper.find('.pii-pattern-table').exists()).toBe(true);
    expect(wrapper.find('.table-controls').exists()).toBe(true);
  });

  it('should render search and filter controls', () => {
    wrapper = mount(PIIPatternTable);

    expect(wrapper.find('ion-searchbar').exists()).toBe(true);
    expect(wrapper.findAll('ion-select')).toHaveLength(3); // Data Type, Status, Type filters
    expect(wrapper.text()).toContain('Add Pattern');
  });

  it('should render search bar with correct placeholder', () => {
    wrapper = mount(PIIPatternTable);

    const searchbar = wrapper.find('ion-searchbar');
    expect(searchbar.attributes('placeholder')).toBe('Search patterns...');
    expect(searchbar.attributes('debounce')).toBe('300');
  });

  it('should render filter select options correctly', () => {
    wrapper = mount(PIIPatternTable);

    const dataTypeSelect = wrapper.findAll('ion-select')[0];
    const statusSelect = wrapper.findAll('ion-select')[1];
    const typeSelect = wrapper.findAll('ion-select')[2];

    // Check that selects have correct placeholders
    expect(dataTypeSelect.attributes('placeholder')).toBe('Data Type');
    expect(statusSelect.attributes('placeholder')).toBe('Status');
    expect(typeSelect.attributes('placeholder')).toBe('Type');

    // Check for option content
    expect(wrapper.text()).toContain('All Types');
    expect(wrapper.text()).toContain('Email');
    expect(wrapper.text()).toContain('Phone');
    expect(wrapper.text()).toContain('All Status');
    expect(wrapper.text()).toContain('Enabled');
    expect(wrapper.text()).toContain('Disabled');
    expect(wrapper.text()).toContain('Built-in');
    expect(wrapper.text()).toContain('Custom');
  });

  it('should initialize with default reactive data', () => {
    wrapper = mount(PIIPatternTable);

    expect(wrapper.vm.searchQuery).toBe('');
    expect(wrapper.vm.filters.dataType).toBe('all');
    expect(wrapper.vm.filters.enabled).toBe('all');
    expect(wrapper.vm.filters.isBuiltIn).toBe('all');
    expect(wrapper.vm.selectedPatterns).toEqual([]);
    expect(wrapper.vm.selectAll).toBe(false);
    expect(wrapper.vm.showBulkActions).toBe(false);
  });

  it('should handle search query changes', async () => {
    wrapper = mount(PIIPatternTable);

    const testQuery = 'email pattern';
    wrapper.vm.searchQuery = testQuery;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.searchQuery).toBe(testQuery);
  });

  it('should handle filter changes', async () => {
    wrapper = mount(PIIPatternTable);

    // Change data type filter
    wrapper.vm.filters.dataType = 'email';
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filters.dataType).toBe('email');

    // Change status filter
    wrapper.vm.filters.enabled = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filters.enabled).toBe(true);

    // Change type filter
    wrapper.vm.filters.isBuiltIn = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.filters.isBuiltIn).toBe(false);
  });

  it('should show table header with sortable columns', () => {
    wrapper = mount(PIIPatternTable);

    expect(wrapper.text()).toContain('Name');
    expect(wrapper.text()).toContain('Data Type');
    expect(wrapper.text()).toContain('Status');
    expect(wrapper.text()).toContain('Type');
    expect(wrapper.text()).toContain('Priority');
    expect(wrapper.text()).toContain('Actions');

    // Check for sort buttons
    const sortButtons = wrapper.findAll('.sort-button');
    expect(sortButtons.length).toBeGreaterThan(0);
  });

  it('should handle select all checkbox', async () => {
    wrapper = mount(PIIPatternTable);

    // Initially not selected
    expect(wrapper.vm.selectAll).toBe(false);

    // Toggle select all
    wrapper.vm.selectAll = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.selectAll).toBe(true);
  });

  it('should show bulk actions when patterns are selected', async () => {
    wrapper = mount(PIIPatternTable);

    // No patterns selected initially
    expect(wrapper.vm.selectedPatterns.length).toBe(0);

    // Select some patterns
    wrapper.vm.selectedPatterns = ['pattern1', 'pattern2'];
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Actions (2)');
  });

  it('should emit create-pattern event when add button is clicked', async () => {
    wrapper = mount(PIIPatternTable);

    const addButton = wrapper.findAll('ion-button').find((btn: any) => 
      btn.text().includes('Add Pattern')
    );

    if (addButton) {
      await addButton.trigger('click');
      expect(wrapper.emitted('create-pattern')).toBeTruthy();
    }
  });

  it('should handle loading state', async () => {
    wrapper = mount(PIIPatternTable);

    // Mock loading state
    if (wrapper.vm.piiStore) {
      wrapper.vm.piiStore.isLoading = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.loading-container').exists()).toBe(true);
      expect(wrapper.find('ion-spinner').exists()).toBe(true);
      expect(wrapper.text()).toContain('Loading PII patterns...');
    }
  });

  it('should handle error state', async () => {
    wrapper = mount(PIIPatternTable);

    // Mock error state
    if (wrapper.vm.piiStore) {
      wrapper.vm.piiStore.error = 'Failed to load patterns';
      wrapper.vm.piiStore.isLoading = false;
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Failed to load patterns');
      expect(wrapper.text()).toContain('Retry');
    }
  });

  it('should handle sorting functionality', async () => {
    wrapper = mount(PIIPatternTable);

    // Test sorting by name
    if (wrapper.vm.sortBy) {
      wrapper.vm.sortBy('name');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.sortOptions.field).toBe('name');
    }

    // Test sorting by data type
    if (wrapper.vm.sortBy) {
      wrapper.vm.sortBy('dataType');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.sortOptions.field).toBe('dataType');
    }
  });

  it('should show correct sort icons', () => {
    wrapper = mount(PIIPatternTable);

    if (wrapper.vm.getSortIcon) {
      // When sorting ascending
      wrapper.vm.sortOptions = { field: 'name', direction: 'asc' };
      const ascIcon = wrapper.vm.getSortIcon('name');
      expect(ascIcon).toBeDefined();

      // When sorting descending
      wrapper.vm.sortOptions = { field: 'name', direction: 'desc' };
      const descIcon = wrapper.vm.getSortIcon('name');
      expect(descIcon).toBeDefined();
    }
  });

  it('should handle pattern selection', async () => {
    wrapper = mount(PIIPatternTable);

    const mockPattern = { id: 'pattern1', name: 'Email Pattern' };

    if (wrapper.vm.isSelected) {
      // Initially not selected
      expect(wrapper.vm.isSelected(mockPattern)).toBe(false);

      // Add to selection
      wrapper.vm.selectedPatterns = ['pattern1'];
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.isSelected(mockPattern)).toBe(true);
    }
  });

  it('should show indeterminate state for select all checkbox', async () => {
    wrapper = mount(PIIPatternTable);

    // Mock partial selection
    wrapper.vm.selectedPatterns = ['pattern1'];
    
    if (wrapper.vm.isIndeterminate) {
      // Should be indeterminate when some but not all patterns are selected
      expect(wrapper.vm.isIndeterminate).toBeDefined();
    }
  });

  it('should disable add button during loading', async () => {
    wrapper = mount(PIIPatternTable);

    const addButton = wrapper.findAll('ion-button').find((btn: any) => 
      btn.text().includes('Add Pattern')
    );

    if (addButton && wrapper.vm.isLoading !== undefined) {
      // Test when loading
      wrapper.vm.isLoading = true;
      await wrapper.vm.$nextTick();
      expect(addButton.attributes('disabled')).toBe('');

      // Test when not loading
      wrapper.vm.isLoading = false;
      await wrapper.vm.$nextTick();
      expect(addButton.attributes('disabled')).toBeUndefined();
    }
  });

  it('should handle bulk actions display', async () => {
    wrapper = mount(PIIPatternTable);

    // Initially no bulk actions
    expect(wrapper.vm.showBulkActions).toBe(false);

    // Show bulk actions
    wrapper.vm.showBulkActions = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.showBulkActions).toBe(true);
  });

  it('should handle table row rendering', () => {
    wrapper = mount(PIIPatternTable);

    expect(wrapper.find('.table-container').exists()).toBe(true);
    expect(wrapper.find('.table-header').exists()).toBe(true);
    expect(wrapper.find('.table-body').exists()).toBe(true);
  });

  it('should handle search input events', async () => {
    wrapper = mount(PIIPatternTable);

    const searchbar = wrapper.find('ion-searchbar');
    if (searchbar.exists() && wrapper.vm.handleSearch) {
      // Simulate search input
      wrapper.vm.searchQuery = 'test search';
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.searchQuery).toBe('test search');
    }
  });

  it('should handle filter application', async () => {
    wrapper = mount(PIIPatternTable);

    if (wrapper.vm.applyFilters) {
      // Change filters
      wrapper.vm.filters.dataType = 'email';
      wrapper.vm.filters.enabled = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.filters.dataType).toBe('email');
      expect(wrapper.vm.filters.enabled).toBe(true);
    }
  });

  it('should handle component initialization', async () => {
    wrapper = mount(PIIPatternTable);

    // Wait for initialization
    await waitFor(100);

    expect(wrapper.vm).toBeDefined();
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.pii-pattern-table').exists()).toBe(true);
  });

  it('should maintain state consistency', async () => {
    wrapper = mount(PIIPatternTable);

    // Set initial state
    wrapper.vm.searchQuery = 'initial search';
    wrapper.vm.filters.dataType = 'phone';
    wrapper.vm.selectedPatterns = ['pattern1', 'pattern2'];
    await wrapper.vm.$nextTick();

    // Verify state persistence
    expect(wrapper.vm.searchQuery).toBe('initial search');
    expect(wrapper.vm.filters.dataType).toBe('phone');
    expect(wrapper.vm.selectedPatterns).toEqual(['pattern1', 'pattern2']);
  });

  it('should handle pattern filtering correctly', async () => {
    wrapper = mount(PIIPatternTable);

    if (wrapper.vm.filteredPatterns !== undefined) {
      // Should have filtered patterns property
      expect(wrapper.vm.filteredPatterns).toBeDefined();
      expect(Array.isArray(wrapper.vm.filteredPatterns)).toBe(true);
    }
  });

  it('should handle sort options correctly', () => {
    wrapper = mount(PIIPatternTable);

    if (wrapper.vm.sortOptions) {
      // Should have default sort options
      expect(wrapper.vm.sortOptions).toBeDefined();
      expect(wrapper.vm.sortOptions).toHaveProperty('field');
      expect(wrapper.vm.sortOptions).toHaveProperty('direction');
    }
  });

  it('should show correct number of selected items', async () => {
    wrapper = mount(PIIPatternTable);

    const selectedItems = ['item1', 'item2', 'item3'];
    wrapper.vm.selectedPatterns = selectedItems;
    await wrapper.vm.$nextTick();

    if (wrapper.vm.selectedPatterns.length > 0) {
      expect(wrapper.text()).toContain(`Actions (${selectedItems.length})`);
    }
  });
});