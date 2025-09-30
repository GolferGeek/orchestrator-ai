import { myOrgHierarchyAgentFixtures } from '../../fixtures/my-org-hierarchy-agents.fixture';

describe('myOrgHierarchyAgentFixtures', () => {
  it('contains descriptors that parseable YAML/JSON strings', () => {
    for (const fixture of myOrgHierarchyAgentFixtures) {
      expect(typeof fixture.record.yaml).toBe('string');
      expect(() => JSON.parse(fixture.record.yaml)).not.toThrow();
    }
  });

  it('ensures descriptor objects carry required keys', () => {
    const requiredKeys = [
      'metadata',
      'capabilities',
      'communication',
      'configuration',
      'prompts',
    ];

    for (const { descriptor, record } of myOrgHierarchyAgentFixtures) {
      for (const key of requiredKeys) {
        expect(descriptor[key]).toBeDefined();
      }
      expect(record.organization_slug).toBe('my-org');
      expect(record.slug).toBeTruthy();
      expect(record.display_name.length).toBeGreaterThan(0);
    }
  });
});
