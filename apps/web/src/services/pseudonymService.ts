import { apiService } from './apiService';
import {
  PseudonymGenerateRequest,
  PseudonymGenerateResponse,
  PseudonymLookupRequest,
  PseudonymLookupResponse,
  PseudonymStatsResponse,
  ReversePseudonymizationRequest,
  ReversePseudonymizationResponse,
  PseudonymMapping,
  PseudonymDictionaryEntry,
  PseudonymDictionaryImportData,
  PseudonymDictionaryExportData,
  PseudonymDictionaryBulkOperation,
  PseudonymDictionaryBulkResult,
  PIIDataType
} from '@/types/pii';

class PseudonymService {
  // Align with backend routes under /llm/sanitization
  private readonly basePath = '/llm/sanitization';

  // =====================================
  // PSEUDONYM MAPPINGS
  // =====================================

  /**
   * Get all pseudonym mappings
   */
  async getPseudonymMappings(): Promise<PseudonymMapping[]> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/mappings`);
      return response.mappings || [];
    } catch (error) {
      console.error('Error fetching pseudonym mappings:', error);
      // For now, return empty array if endpoint doesn't exist
      if ((error as { response?: { status: number } })?.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get pseudonym mappings with filters
   */
  async getPseudonymMappingsFiltered(filters: {
    dataType?: PIIDataType | 'all';
    context?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ mappings: PseudonymMapping[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters.dataType && filters.dataType !== 'all') {
        params.append('dataType', filters.dataType);
      }
      if (filters.context) {
        params.append('context', filters.context);
      }
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      }
      if (filters.offset) {
        params.append('offset', filters.offset.toString());
      }

      const response = await apiService.get(`${this.basePath}/pseudonym/mappings?${params.toString()}`);
      return {
        mappings: response.mappings || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('Error fetching filtered pseudonym mappings:', error);
      throw error;
    }
  }

  /**
   * Get a specific pseudonym mapping by ID
   */
  async getPseudonymMapping(id: string): Promise<PseudonymMapping> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/mappings/${id}`);
      return response.mapping;
    } catch (error) {
      console.error(`Error fetching pseudonym mapping ${id}:`, error);
      throw error;
    }
  }

  // =====================================
  // PSEUDONYM GENERATION & LOOKUP
  // =====================================

  /**
   * Generate a pseudonym for a specific value
   */
  async generatePseudonym(request: PseudonymGenerateRequest): Promise<PseudonymGenerateResponse> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/generate`, {
        value: request.value,
        dataType: request.dataType,
        context: request.context
      });
      return response;
    } catch (error) {
      console.error('Error generating pseudonym:', error);
      throw error;
    }
  }

  /**
   * Lookup existing pseudonym for a value
   */
  async lookupPseudonym(request: PseudonymLookupRequest): Promise<PseudonymLookupResponse> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/lookup`, {
        value: request.value,
        dataType: request.dataType
      });
      return response;
    } catch (error) {
      console.error('Error looking up pseudonym:', error);
      throw error;
    }
  }

  /**
   * Get pseudonymization statistics
   */
  async getPseudonymStats(): Promise<PseudonymStatsResponse> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/stats`);
      return response;
    } catch (error) {
      console.error('Error fetching pseudonym stats:', error);
      throw error;
    }
  }

  /**
   * Reverse pseudonymization - convert pseudonyms back to original values
   */
  async reversePseudonymization(request: ReversePseudonymizationRequest): Promise<ReversePseudonymizationResponse> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/reverse`, request);
      return response;
    } catch (error) {
      console.error('Error reversing pseudonymization:', error);
      throw error;
    }
  }

  // =====================================
  // PSEUDONYM DICTIONARY MANAGEMENT
  // =====================================
  // Note: These endpoints may not exist yet in the backend, 
  // but are planned for dictionary management functionality

  /**
   * Get all pseudonym dictionaries
   */
  async getPseudonymDictionaries(): Promise<PseudonymDictionaryEntry[]> {
    try {
      const response = await apiService.getQuiet404(`${this.basePath}/pseudonym/dictionaries`);
      return response.dictionaries || [];
    } catch (error) {
      // Graceful fallback without noisy logs for 404
      if ((error as { response?: { status: number } })?.response?.status === 404) {
        return [];
      }
      console.error('Error fetching pseudonym dictionaries:', error);
      throw error;
    }
  }

  /**
   * Get a specific pseudonym dictionary by ID
   */
  async getPseudonymDictionary(id: string): Promise<PseudonymDictionaryEntry> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/dictionaries/${id}`);
      return response.dictionary;
    } catch (error) {
      console.error(`Error fetching pseudonym dictionary ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new pseudonym dictionary
   */
  async createPseudonymDictionary(dictionary: Omit<PseudonymDictionaryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PseudonymDictionaryEntry> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/dictionaries`, dictionary);
      return response.dictionary;
    } catch (error) {
      console.error('Error creating pseudonym dictionary:', error);
      throw error;
    }
  }

  /**
   * Update an existing pseudonym dictionary
   */
  async updatePseudonymDictionary(id: string, dictionary: Partial<PseudonymDictionaryEntry>): Promise<PseudonymDictionaryEntry> {
    try {
      const response = await apiService.put(`${this.basePath}/pseudonym/dictionaries/${id}`, dictionary);
      return response.dictionary;
    } catch (error) {
      console.error(`Error updating pseudonym dictionary ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a pseudonym dictionary
   */
  async deletePseudonymDictionary(id: string): Promise<void> {
    try {
      await apiService.delete(`${this.basePath}/pseudonym/dictionaries/${id}`);
    } catch (error) {
      console.error(`Error deleting pseudonym dictionary ${id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk operations on pseudonym dictionaries
   */
  async bulkOperationPseudonymDictionaries(operation: PseudonymDictionaryBulkOperation): Promise<PseudonymDictionaryBulkResult> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/dictionaries/bulk`, operation);
      return response;
    } catch (error) {
      console.error('Error performing bulk operation on pseudonym dictionaries:', error);
      throw error;
    }
  }

  // =====================================
  // BULK IMPORT/EXPORT FUNCTIONALITY
  // =====================================

  /**
   * Import pseudonym dictionaries from JSON data
   */
  async importPseudonymDictionaries(data: PseudonymDictionaryImportData[]): Promise<{ success: boolean; imported: number; errors?: string[] }> {
    try {
      const response = await apiService.post(`${this.basePath}/pseudonym/dictionaries/import`, { dictionaries: data });
      return response;
    } catch (error) {
      console.error('Error importing pseudonym dictionaries:', error);
      throw error;
    }
  }

  /**
   * Export all pseudonym dictionaries to JSON
   */
  async exportPseudonymDictionaries(): Promise<PseudonymDictionaryExportData> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/dictionaries/export`);
      return response;
    } catch (error) {
      console.error('Error exporting pseudonym dictionaries:', error);
      throw error;
    }
  }

  /**
   * Import pseudonym dictionaries from CSV file
   */
  async importFromCSV(file: File): Promise<{ success: boolean; imported: number; errors?: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiService.post(`${this.basePath}/pseudonym/dictionaries/import/csv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      console.error('Error importing from CSV:', error);
      throw error;
    }
  }

  /**
   * Export pseudonym dictionaries to CSV format
   */
  async exportToCSV(): Promise<Blob> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/dictionaries/export/csv`, {
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  // =====================================
  // CLIENT-SIDE UTILITIES
  // =====================================

  /**
   * Parse CSV content for dictionary import
   */
  parseCSVContent(csvContent: string): PseudonymDictionaryImportData[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dictionaries: PseudonymDictionaryImportData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < headers.length) continue;

      const dictionary: PseudonymDictionaryImportData = {
        category: '',
        dataType: 'custom' as PIIDataType,
        words: [],
        description: ''
      };

      headers.forEach((header, index) => {
        const value = values[index];
        switch (header) {
          case 'category':
            dictionary.category = value;
            break;
          case 'datatype':
          case 'data_type':
            dictionary.dataType = value as PIIDataType;
            break;
          case 'words':
            dictionary.words = value.split('|').map(w => w.trim()).filter(w => w);
            break;
          case 'description':
            dictionary.description = value;
            break;
          case 'frequency_weights':
          case 'weights':
            try {
              dictionary.frequencyWeights = JSON.parse(value);
            } catch {
              // Ignore invalid JSON
            }
            break;
        }
      });

      if (dictionary.category && dictionary.words.length > 0) {
        dictionaries.push(dictionary);
      }
    }

    return dictionaries;
  }

  /**
   * Convert dictionaries to CSV format
   */
  convertDictionariesToCSV(dictionaries: PseudonymDictionaryEntry[]): string {
    const headers = ['category', 'dataType', 'words', 'description', 'isActive', 'createdAt'];
    const csvLines = [headers.join(',')];

    dictionaries.forEach(dict => {
      const row = [
        dict.category,
        dict.dataType,
        dict.words.join('|'),
        dict.description || '',
        dict.isActive.toString(),
        dict.createdAt || ''
      ];
      csvLines.push(row.map(field => `"${field}"`).join(','));
    });

    return csvLines.join('\n');
  }

  /**
   * Validate dictionary data before import
   */
  validateDictionaryData(data: PseudonymDictionaryImportData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    data.forEach((dict, index) => {
      if (!dict.category) {
        errors.push(`Dictionary ${index + 1}: Category is required`);
      }
      if (!dict.dataType) {
        errors.push(`Dictionary ${index + 1}: Data type is required`);
      }
      if (!dict.words || dict.words.length === 0) {
        errors.push(`Dictionary ${index + 1}: At least one word is required`);
      }
      if (dict.words && dict.words.some(word => !word.trim())) {
        errors.push(`Dictionary ${index + 1}: All words must be non-empty`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get pseudonym mappings for a specific run ID
   */
  async getMappingsByRunId(runId: string): Promise<PseudonymMapping[]> {
    try {
      const response = await apiService.get(`${this.basePath}/pseudonym/mappings/run/${runId}`);
      return response.mappings || [];
    } catch (error) {
      console.error(`Error fetching mappings for run ${runId}:`, error);
      // Return empty array if not found
      if ((error as { response?: { status: number } })?.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }
}

// Export singleton instance
export const pseudonymService = new PseudonymService();
export default pseudonymService;
