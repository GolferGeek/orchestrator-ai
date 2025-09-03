import { Test, TestingModule } from '@nestjs/testing';
import { PseudonymizationService, PseudonymResult } from './pseudonymization.service';
import { PIIPatternService, PIIDataType } from './pii-pattern.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('PseudonymizationService', () => {
  let service: PseudonymizationService;
  let mockPIIPatternService: jest.Mocked<PIIPatternService>;
  let mockSupabaseService: jest.Mocked<SupabaseService>;

  const mockSupabaseClient = {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          gt: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const mockPIIPattern = {
      detectPII: jest.fn(),
      getAllPatterns: jest.fn(),
      getPatternsByDataType: jest.fn(),
      addCustomPattern: jest.fn(),
      testPattern: jest.fn(),
      getStats: jest.fn(),
    };

    const mockSupabase = {
      getServiceClient: jest.fn(() => mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PseudonymizationService,
        { provide: PIIPatternService, useValue: mockPIIPattern },
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();

    service = module.get<PseudonymizationService>(PseudonymizationService);
    mockPIIPatternService = module.get(PIIPatternService);
    mockSupabaseService = module.get(SupabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePseudonym', () => {
    it('should generate pseudonym for email', async () => {
      // Mock database lookup to return no existing pseudonym
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.generatePseudonym('john@example.com', 'email', 'test');

      expect(result).toMatchObject({
        originalValue: 'john@example.com',
        dataType: 'email',
        isNew: true,
        context: 'test',
      });
      expect(result.pseudonym).toBeDefined();
      expect(result.pseudonym).toContain('@');
    });

    it('should return existing pseudonym when already mapped', async () => {
      const existingPseudonym = 'user123@example.com';
      
      // Mock database lookup to return existing pseudonym
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: { pseudonym: existingPseudonym }, 
              error: null 
            }),
          })),
        })),
      });

      const result = await service.generatePseudonym('john@example.com', 'email');

      expect(result).toMatchObject({
        originalValue: 'john@example.com',
        pseudonym: existingPseudonym,
        dataType: 'email',
        isNew: false,
      });
    });

    it('should generate pseudonym for phone number', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.generatePseudonym('(555) 123-4567', 'phone');

      expect(result.pseudonym).toMatch(/\(\d{3}\) \d{3}-\d{4}/);
      expect(result.dataType).toBe('phone');
      expect(result.isNew).toBe(true);
    });

    it('should generate pseudonym for names', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      // Mock dictionary lookup
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({ 
                data: [
                  { value: 'John', frequency_weight: 10 },
                  { value: 'Jane', frequency_weight: 8 }
                ], 
                error: null 
              }),
            })),
          })),
        })),
      });

      const result = await service.generatePseudonym('John Smith', 'name');

      expect(result.pseudonym).toBeDefined();
      expect(result.dataType).toBe('name');
      expect(result.isNew).toBe(true);
    });

    it('should generate pseudonym for IP addresses', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.generatePseudonym('192.168.1.100', 'ip_address');

      expect(result.pseudonym).toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      expect(result.dataType).toBe('ip_address');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error('Database error') 
            }),
          })),
        })),
      });

      await expect(service.generatePseudonym('test@example.com', 'email'))
        .rejects.toThrow('Database error');
    });

    it('should handle different data types', async () => {
      const dataTypes: PIIDataType[] = ['email', 'phone', 'name', 'address', 'ip_address', 'username'];
      
      for (const dataType of dataTypes) {
        mockSupabaseClient.from.mockReturnValue({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
          insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
        });

        const result = await service.generatePseudonym('test-value', dataType);
        expect(result.dataType).toBe(dataType);
        expect(result.pseudonym).toBeDefined();
      }
    });
  });

  describe('pseudonymizeText', () => {
    it('should pseudonymize text with detected PII', async () => {
      // Mock PII detection
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [
          {
            value: 'john@example.com',
            dataType: 'email',
            patternName: 'email_standard',
            startIndex: 8,
            endIndex: 23,
            confidence: 1.0,
          },
          {
            value: '(555) 123-4567',
            dataType: 'phone',
            patternName: 'phone_us_standard',
            startIndex: 27,
            endIndex: 41,
            confidence: 1.0,
          },
        ],
        processingTime: 5,
        patternsChecked: 10,
      });

      // Mock pseudonym generation
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const text = 'Contact john@example.com or (555) 123-4567';
      const result = await service.pseudonymizeText(text);

      expect(result.originalText).toBe(text);
      expect(result.pseudonymizedText).not.toBe(text);
      expect(result.pseudonyms).toHaveLength(2);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle text with no PII', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [],
        processingTime: 1,
        patternsChecked: 10,
      });

      const text = 'This text has no personal information';
      const result = await service.pseudonymizeText(text);

      expect(result.originalText).toBe(text);
      expect(result.pseudonymizedText).toBe(text);
      expect(result.pseudonyms).toHaveLength(0);
    });

    it('should filter by specified data types', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [
          {
            value: 'john@example.com',
            dataType: 'email',
            patternName: 'email_standard',
            startIndex: 0,
            endIndex: 15,
            confidence: 1.0,
          },
        ],
        processingTime: 3,
        patternsChecked: 5,
      });

      const text = 'john@example.com and (555) 123-4567';
      const result = await service.pseudonymizeText(text, { dataTypes: ['email'] });

      expect(mockPIIPatternService.detectPII).toHaveBeenCalledWith(text, {
        dataTypes: ['email'],
        minConfidence: 0.8,
        maxMatches: 100,
      });
    });

    it('should handle context parameter', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [
          {
            value: 'john@example.com',
            dataType: 'email',
            patternName: 'email_standard',
            startIndex: 0,
            endIndex: 15,
            confidence: 1.0,
          },
        ],
        processingTime: 3,
        patternsChecked: 5,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.pseudonymizeText('john@example.com', { context: 'test-context' });

      expect(result.pseudonyms[0].context).toBe('test-context');
    });

    it('should handle errors during pseudonym generation', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [
          {
            value: 'john@example.com',
            dataType: 'email',
            patternName: 'email_standard',
            startIndex: 0,
            endIndex: 15,
            confidence: 1.0,
          },
        ],
        processingTime: 3,
        patternsChecked: 5,
      });

      // Mock error during pseudonym generation
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockRejectedValue(new Error('Generation error')),
          })),
        })),
      });

      const text = 'Contact john@example.com';
      const result = await service.pseudonymizeText(text);

      // Should handle errors gracefully and continue processing
      expect(result.originalText).toBe(text);
      expect(result.pseudonymizedText).toBe(text); // Should remain unchanged due to error
    });
  });

  describe('lookupPseudonym', () => {
    it('should return existing pseudonym', async () => {
      const existingPseudonym = 'user123@example.com';
      
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: { pseudonym: existingPseudonym, data_type: 'email' }, 
              error: null 
            }),
          })),
        })),
      });

      const result = await service.lookupPseudonym('john@example.com', 'email');

      expect(result).toBe(existingPseudonym);
    });

    it('should return null for non-existent pseudonym', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      });

      const result = await service.lookupPseudonym('nonexistent@example.com', 'email');

      expect(result).toBeNull();
    });

    it('should return null for mismatched data type', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: { pseudonym: 'user123@example.com', data_type: 'phone' }, 
              error: null 
            }),
          })),
        })),
      });

      const result = await service.lookupPseudonym('john@example.com', 'email');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error('Database error') 
            }),
          })),
        })),
      });

      const result = await service.lookupPseudonym('test@example.com', 'email');

      expect(result).toBeNull();
    });
  });

  describe('reversePseudonymization', () => {
    it('should reverse pseudonyms back to original values', async () => {
      const pseudonymMappings: PseudonymResult[] = [
        {
          originalValue: 'john@example.com',
          pseudonym: 'user123@example.com',
          dataType: 'email',
          isNew: false,
        },
        {
          originalValue: '(555) 123-4567',
          pseudonym: '(555) 999-0000',
          dataType: 'phone',
          isNew: false,
        },
      ];

      const pseudonymizedText = 'Contact user123@example.com or call (555) 999-0000';
      const result = await service.reversePseudonymization(pseudonymizedText, pseudonymMappings);

      expect(result.originalText).toBe('Contact john@example.com or call (555) 123-4567');
      expect(result.reversalCount).toBe(2);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle partial matches', async () => {
      const pseudonymMappings: PseudonymResult[] = [
        {
          originalValue: 'john@example.com',
          pseudonym: 'user123@example.com',
          dataType: 'email',
          isNew: false,
        },
      ];

      const pseudonymizedText = 'Contact user123@example.com and someone else';
      const result = await service.reversePseudonymization(pseudonymizedText, pseudonymMappings);

      expect(result.originalText).toBe('Contact john@example.com and someone else');
      expect(result.reversalCount).toBe(1);
    });

    it('should handle empty mappings', async () => {
      const pseudonymizedText = 'No pseudonyms to reverse';
      const result = await service.reversePseudonymization(pseudonymizedText, []);

      expect(result.originalText).toBe(pseudonymizedText);
      expect(result.reversalCount).toBe(0);
    });

    it('should handle overlapping pseudonym replacements correctly', async () => {
      const pseudonymMappings: PseudonymResult[] = [
        {
          originalValue: 'test@example.com',
          pseudonym: 'test@fake.com',
          dataType: 'email',
          isNew: false,
        },
        {
          originalValue: 'testing@example.com',
          pseudonym: 'testing@fake.com',
          dataType: 'email',
          isNew: false,
        },
      ];

      const pseudonymizedText = 'Emails: test@fake.com and testing@fake.com';
      const result = await service.reversePseudonymization(pseudonymizedText, pseudonymMappings);

      expect(result.originalText).toContain('test@example.com');
      expect(result.originalText).toContain('testing@example.com');
      expect(result.reversalCount).toBe(2);
    });
  });

  describe('createReversiblePseudonymization', () => {
    it('should create pseudonymization with reversal context', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [
          {
            value: 'john@example.com',
            dataType: 'email',
            patternName: 'email_standard',
            startIndex: 0,
            endIndex: 15,
            confidence: 1.0,
          },
        ],
        processingTime: 3,
        patternsChecked: 5,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.createReversiblePseudonymization(
        'john@example.com', 
        'request-123'
      );

      expect(result.pseudonymizedText).toBeDefined();
      expect(result.reversalContext).toBeDefined();
      expect(result.reversalContext).toHaveLength(1);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should include request ID in context', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [],
        processingTime: 1,
        patternsChecked: 5,
      });

      const result = await service.createReversiblePseudonymization(
        'No PII here', 
        'request-456',
        { context: 'test' }
      );

      expect(result).toBeDefined();
      // Should handle case with no PII gracefully
    });
  });

  describe('addPIIPattern', () => {
    it('should delegate to PIIPatternService', async () => {
      const pattern = {
        name: 'custom_pattern',
        dataType: 'custom' as PIIDataType,
        pattern: /TEST_\w+/g,
        description: 'Test pattern',
      };

      mockPIIPatternService.addCustomPattern.mockResolvedValue();

      await service.addPIIPattern(pattern);

      expect(mockPIIPatternService.addCustomPattern).toHaveBeenCalledWith(pattern);
    });
  });

  describe('getPIIPatterns', () => {
    it('should delegate to PIIPatternService', () => {
      const mockPatterns = [
        {
          name: 'email',
          dataType: 'email' as PIIDataType,
          pattern: /test/g,
          description: 'Test email pattern',
        },
      ];

      mockPIIPatternService.getAllPatterns.mockReturnValue(mockPatterns);

      const result = service.getPIIPatterns();

      expect(result).toBe(mockPatterns);
      expect(mockPIIPatternService.getAllPatterns).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return service statistics', async () => {
      const mockPatternStats = {
        builtInPatterns: 10,
        customPatterns: 2,
        totalPatterns: 12,
        enabledPatterns: 11,
        lastRefresh: new Date(),
      };

      mockPIIPatternService.getStats.mockReturnValue(mockPatternStats);

      const result = await service.getStats();

      expect(result).toMatchObject({
        totalPIIPatterns: 12,
        productionMode: false, // Test environment
        customPatterns: 2,
        patternServiceStats: mockPatternStats,
      });
    });
  });

  describe('fake data generation', () => {
    it('should generate realistic fake emails', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({ 
                data: [{ value: 'example.com' }], 
                error: null 
              }),
            })),
          })),
        })),
      });

      const email = await (service as any).generateFakeEmail('john@example.com');
      
      expect(email).toMatch(/@/);
      expect(typeof email).toBe('string');
    });

    it('should generate realistic fake phone numbers', async () => {
      const phone = await (service as any).generateFakePhone('(555) 123-4567');
      
      expect(phone).toMatch(/\(\d{3}\) \d{3}-\d{4}/);
    });

    it('should generate realistic fake names', async () => {
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ 
                  data: [{ value: 'John', frequency_weight: 10 }], 
                  error: null 
                }),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue({ 
                  data: [{ value: 'Smith', frequency_weight: 10 }], 
                  error: null 
                }),
              })),
            })),
          })),
        });

      const name = await (service as any).generateFakeName('Original Name');
      
      expect(typeof name).toBe('string');
      expect(name.split(' ')).toHaveLength(2);
    });

    it('should generate fake IP addresses in private ranges', async () => {
      const ip = await (service as any).generateFakeIPAddress('192.168.1.100');
      
      expect(ip).toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      // Should be in private IP ranges
      expect(ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.')).toBe(true);
    });

    it('should generate fake usernames', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              limit: jest.fn().mockResolvedValue({ 
                data: [{ value: 'john', frequency_weight: 10 }], 
                error: null 
              }),
            })),
          })),
        })),
      });

      const username = await (service as any).generateFakeUsername('@johndoe');
      
      expect(username).toMatch(/^@\w+$/);
    });
  });

  describe('database integration', () => {
    it('should store pseudonym mappings in database', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
      });

      await service.generatePseudonym('test@example.com', 'email', 'test-context');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('pseudonym_mappings');
    });

    it('should handle database connection errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockRejectedValue(new Error('Connection failed')),
          })),
        })),
      });

      await expect(service.generatePseudonym('test@example.com', 'email'))
        .rejects.toThrow('Connection failed');
    });

    it('should increment usage counters', async () => {
      const existingId = 'existing-mapping-id';
      
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ 
                data: { 
                  id: existingId,
                  pseudonym: 'existing@example.com',
                  data_type: 'email'
                }, 
                error: null 
              }),
            })),
          })),
        })
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ 
                data: { usage_count: 5 }, 
                error: null 
              }),
            })),
          })),
          update: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ data: {}, error: null }),
          })),
        });

      await service.generatePseudonym('test@example.com', 'email');

      // Should attempt to increment usage count
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('pseudonym_mappings');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid data types gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const result = await service.generatePseudonym('test-value', 'custom');
      
      expect(result.dataType).toBe('custom');
      expect(result.pseudonym).toBeDefined();
    });

    it('should handle empty or null inputs', async () => {
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: [],
        processingTime: 1,
        patternsChecked: 0,
      });

      const emptyResult = await service.pseudonymizeText('');
      const nullResult = await service.pseudonymizeText(null as any);

      expect(emptyResult.pseudonymizedText).toBe('');
      expect(emptyResult.pseudonyms).toHaveLength(0);
      
      expect(nullResult.pseudonymizedText).toBe(null);
      expect(nullResult.pseudonyms).toHaveLength(0);
    });

    it('should handle very long inputs efficiently', async () => {
      const longText = 'test@example.com '.repeat(1000);
      
      mockPIIPatternService.detectPII.mockResolvedValue({
        matches: Array.from({ length: 100 }, (_, i) => ({
          value: `test${i}@example.com`,
          dataType: 'email',
          patternName: 'email_standard',
          startIndex: i * 18,
          endIndex: (i * 18) + 17,
          confidence: 1.0,
        })),
        processingTime: 50,
        patternsChecked: 10,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
        insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const startTime = Date.now();
      const result = await service.pseudonymizeText(longText.slice(0, 1000)); // Limit for test
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete in reasonable time
      expect(result).toBeDefined();
    });
  });
});